"""Validate saved primary-source data, analyze it in SQLite, and build offline HTML."""

import hashlib
import json
import os
import sqlite3
from pathlib import Path
from tempfile import TemporaryDirectory

from .ingest import collect, normalize
from .reports import export_reports, import_reports
from .analysis import export_analyses, import_analyses


def json_for_html(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False).replace("&", "\\u0026").replace("<", "\\u003c").replace(">", "\\u003e")


def verify_sources(root):
    integrity = json.loads((root / "data/integrity.json").read_text(encoding="utf-8"))
    for filename, checksum in integrity.items():
        if hashlib.sha256((root / "data" / filename).read_bytes()).hexdigest() != checksum:
            raise ValueError(f"Input checksum differs: {filename}")
    receipts = json.loads((root / "data/downloads.json").read_text(encoding="utf-8"))
    for filename, receipt in receipts.items():
        if "error" in receipt or not filename.endswith('.json') or filename == 'tickers.json':
            continue
        path = root / "data/raw" / filename
        if hashlib.sha256(path.read_bytes()).hexdigest() != receipt["sha256"]:
            raise ValueError(f"Source checksum differs: {filename}")
    return receipts


def make_database(root, path, supported):
    db = sqlite3.connect(path)
    db.row_factory = sqlite3.Row
    db.executescript((root / "sql/schema.sql").read_text(encoding="utf-8"))
    with db:
        for company in supported:
            cik = company["cik"]
            db.execute("INSERT INTO companies VALUES (?, ?, ?, ?, ?)",
                       (cik, company["name"], company["sector"], company["industry"], json.dumps(company["tickers"])))
            db.executemany("INSERT INTO aliases VALUES (?, ?)", [(alias, cik) for alias in company["aliases"]])
            for position, fact in enumerate(company["facts"]["revenue"][1:]):
                db.execute("INSERT INTO periods VALUES (?, ?, ?, ?)", (cik, position, fact["start"], fact["end"]))
            for metric, (concept, current, prior) in company["facts"].items():
                for position, fact in enumerate((current, prior)):
                    if fact is None:
                        continue
                    year = 2025 if position == 0 else 2024
                    db.execute("INSERT INTO facts VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                               (cik, position, metric, concept, fact["val"], "USD-per-shares" if metric == "eps" else "USD", fact["accn"], f"{concept}_{year}.json"))
        if db.execute("PRAGMA foreign_key_check").fetchall():
            raise ValueError("Orphaned financial data")
        profiles = json.loads((root / "data/curated.json").read_text(encoding="utf-8"))
        ticker_ids = {ticker: c["cik"] for c in supported for ticker in c["tickers"]}
        for key, profile in profiles.items():
            cik = next((ticker_ids[a.upper()] for a in profile["aliases"] if a.upper() in ticker_ids), None)
            db.execute("INSERT INTO curated_profiles VALUES (?, ?, ?)", (key, cik, json.dumps(profile, ensure_ascii=False)))
        import_reports(db, root)
        import_analyses(db, root)
    return db


def export_database(db, counts):
    companies = []
    for company in db.execute("SELECT * FROM companies ORDER BY name COLLATE NOCASE"):
        cik = company["cik"]
        periods = [list(row) for row in db.execute("SELECT start, end FROM periods WHERE cik = ? ORDER BY position", (cik,))]
        facts = {}
        for fact in db.execute("SELECT * FROM reported_comparisons WHERE cik = ? ORDER BY metric", (cik,)):
            # Per metric: values, concept, accessions, SQL change, absolute change.
            facts[fact["metric"]] = [fact["current_value"], fact["prior_value"], fact["concept"],
                                     fact["current_accession"], fact["prior_accession"],
                                     fact["change_percent"], fact["absolute_change"]]
        ratios = [row[0] for row in db.execute("SELECT income_to_revenue_percent FROM reported_income_ratios WHERE cik = ? ORDER BY position", (cik,))]
        aliases = [row[0] for row in db.execute("SELECT alias FROM aliases WHERE cik = ? ORDER BY alias", (cik,))]
        entry = {"id": cik, "n": company["name"], "s": company["sector"], "i": company["industry"],
                 "t": json.loads(company["tickers"]), "a": aliases, "p": periods, "m": facts, "r": ratios}
        labels = {row["metric"]: row["label"] for row in db.execute(
            "SELECT metric, label FROM company_financial_pairs WHERE cik = ?", (cik,))}
        if labels:
            entry["labels"] = labels
            entry["sec_m"] = {fact["metric"]: [fact["current_value"], fact["prior_value"], fact["concept"],
                                               fact["current_accession"], fact["prior_accession"],
                                               fact["change_percent"], fact["absolute_change"]]
                               for fact in db.execute("SELECT * FROM comparisons WHERE cik = ? ORDER BY metric", (cik,))}
        companies.append(entry)
    curated = {}
    by_cik = {c["id"]: c for c in companies}
    for row in db.execute("SELECT * FROM curated_profiles ORDER BY profile_key"):
        profile = json.loads(row["profile_json"])
        key = row["profile_key"]
        curated[key] = profile
        if row["cik"] is not None:
            company = by_cik[row["cik"]]
            company["profile"] = key
            company["a"] = sorted(set(company["a"]) | {normalize(alias) for alias in profile["aliases"]})
        else:
            companies.append({"id": f"original_{key}", "n": profile["name"], "s": "Other original companies",
                              "i": "Original demo profile outside this S&P 500 roster", "t": [profile["ticker"]],
                              "a": [normalize(alias) for alias in profile["aliases"]], "profile": key,
                              "p": [], "m": {}, "r": []})
    companies.sort(key=lambda company: company["n"].casefold())
    counts = {**counts, "total_companies": len(companies), "curated_profiles": len(curated),
              "additional_original_companies": len(companies) - counts["supported_companies"]}
    reports = export_reports(db)
    analyses = export_analyses(db)
    for cik, analysis in analyses.items():
        reports[cik]['analysis'] = analysis
    counts["company_reports"] = len(reports)
    counts["business_analyses"] = len(analyses)
    counts["verified_company_reports"] = sum(r["status"] == "verified" for r in reports.values())
    counts["partial_company_reports"] = sum(r["status"] == "partial" for r in reports.values())
    return {"date": "2026-10-15", "frames": [2025, 2024], "coverage": counts,
            "companies": companies, "curated": curated, "reports": reports}


def build(root: Path):
    root = root.resolve()
    receipts = verify_sources(root)
    supported, excluded, counts = collect(root / "data")
    if not supported:
        raise ValueError("No comparable companies passed source checks")
    working = root / ".build"
    working.mkdir(exist_ok=True)
    with TemporaryDirectory(dir=working) as temporary:
        stage = Path(temporary)
        db = make_database(root, stage / "companies.sqlite3", supported)
        try:
            payload = export_database(db, counts)
        finally:
            db.close()
        payload["publications"] = json.loads((root / "data/publications.json").read_text(encoding="utf-8"))
        web = root / "web"
        template = (web / "index.html").read_text(encoding="utf-8")
        stylesheet = (web / "styles.css").read_text(encoding="utf-8")
        scripts = "\n".join((web / name).read_text(encoding="utf-8") for name in ("search.js", "charts.js", "analysis.js", "profiles.js", "compare.js", "explore.js", "app.js"))
        for marker in ('<link rel="stylesheet" href="styles.css" />', '{{COMPANY_DATA}}', '<!-- APPLICATION_SCRIPTS -->'):
            if template.count(marker) != 1:
                raise ValueError(f"Unexpected template marker count: {marker}")
        html = template.replace('<link rel="stylesheet" href="styles.css" />', f'<style>{stylesheet}</style>')
        html = html.replace('{{COMPANY_DATA}}', json_for_html(payload))
        html = html.replace('<!-- APPLICATION_SCRIPTS -->', '<script>\n(() => {\n"use strict";\n' + scripts + '\n})();\n</script>')
        (stage / "index.html").write_text(html, encoding="utf-8")
        report = {**payload["coverage"], "excluded": excluded, "sources": receipts}
        (stage / "coverage.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
        (stage / "buildinfo.json").write_text(json.dumps({"project": "Company Data and Solutions", **payload["coverage"], "site_sha256": hashlib.sha256(html.encode()).hexdigest()}, indent=2), encoding="utf-8")
        (stage / "catalog.json").write_text(json_for_html(payload), encoding="utf-8")
        dist = root / "dist"
        dist.mkdir(exist_ok=True)
        os.replace(stage / "companies.sqlite3", working / "companies.sqlite3")
        for name in ("index.html", "coverage.json", "buildinfo.json", "catalog.json"):
            os.replace(stage / name, dist / name)
    return dist / "index.html"
