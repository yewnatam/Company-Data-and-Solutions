# Company Data and Solutions 1.0.0

Company Data and Solutions is a searchable company analysis website built using Python, SQL/SQLite, JavaScript, HTML and CSS.

## Included

- 484 searchable company profiles and sector browsing.
- Browser-local Saved companies with an updating count.
- Annual comparisons for two or three companies, with dates and measure labels.
- Overview, Financials, Markets, Insights, Deep Analysis and source references.
- A reproducible data pipeline and automated checks.

## Reporting scope

The saved index roster supports 482 matched annual issuers. The original ten
profiles retain their own reporting snapshots; eight overlap the annual cohort
and two remain additional entries. Eighteen index issuers are excluded under
the matching rules. Each report displays its own period and definitions.

The website uses saved results rather than a live financial feed. Source
relationships and calculations can be checked in the code, but automated tests
do not replace a fresh audit of every company disclosure.

## Availability

Source is published for portfolio review with all rights reserved. This release
is not offered under an open-source license. Third-party material retains its
own rights and terms. See `LICENSE` and `docs/data.md`.

## Run

```bash
python3 -m cds build
```

Open `dist/index.html`. See `docs/deployment.md` for hosting and future updates.
