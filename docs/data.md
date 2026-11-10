# Data selection and review limits

## Original company profiles

The ten original CDS profiles retain their original reporting periods, metrics, detailed analysis, market signals and company publication links in `curated.json`. Their values and commentary are preserved as supplied in the original project; restoring them is not a new audit of those disclosures. A profile replaces the complete displayed report so its commentary and figures share the same basis.

The annual SEC dataset is retained for 482 matched index issuers. Eight original profiles overlap those issuers. TSMC and SpaceX are also searchable as original demo entries and are explicitly outside the saved S&P 500 roster. Total search coverage is 484 companies. “Other original companies” is a browse category for these two entries, not an added GICS sector.

The SQL CSV export remains the annual SEC comparison dataset. Original-profile figures and commentary are stored separately in SQLite and used for the corresponding website reports.

The snapshot was collected on October 15, 2026 UTC, corresponding to the evening of October 14 in New York. It is a saved dataset and does not refresh when the page opens.

## Roster

The factual roster contains 503 listings representing 500 CIK-grouped issuers. Alphabet, Fox and News Corp each have two share listings in this roster. The browser presents one report per issuer and accepts each supported share ticker.

Roster source: <https://en.wikipedia.org/wiki/List_of_S%26P_500_companies>. Attribution: Wikipedia contributors. Only factual table metadata is included; article prose is not reproduced. Wikipedia source material is available under its published licensing terms: <https://en.wikipedia.org/wiki/Wikipedia:Copyrights>.

All 503 roster tickers occur in the saved official SPY holdings dated October 13, 2026: <https://www.ssga.com/us/en/individual/etfs/library-content/products/fund-data/etfs/us/holdings-daily-us-en-spy.xlsx>. Holdings are a corroboration source, not a claim that an ETF portfolio and an index are identical in every respect. Cash, warrants and other non-roster positions are not added as companies. `holdings.json` retains the factual rows used for the match.

The SEC ticker map is checked against each roster CIK. The selected roster is not licensed official index maintenance data, and future index changes require another review.

## Financial facts

### Company-published comparisons

For the additional company profiles, official earnings releases, investor presentations and company-hosted annual reports provide operating context. A small number of issuer-authored releases are accessed through the issuer's distribution service. The source manifest identifies the exact publication rather than linking only to an investor-relations home page.

Where a source explicitly provides current and prior annual GAAP amounts with the same definition, `published_financials` stores that pair in dollars or dollars per share. Those values take precedence in the displayed report. SQL calculates their changes; it does not back-solve an undisclosed prior value from a rounded growth rate. A single current amount is insufficient to replace a comparison. Adjusted/non-GAAP figures remain operating evidence, never replacements for GAAP table rows.

Published income labels specify parent, consolidated or common-shareholder results where applicable. Some saved SEC frames have scale discrepancies or different earnings definitions; the company-published pairs resolve only the measures actually checked. The original SEC facts remain preserved and linked in the source disclosure. Unreviewed measures are not automatically rescaled from their apparent size.

### Saved SEC comparisons

API documentation: <https://www.sec.gov/search-filings/edgar-application-programming-interfaces>.

The saved inputs are standard US-GAAP annual frame records. Frames are calendar-alignment buckets; actual fiscal dates vary. In this supported snapshot, current periods end between June 30, 2025 and June 28, 2026. The page displays the actual dates instead of describing them all as fiscal 2025 or the latest report.

An issuer is included only when it has positive current and prior revenue under one selected concept, matched current/prior income under one selected concept, annual durations, and the same fiscal dates across each matched revenue/income pair. Optional metrics must share the corresponding dates. A missing optional prior fact remains missing.

Revenue concept preference is net revenue after interest expense, then broad Revenues, then contract revenue excluding or including assessed tax. This prevents, for example, selecting Berkshire's contract revenue when broad revenue is also supplied. The selected concept is always disclosed. A standard contract-revenue fact can be a subset of total revenue; it is labeled “Contract revenue,” and users should inspect the filing before interpreting the business total.

Income prefers NetIncomeLoss, which is attributable to the parent under that concept's definition. ProfitLoss is the fallback consolidated result and receives a different display label. These definitions are not silently mixed across the two periods. The calculated income/revenue ratio uses the selected concepts and should not be treated as a universal GAAP margin across industries.

The frames select last-filed facts. The importer does not assume all metrics came from a single filing or that every value is an audited 10-K line. Later filings can supply rounded figures or restatements. Exact accession links and raw fact records are retained so a reviewer can trace the displayed amounts.

## Missing values and signs

No synthetic revenue, profits, geographic breakdowns, business narratives or stock returns are added. An excluded company can have usable disclosures elsewhere; exclusion only describes this import's selected standard tags and matching rules.

Losses and negative operating cash flow remain negative. Charts use a shared scale with a zero baseline. Zero is a measurement; a missing value is labeled “Not supplied.” Percent change is omitted when the prior amount is zero or negative; absolute change remains available when both values exist. Bank cash-flow statements require sector-specific interpretation.

Display cards and bars abbreviate large values. The Financials table presents full source amounts. EPS is USD per share; currency flow charts exclude EPS so monetary totals and per-share values do not share an axis.

## Analysis

The original ten profiles remain unchanged. Additional profiles use the matched company evidence in Overview, Markets, Insights and Deep Analysis. Markets contains short operating measures actually disclosed by the company. Deep Analysis uses the original four-card structure with a specific business priority, supporting facts and three recommended actions per card. Sources contains the publication links. Recommendations are CDS analysis, not company statements, commitments or measured outcomes.

Adjusted measures, organic growth, constant-currency changes, FFO and company-defined free cash flow retain their reported qualifications. Orders, backlog and remaining performance obligations are not described as recognized revenue. Guidance remains a forward-looking management statement. A limited source excerpt is not treated as a fully reviewed publication. Where suitable evidence is unavailable, the report records that limit and retains the calculated financial analysis rather than inventing business drivers.

The review is a saved-source research pass, not an audit or an automatic guarantee that a publication remains available. It does not establish undisclosed causes or predict share prices. Source identities, fiscal dates, relationships, units, and reproducible calculations are checked by the build and tests; the full publication should still be read before a financial decision.

## Reproduction

`downloads.json` records original source URLs, collection timestamps and SHA-256 hashes. `integrity.json` protects every included input, including the derived factual roster tables. The build validates the full saved SEC frame hashes before selecting records. Rebuilding uses those saved inputs without a network request.

Updating the dataset requires downloading new inputs, checking index membership and CIK identities, regenerating integrity records, and reviewing coverage changes. A successful build is evidence of reproducible extraction and calculation, not independent verification of every disclosure's business meaning.
