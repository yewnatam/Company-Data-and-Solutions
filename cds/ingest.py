"""Match the saved index roster to comparable, explicitly sourced SEC facts."""

import json
import math
import re
from datetime import date
from pathlib import Path

REVENUE = (
    "RevenuesNetOfInterestExpense", "Revenues",
    "RevenueFromContractWithCustomerExcludingAssessedTax",
    "RevenueFromContractWithCustomerIncludingAssessedTax",
)
INCOME = ("NetIncomeLoss", "ProfitLoss")
OPTIONAL = {
    "operating": "OperatingIncomeLoss",
    "cash": "NetCashProvidedByUsedInOperatingActivities",
    "capex": "PaymentsToAcquirePropertyPlantAndEquipment",
    "eps": "EarningsPerShareDiluted",
}


def normalize(value):
    return re.sub(r"\s+", " ", re.sub(r"[’'.,]", "", str(value).strip().lower()))


def valid_fact(fact):
    if not fact or not all(key in fact for key in ("start", "end", "val", "accn", "cik")):
        return False
    if isinstance(fact["val"], bool) or not isinstance(fact["val"], (int, float)) or not math.isfinite(fact["val"]):
        return False
    if not re.fullmatch(r"\d{10}-\d{2}-\d{6}", fact["accn"]):
        return False
    duration = (date.fromisoformat(fact["end"]) - date.fromisoformat(fact["start"])).days
    return 335 <= duration <= 395


def same_period(left, right):
    return valid_fact(left) and valid_fact(right) and all(left[key] == right[key] for key in ("start", "end"))


def load_sources(data_directory):
    frames = {}
    for path in sorted((data_directory / "raw").glob("*.json")):
        payload = json.loads(path.read_text(encoding="utf-8"))
        if payload.get("taxonomy") != "us-gaap" or payload.get("ccp") not in ("CY2024", "CY2025"):
            raise ValueError(f"Unexpected frame metadata: {path.name}")
        unit = "USD/shares" if payload["tag"] == "EarningsPerShareDiluted" else "USD"
        if payload["uom"] != unit:
            raise ValueError(f"Unexpected unit in {path.name}")
        year = int(payload["ccp"][2:])
        frames[payload["tag"], year] = {int(row["cik"]): row for row in payload["data"]}
    return frames


def select_company(cik, frames):
    def get(tag, year):
        return frames.get((tag, year), {}).get(cik)

    for revenue_tag in REVENUE:
        current, prior = get(revenue_tag, 2025), get(revenue_tag, 2024)
        if not all(valid_fact(item) for item in (current, prior)) or min(current["val"], prior["val"]) <= 0:
            continue
        if not 335 <= (date.fromisoformat(current["end"]) - date.fromisoformat(prior["end"])).days <= 395:
            continue
        for income_tag in INCOME:
            current_income, prior_income = get(income_tag, 2025), get(income_tag, 2024)
            if not (same_period(current, current_income) and same_period(prior, prior_income)):
                continue
            selected = {"revenue": (revenue_tag, current, prior), "income": (income_tag, current_income, prior_income)}
            for metric, tag in OPTIONAL.items():
                a, b = get(tag, 2025), get(tag, 2024)
                if same_period(current, a):
                    selected[metric] = (tag, a, b if same_period(prior, b) else None)
            return selected
    return None


def collect(data_directory: Path):
    roster = json.loads((data_directory / "roster.json").read_text(encoding="utf-8"))[1:]
    holdings = json.loads((data_directory / "holdings.json").read_text(encoding="utf-8"))
    holdings_tickers = set()
    for row in holdings[4:]:
        values = {re.sub(r"\d", "", key): value for key, value in row}
        holdings_tickers.add(values.get("B", "").replace("-", "."))
    sec_tickers = {row["ticker"].replace("-", "."): row for row in json.loads((data_directory / "tickers.json").read_text(encoding="utf-8")).values()}
    grouped = {}
    for row in roster:
        ticker, name, sector, industry, headquarters, added, cik, founded = row
        company = grouped.setdefault(int(cik), {"cik": int(cik), "name": name, "sector": sector, "industry": industry, "tickers": []})
        company["tickers"].append(ticker)
    frames = load_sources(data_directory)
    supported, excluded = [], []
    for cik, company in grouped.items():
        if len(company["tickers"]) > 1:
            company["name"] = re.sub(r"\s+\(Class [A-Z]\)$", "", company["name"])
        if not all(t in holdings_tickers for t in company["tickers"]):
            excluded.append({**company, "reason": "Roster listing not corroborated by the saved official SPY holdings."})
            continue
        if any(t not in sec_tickers or sec_tickers[t]["cik_str"] != cik for t in company["tickers"]):
            excluded.append({**company, "reason": "Ticker-to-CIK mapping differs between roster and SEC."})
            continue
        facts = select_company(cik, frames)
        if facts is None:
            excluded.append({**company, "reason": "No matched annual revenue and income pair with the same concepts, currency and fiscal dates in the selected SEC frames."})
            continue
        aliases = {company["name"], sec_tickers[company["tickers"][0]]["title"], *company["tickers"]}
        aliases |= {ticker.replace(".", "-") for ticker in company["tickers"]}
        if "GOOGL" in company["tickers"]:
            aliases.update(("Google", "Alphabet"))
        if "META" in company["tickers"]:
            aliases.update(("Meta", "Facebook"))
        company["aliases"] = sorted({normalize(a) for a in aliases})
        company["facts"] = facts
        supported.append(company)
    return sorted(supported, key=lambda c: c["name"].casefold()), excluded, {
        "roster_companies": len(grouped), "roster_listings": len(roster),
        "holdings_matched_listings": sum(row[0] in holdings_tickers for row in roster),
        "supported_companies": len(supported), "excluded_companies": len(excluded),
        "supported_listings": sum(len(c["tickers"]) for c in supported),
    }
