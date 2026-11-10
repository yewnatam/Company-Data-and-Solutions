# Architecture

`python3 -m cds build` follows four stages: verify saved sources, match comparable facts, analyze them in SQLite, and create a self-contained website.

The importer groups share listings by CIK and retains all ticker aliases. It checks the factual roster against saved official ETF holdings and SEC identity mappings. Standard accounting concepts are selected in a fixed order. Fiscal dates must match exactly for each period; missing optional comparisons remain absent.

SQLite stores companies, aliases, fiscal periods, and numeric facts separately. Foreign keys protect issuer/period relationships. Bound parameters handle aliases and company filters. Facts retain the accounting concept, source file and accession. SQL views calculate current/prior changes and income-to-revenue ratios without confusing nonpositive prior amounts with valid growth denominators.

The browser payload includes the supported annual records and ten original curated profiles. The `curated_profiles` table retains those profiles as JSON, with a nullable link to their index CIK. The renderer chooses a complete original profile or an annual report; it does not paste quarterly commentary onto annual figures. TSMC and SpaceX have distinct original-profile identifiers and remain outside the index coverage count.

Company publications are normalized into `company_reports`, `report_sources`, `report_evidence` and `published_financials`. Foreign keys bind each observation and optional financial pair to the correct issuer and source. The importer checks the displayed fiscal year, source access, URL scheme, publication dates, finite amounts and units. An unopened source cannot be marked verified, and an adjusted measure cannot replace a GAAP financial row.

`company_financial_pairs` combines directly published comparisons with explicitly calculated bank revenue, where both years have complete GAAP net-interest and noninterest-income components. `reported_comparisons` selects that company pair when present and otherwise retains the SEC comparison. `reported_income_ratios` uses those same displayed definitions. The exported record also retains the original SEC measures when a company pair replaces them, enabling source reconciliation without destroying the input facts.

`business_analyses` stores a company's overall read and main priority. `analysis_cards` stores four conclusions and their three recommended actions. `analysis_evidence` binds each card to the same issuer's verified observations with foreign keys. The build rejects missing evidence, duplicate or incomplete action lists and source URLs inside analysis content. All four observations must be considered in the analysis.

Deep Analysis uses the original card structure: a business conclusion, supporting facts and three specific actions. The lead weighs strengths against weaknesses, and the main focus recommends a direction. Publication links appear in Sources. Original company-specific writeups are preserved verbatim. Operating measures continue to populate the existing Markets panel.

Search supports exact aliases and partial name/ticker matches, plus a sector filter. The directory renders twelve results initially and adds twelve at a time. All six existing CDS views remain within one selected-company workspace.

Horizontal chart bars share a signed numeric scale. Current and prior periods are directly labeled, unavailable facts have no quantitative mark, and EPS remains outside currency-total charts. Text is escaped before markup insertion. Filing URLs are constructed from validated numeric CIKs and accession formats; source links use `noopener noreferrer`.

The build prepares all results in a temporary directory before installing generated output. The source snapshots and explicit fixed date make builds deterministic. No network calls, secrets, or external runtime dependencies are used during the build or normal browser interaction.
