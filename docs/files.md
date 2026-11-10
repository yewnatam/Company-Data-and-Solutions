# Source files in plain language

This map explains the files kept in the source repository. Build outputs are generated when you run `python3 -m cds build`.

## Project and GitHub files

| File | What it does and why it belongs |
| --- | --- |
| `.gitattributes` | Keeps text-file line endings consistent across computers so Git does not show unnecessary differences. |
| `.github/workflows/checks.yml` | Tells GitHub to run the Python and JavaScript checks when source changes are pushed or reviewed. It helps catch a broken change. |
| `.github/workflows/pages.yml` | Tells GitHub how to test, build and publish the website when main changes or the workflow is started manually. It makes deployment repeatable. |
| `.gitignore` | Keeps generated websites, temporary databases, local settings and environment files out of normal commits. |
| `LICENSE` | The rights-reserved notice for the original code and documentation. It explains that visible source is not an open-source license. |
| `CHANGELOG.md` | Records what changed in each released version so updates are easy to follow. |
| `VERSION` | Identifies the current release as 1.0.0. |
| `README.md` | The project’s front page on GitHub. It explains the purpose, tools, features and run commands so a visitor knows where to start. |

| `vercel.json` | Optional Vercel build and output settings. |

## Python files

| File | What it does and why it belongs |
| --- | --- |
| `cds/__init__.py` | Marks cds as a Python package so its modules can be imported together. It is the small package entry file. |
| `cds/__main__.py` | Provides the commands python3 -m cds build and python3 -m cds report. It gives someone a simple way to run the pipeline. |
| `cds/analysis.py` | Checks the saved Deep Analysis cards and connects their recommendations to the company’s evidence in SQLite. It keeps the written analysis organized. |
| `cds/build.py` | Coordinates the build: checks saved inputs, creates SQLite, exports the results and combines the website files. It turns source files into the demo. |
| `cds/ingest.py` | Matches company names and tickers to SEC company IDs, checks annual periods and selects compatible facts. It keeps mismatched figures out of comparisons. |
| `cds/reports.py` | Checks company publication records, dates, evidence and paired financial values, then imports and exports them. It keeps observations attached to their source. |

## SQL

| File | What it does and why it belongs |
| --- | --- |
| `sql/schema.sql` | Defines SQLite tables, relationships and calculation views. It stores facts separately and calculates changes and income-to-revenue ratios. |

| `sql/portfolio_queries.sql` | Queries for company growth, sector comparisons, and missing data coverage. |

## Website files

| File | What it does and why it belongs |
| --- | --- |
| `web/analysis.js` | Displays stored company analysis and supplies clearly labeled fallback explanations where needed. It turns the saved evidence and calculations into report text. |
| `web/app.js` | Connects the data and browser controls, switches pages and fills the company report sections. It makes the page respond to user actions. |
| `web/charts.js` | Draws the horizontal comparison bars from numeric values. It keeps bar lengths proportional and handles losses and missing values. |
| `web/compare.js` | Resolves the three company search boxes, checks the selections and builds comparison charts and tables. It makes the Compare page work. |
| `web/explore.js` | Manages saving companies, the saved page, directory cards and comparison selection. It keeps browser storage and visible controls synchronized. |
| `web/index.html` | Defines the search page, company tabs, saved page, comparison page and their labeled controls. It provides the page structure before data is inserted. |
| `web/profiles.js` | Renders the original ten company profiles and their charts, analysis and source cards. It keeps each original profile on its own reporting basis. |
| `web/search.js` | Standardizes search text and escapes text before it is inserted into HTML. It helps names match and keeps text from becoming page markup. |
| `web/styles.css` | Controls the layout, spacing, fonts, chart presentation and smaller-screen adjustments. It gives the demo its visual design. |

## Checks

| File | What it does and why it belongs |
| --- | --- |
| `tests/test_pipeline.py` | Checks identity matching, fiscal dates, source amounts, SQL calculations, coverage and reproducible builds. It helps prevent data-processing errors. |
| `tests/test_reports.py` | Checks company publications, financial definitions and evidence relationships. It helps prevent unsupported or mismatched report content. |
| `tests/web.test.cjs` | Checks search, tabs, report rendering, chart arithmetic, Saved and Compare using a simulated page environment. It catches interaction regressions. |

