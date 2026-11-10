"""Keep company-published operating evidence separate from SEC financial facts."""

import json
import math
import re
from datetime import date
from urllib.parse import urlparse


AS_OF = date(2026, 10, 15)
STATUSES = {"verified", "partial", "unavailable"}
TONES = {"high", "medium", "positive"}


def required_text(record, field):
    value = record.get(field)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"Missing company-report field: {field}")
    return value


def import_reports(db, root):
    records = json.loads((root / "data/reports.json").read_text(encoding="utf-8"))
    known = {row["cik"]: row["end"] for row in db.execute(
        "SELECT cik, end FROM periods WHERE position = 0")}
    originals = {row[0] for row in db.execute(
        "SELECT cik FROM curated_profiles WHERE cik IS NOT NULL")}
    seen = set()
    for report in records:
        cik = report["id"]
        if cik in seen or cik not in known or cik in originals:
            raise ValueError(f"Unexpected or duplicate company report: {cik}")
        seen.add(cik)
        period_end = report["period_end"]
        if period_end != known[cik] or report["status"] not in STATUSES:
            raise ValueError(f"Company-report period or status differs: {cik}")
        sources = report["sources"]
        evidence = report["evidence"]
        if len(evidence) > 4 or (report["status"] == "verified" and len(evidence) < 3):
            raise ValueError(f"Insufficient or excessive report evidence: {cik}")
        source_ids = {source["id"] for source in sources}
        if len(source_ids) != len(sources):
            raise ValueError(f"Duplicate company source identifiers: {cik}")
        if report["status"] == "unavailable" and (sources or evidence):
            raise ValueError(f"Unavailable company report contains evidence: {cik}")
        db.execute("INSERT INTO company_reports VALUES (?, ?, ?, ?, ?, ?, ?)",
                   (cik, period_end, report["status"], report.get("headline", ""),
                    report.get("focus_title", ""), report.get("focus_text", ""), report.get("notes", "")))
        for source in sources:
            parsed = urlparse(required_text(source, "url"))
            if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
                raise ValueError(f"Unsafe company source URL: {cik}")
            if source["period_end"] != period_end or source["access"] not in {"opened", "search_excerpt"}:
                raise ValueError(f"Company source period or access differs: {cik}")
            published = source.get("published", "")
            if published and not date.fromisoformat(period_end) <= date.fromisoformat(published) <= AS_OF:
                raise ValueError(f"Company source publication date differs: {cik}")
            if report["status"] == "verified" and source["access"] != "opened":
                raise ValueError(f"Verified report has an unopened source: {cik}")
            db.execute("INSERT INTO report_sources VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                       (cik, source["id"], source["url"], required_text(source, "title"),
                        required_text(source, "publisher"), published, period_end,
                        required_text(source, "kind"), source["access"]))
        for position, item in enumerate(evidence):
            if item["source_id"] not in source_ids or item["tone"] not in TONES:
                raise ValueError(f"Orphaned or invalid company evidence: {cik}")
            if report["status"] == "verified":
                required_text(item, "metric_label")
                required_text(item, "metric_value")
            db.execute("INSERT INTO report_evidence VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                       (cik, position, item["source_id"], required_text(item, "label"),
                        required_text(item, "text"), required_text(item, "implication"),
                        required_text(item, "action"), item["tone"], item.get("metric_label", ""),
                        item.get("metric_value", "")))
        for metric, fact in report.get("financials", {}).items():
            expected_unit = "USD-per-shares" if metric == "eps" else "USD"
            if metric not in {"revenue", "income", "operating", "cash", "capex", "eps"}:
                raise ValueError(f"Unknown published financial measure: {metric}")
            if fact["source_id"] not in source_ids or fact["unit"] != expected_unit:
                raise ValueError(f"Invalid published financial source or unit: {cik}")
            source = next(s for s in sources if s["id"] == fact["source_id"])
            if source["access"] != "opened":
                raise ValueError(f"Published financial amount lacks an opened source: {cik}")
            for field in ("current", "prior"):
                value = fact[field]
                if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
                    raise ValueError(f"Invalid published financial amount: {cik}")
            label = required_text(fact, "label")
            # A share split restates GAAP per-share comparatives; it is not a non-GAAP adjustment.
            accounting_label = re.sub(r"(?:stock[ -])?split[ -]adjusted", "", label, flags=re.I) if metric == "eps" else label
            if re.search(r"adjusted|non[\s-]?gaap|ebitda|funds from operations|\bffo\b|free cash flow", accounting_label, re.I):
                raise ValueError(f"Adjusted amount cannot replace a GAAP comparison: {cik}")
            if metric == "revenue" and (fact["current"] <= 0 or fact["prior"] <= 0):
                raise ValueError(f"Nonpositive published revenue cannot support this comparison: {cik}")
            if metric == "eps" and "dilut" not in label.lower():
                raise ValueError(f"Published EPS must identify the diluted measure: {cik}")
            db.execute("INSERT INTO published_financials VALUES (?, ?, ?, ?, ?, ?, ?)",
                       (cik, metric, fact["current"], fact["prior"], label, fact["unit"], fact["source_id"]))
        components = report.get("revenue_components")
        if components:
            source = next((s for s in sources if s["id"] == components["source_id"]), None)
            if source is None or source["access"] != "opened":
                raise ValueError(f"Bank revenue components lack an opened source: {cik}")
            for position, period in enumerate(("current", "prior")):
                values = components[period]
                if set(values) != {"net_interest_income", "noninterest_income"}:
                    raise ValueError(f"Incomplete bank revenue components: {cik}")
                for component, value in values.items():
                    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
                        raise ValueError(f"Invalid bank revenue component: {cik}")
                    db.execute("INSERT INTO bank_revenue_components VALUES (?, ?, ?, ?, ?)",
                               (cik, position, component, value, components["source_id"]))
    if db.execute("PRAGMA foreign_key_check").fetchall():
        raise ValueError("Orphaned company-report evidence")


def export_reports(db):
    reports = {}
    for row in db.execute("SELECT * FROM company_reports ORDER BY cik"):
        cik = row["cik"]
        sources = [dict(source) for source in db.execute(
            "SELECT source_id AS id, url, title, publisher, published, period_end, kind, access "
            "FROM report_sources WHERE cik = ? ORDER BY source_id", (cik,))]
        evidence = [dict(item) for item in db.execute(
            "SELECT source_id, label, observation AS text, implication, action, tone, metric_label, metric_value "
            "FROM report_evidence WHERE cik = ? ORDER BY position", (cik,))]
        financials = {fact["metric"]: {"current": fact["current_value"], "prior": fact["prior_value"],
                                      "label": fact["label"], "unit": fact["unit"], "source_id": fact["source_id"], "method": fact["method"]}
                      for fact in db.execute("SELECT * FROM company_financial_pairs WHERE cik = ? ORDER BY metric", (cik,))}
        reports[str(cik)] = {"period_end": row["period_end"], "status": row["status"],
                             "headline": row["headline"], "focus_title": row["focus_title"],
                             "focus_text": row["focus_text"], "notes": row["notes"],
                             "sources": sources, "evidence": evidence, "financials": financials}
    return reports
