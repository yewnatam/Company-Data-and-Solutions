# Analysis walkthrough: Costco

## Business question

Did Costco's earnings keep pace with revenue, and what needs more investigation?

This example uses the saved annual dataset, not a live feed. It demonstrates the same workflow used by the website: match the company, check the periods and definitions, calculate changes, then explain what those changes support.

## Data and method

- Company: Costco Wholesale, SEC company ID (CIK) 909832.
- Current year: September 2, 2024 through August 31, 2025.
- Prior year: September 4, 2023 through September 1, 2024.
- Measures: total revenue and net income, in USD.
- Source: [Costco's fourth-quarter and fiscal 2025 results](https://investor.costco.com/news/news-details/2025/Costco-Wholesale-Corporation-Reports-Fourth-Quarter-and-Fiscal-Year-2025-Operating-Results/default.aspx), retained in `data/reports.json`.

The importer validates company and period relationships. The `reported_comparisons` SQL view uses checked company-published pairs when present and saved SEC pairs for other measures. Original SEC facts remain in the database for reference.

Percentage change is `(current - prior) / prior * 100`. It is omitted for a nonpositive prior value. Income divided by revenue is an analytical ratio; it is not interchangeable with operating margin.

## Results

| Measure | Prior year | Current year | Change |
| --- | ---: | ---: | ---: |
| Total revenue | $254.453 billion | $275.235 billion | +8.17% |
| Net income | $7.367 billion | $8.099 billion | +9.94% |
| Net income / total revenue | 2.895% | 2.943% | +0.047 percentage points |

Net income grew faster than revenue. Costco retained slightly more net income per dollar of revenue in this comparison. The ratio change is small in percentage-point terms, which is easy to miss when only comparing the two growth rates.

These totals do not prove the cause. A next research step is to review membership fee income, merchandise margins, operating expenses and tax effects in the source publication. Separate those contributions before recommending changes to prices or costs. No business improvement from using this dashboard has been measured.

## Reproduce the analysis

Build the database with `python3 -m cds build`. If the SQLite command-line tool is installed, run from the repository root:

```bash
sqlite3 -header -column .build/companies.sqlite3 < sql/portfolio_queries.sql
```

Python can run the queries without installing SQLite's command-line tool:

```python
import sqlite3
from pathlib import Path

with sqlite3.connect('.build/companies.sqlite3') as connection:
    connection.row_factory = sqlite3.Row
    queries = Path('sql/portfolio_queries.sql').read_text(encoding='utf-8')
    for query in queries.split(';'):
        if query.strip():
            for row in connection.execute(query):
                print(dict(row))
```

The second query finds Consumer Staples companies with rising revenue and falling income. It is a research shortlist, not a ranking of investment quality. The third checks missing cash-flow coverage by sector before further comparisons. Both show why data coverage and business context belong alongside calculations.
