# Company publication methods

**Research completed: October 18, 2026 · Financial snapshot: October 15, 2026**

The additional company reports use primary business evidence from annual earnings releases, investor presentations and company-hosted annual reports. This extends the original CDS approach: read what the company published, identify a few material operating results, explain why they matter, and propose specific follow-up checks.

## Source selection

1. Match the issuer and ticker to the existing supported company record.
2. Find a publication covering the exact annual period shown on its report. A fourth-quarter release is usable only for its clearly identified full-year figures.
3. Prefer the company's corporate or investor-relations website. Issuer-authored copies distributed through newswire services are retained where used and identified in the source notes.
4. Open the publication before marking it verified. Limited excerpts and unavailable publications retain a distinct review status.
5. Store the publication title, issuer, date where supplied, fiscal-year end, URL, and access status. `docs/company_sources.csv` provides a compact index.

## Business evidence

Each reviewed report contains four observations selected from its actual business results: for example, organic growth, orders, segment results, customer activity, production, comparable sales, occupancy or cash conversion. The stored record separates the observation from its implication and recommended next check. Company comments and non-GAAP measures are not converted into independently established causes or GAAP results.

The existing website views use these records. No additional navigation section is required. The ten original profiles are kept in their original reporting snapshots and do not receive this annual commentary.

`analysis.json` contains the additional profiles' business recommendations. The lead and main focus synthesize strengths, weaknesses and the most useful direction. Each of four cards includes three practical actions. Its internal evidence references point to the same company's published observations; those relationships are retained in SQLite. The website follows the original card layout, with publication links collected in Sources.

## Financial pairs

An optional financial pair must state both annual amounts under the same GAAP definition. Values are stored in USD or USD per diluted share, using the publication's stated units. The paired record identifies its exact publication. The importer rejects nonfinite values, unsupported units, missing source relationships, mismatched fiscal years and adjusted labels in this table.

The displayed table uses a verified published pair where present; remaining rows use the saved SEC comparison. Income definitions remain explicit. Original SEC values are retained when replaced, including scale or attribution differences. A single amount, rounded growth rate or apparent outlier is not enough to manufacture a prior amount or apply a scale factor.

For a bank that publishes annual GAAP net interest income and noninterest income separately, all four current/prior components can be retained in `bank_revenue_components`. SQL sums those components into an explicitly calculated revenue measure. Fully tax-equivalent or adjusted figures are not substituted for GAAP components. The source disclosure labels the calculation and links the underlying publication.

## Reproduce and inspect

Run `python3 -m cds build` to import the saved records into SQLite and rebuild the offline report. `company_reports`, `report_sources`, `report_evidence`, and `published_financials` expose the research relationships. `business_analyses`, `analysis_cards`, and `analysis_evidence` retain recommendations and their supporting observations. `comparisons` remains the original SEC view; `reported_comparisons` and `reported_income_ratios` calculate the website's selected measures.

The build makes no network requests. Public source links need internet access; the stored observations, analysis and comparisons remain readable offline. Publication content can change or move after the research date. Automated checks protect identity, relationships, units, periods and calculations; they are not an external financial audit.