## Company data and source records

| File | What it does and why it belongs |
| --- | --- |
| `data/analysis.json` | Stores the added companies’ Deep Analysis headlines, four cards and recommended actions. It supplies the company-specific business discussion. |
| `data/curated.json` | Stores the original ten company profiles, including their figures, text and sources. It is needed to reproduce those original pages. |
| `data/downloads.json` | Records source URLs, collection details and saved-file hashes. It lets the build trace and check downloaded snapshots. |
| `data/holdings.json` | Stores the official SPY holdings rows used to check the roster tickers. It supplies an additional identity and coverage check. |
| `data/integrity.json` | Stores expected hashes for the included inputs. It lets the build detect an unexpectedly changed source file. |
| `data/publications.json` | Stores source summaries used in the company-source rendering. It keeps publication information alongside the data. |
| `data/reports.json` | Stores company publications, operating observations and any checked annual financial pairs for the added profiles. It provides their operating evidence. |
| `data/roster.json` | Stores the factual company list, tickers, sectors and company IDs used to define the saved coverage. It supplies the company directory. |
| `data/tickers.json` | Stores the SEC ticker-to-company-ID map. It lets Python connect share symbols with the right issuer. |

## Saved SEC frames

| File | What it does and why it belongs |
| --- | --- |
| `data/raw/EarningsPerShareDiluted_2024.json` | Saved SEC CY2024 frame for diluted earnings per share, in dollars per share. It supplies original input facts so the build can be repeated without downloading them again. |
| `data/raw/EarningsPerShareDiluted_2025.json` | Saved SEC CY2025 frame for diluted earnings per share, in dollars per share. It supplies original input facts so the build can be repeated without downloading them again. |
| `data/raw/NetCashProvidedByUsedInOperatingActivities_2024.json` | Saved SEC CY2024 frame for cash provided by or used in operating activities, in dollars. It supplies original input facts so the build can be repeated without downloading them again. |
| `data/raw/NetCashProvidedByUsedInOperatingActivities_2025.json` | Saved SEC CY2025 frame for cash provided by or used in operating activities, in dollars. It supplies original input facts so the build can be repeated without downloading them again. |
| `data/raw/NetIncomeLoss_2024.json` | Saved SEC CY2024 frame for reported net income or loss under this SEC accounting concept, in dollars. It supplies original input facts so the build can be repeated without downloading them again. |
| `data/raw/NetIncomeLoss_2025.json` | Saved SEC CY2025 frame for reported net income or loss under this SEC accounting concept, in dollars. It supplies original input facts so the build can be repeated without downloading them again. |
| `data/raw/OperatingIncomeLoss_2024.json` | Saved SEC CY2024 frame for operating income or loss, in dollars. It supplies original input facts so the build can be repeated without downloading them again. |
| `data/raw/OperatingIncomeLoss_2025.json` | Saved SEC CY2025 frame for operating income or loss, in dollars. It supplies original input facts so the build can be repeated without downloading them again. |
| `data/raw/PaymentsToAcquirePropertyPlantAndEquipment_2024.json` | Saved SEC CY2024 frame for cash spent on property, plant and equipment, in dollars. It supplies original input facts so the build can be repeated without downloading them again. |
| `data/raw/PaymentsToAcquirePropertyPlantAndEquipment_2025.json` | Saved SEC CY2025 frame for cash spent on property, plant and equipment, in dollars. It supplies original input facts so the build can be repeated without downloading them again. |
| `data/raw/ProfitLoss_2024.json` | Saved SEC CY2024 frame for consolidated profit or loss under this SEC accounting concept, in dollars. It supplies original input facts so the build can be repeated without downloading them again. |
| `data/raw/ProfitLoss_2025.json` | Saved SEC CY2025 frame for consolidated profit or loss under this SEC accounting concept, in dollars. It supplies original input facts so the build can be repeated without downloading them again. |
| `data/raw/RevenueFromContractWithCustomerExcludingAssessedTax_2024.json` | Saved SEC CY2024 frame for contract revenue excluding assessed tax, in dollars. It supplies original input facts so the build can be repeated without downloading them again. |
| `data/raw/RevenueFromContractWithCustomerExcludingAssessedTax_2025.json` | Saved SEC CY2025 frame for contract revenue excluding assessed tax, in dollars. It supplies original input facts so the build can be repeated without downloading them again. |
| `data/raw/RevenueFromContractWithCustomerIncludingAssessedTax_2024.json` | Saved SEC CY2024 frame for contract revenue including assessed tax, in dollars. It supplies original input facts so the build can be repeated without downloading them again. |
| `data/raw/RevenueFromContractWithCustomerIncludingAssessedTax_2025.json` | Saved SEC CY2025 frame for contract revenue including assessed tax, in dollars. It supplies original input facts so the build can be repeated without downloading them again. |
| `data/raw/RevenuesNetOfInterestExpense_2024.json` | Saved SEC CY2024 frame for revenue after interest expense under this SEC concept, in dollars. It supplies original input facts so the build can be repeated without downloading them again. |
| `data/raw/RevenuesNetOfInterestExpense_2025.json` | Saved SEC CY2025 frame for revenue after interest expense under this SEC concept, in dollars. It supplies original input facts so the build can be repeated without downloading them again. |
| `data/raw/Revenues_2024.json` | Saved SEC CY2024 frame for revenue under this SEC accounting concept, in dollars. It supplies original input facts so the build can be repeated without downloading them again. |
| `data/raw/Revenues_2025.json` | Saved SEC CY2025 frame for revenue under this SEC accounting concept, in dollars. It supplies original input facts so the build can be repeated without downloading them again. |

## Documentation

| File | What it does and why it belongs |
| --- | --- |
| `docs/architecture.md` | Explains how Python, SQLite and the browser fit together. It helps another developer follow the project. |
| `docs/companies.csv` | Provides a spreadsheet-friendly list of supported companies and their metadata. It makes the coverage easy to inspect outside the app. |
| `docs/company_reports.md` | Explains how company publications, observations and financial pairs were checked and used. It documents the research method. |
| `docs/company_sources.csv` | Lists company publications in spreadsheet-friendly form. It makes the research references easy to inspect together. |
| `docs/coverage.md` | Lists supported coverage and the excluded companies with the matching limits. It explains why every index company is not included. |
| `docs/data.md` | Explains source selection, financial definitions, dates, missing values and review limits. It tells readers how to interpret the numbers. |
| `docs/deployment.md` | Explains the first deployment, later updates, rollback and the alternative hosting option. |
| `docs/release.md` | Contains the prepared public description for the 1.0.0 GitHub release. |
| `docs/files.md` | Gives a short explanation of every source file. It makes the repository easier for someone new to understand. |
| `docs/github.md` | Explains repository setup and the publishing workflow. It gives the project a repeatable path to GitHub Pages. |
| `docs/publication_coverage.md` | Summarizes the publication review and recorded source-access coverage. It explains the scope of the saved research pass. |
| `docs/saved_compare.md` | Explains the saved list, count labels, annual comparisons and local-storage behavior. It records what those features are designed to do. |

## Generated outputs

| Generated file | Purpose |
| --- | --- |
| `dist/index.html` | The standalone website you open or publish. |
| `dist/catalog.json` | The exported company data used by the built website. |
| `dist/coverage.json` | Supported counts, exclusions and source receipts. |
| `dist/buildinfo.json` | Build metadata and the hash of the generated website. |
| `.build/companies.sqlite3` | The SQLite database assembled from saved inputs. |

These generated files stay out of normal source commits through `.gitignore`. They can be recreated by the build.

## Analysis and preview images

| File | Purpose |
| --- | --- |
| `docs/analysis_walkthrough.md` | Reproducible Costco analysis with query results and interpretation. |
| `docs/images/home.png` | Screenshot of company search and browsing. |
| `docs/images/overview.png` | Screenshot of the Nike overview. |
| `docs/images/comparison.png` | Screenshot of a three company annual comparison. |
| `docs/images/analysis.png` | Screenshot of Nike Deep Analysis. |
