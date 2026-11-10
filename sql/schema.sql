PRAGMA foreign_keys = ON;

CREATE TABLE companies (
    cik INTEGER PRIMARY KEY CHECK (cik > 0),
    name TEXT NOT NULL,
    sector TEXT NOT NULL,
    industry TEXT NOT NULL,
    tickers TEXT NOT NULL
);

CREATE TABLE aliases (
    alias TEXT PRIMARY KEY,
    cik INTEGER NOT NULL REFERENCES companies(cik)
);

CREATE TABLE curated_profiles (
    profile_key TEXT PRIMARY KEY,
    cik INTEGER REFERENCES companies(cik),
    profile_json TEXT NOT NULL
);

CREATE TABLE periods (
    cik INTEGER NOT NULL REFERENCES companies(cik),
    position INTEGER NOT NULL CHECK (position IN (0, 1)),
    start TEXT NOT NULL,
    end TEXT NOT NULL,
    PRIMARY KEY (cik, position),
    CHECK (start < end)
);

CREATE TABLE facts (
    cik INTEGER NOT NULL,
    position INTEGER NOT NULL,
    metric TEXT NOT NULL CHECK (metric IN ('revenue','income','operating','cash','capex','eps')),
    concept TEXT NOT NULL,
    value REAL NOT NULL,
    unit TEXT NOT NULL CHECK (unit IN ('USD','USD-per-shares')),
    accession TEXT NOT NULL,
    source_file TEXT NOT NULL,
    PRIMARY KEY (cik, position, metric),
    FOREIGN KEY (cik, position) REFERENCES periods(cik, position)
);

CREATE TABLE company_reports (
    cik INTEGER PRIMARY KEY REFERENCES companies(cik),
    period_end TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('verified','partial','unavailable')),
    headline TEXT NOT NULL,
    focus_title TEXT NOT NULL,
    focus_text TEXT NOT NULL,
    notes TEXT NOT NULL
);

CREATE TABLE report_sources (
    cik INTEGER NOT NULL REFERENCES company_reports(cik),
    source_id TEXT NOT NULL,
    url TEXT NOT NULL CHECK (url LIKE 'https://%'),
    title TEXT NOT NULL,
    publisher TEXT NOT NULL,
    published TEXT NOT NULL,
    period_end TEXT NOT NULL,
    kind TEXT NOT NULL,
    access TEXT NOT NULL CHECK (access IN ('opened','search_excerpt')),
    PRIMARY KEY (cik, source_id),
    UNIQUE (cik, url)
);

CREATE TABLE report_evidence (
    cik INTEGER NOT NULL,
    position INTEGER NOT NULL CHECK (position BETWEEN 0 AND 3),
    source_id TEXT NOT NULL,
    label TEXT NOT NULL,
    observation TEXT NOT NULL,
    implication TEXT NOT NULL,
    action TEXT NOT NULL,
    tone TEXT NOT NULL CHECK (tone IN ('high','medium','positive')),
    metric_label TEXT NOT NULL,
    metric_value TEXT NOT NULL,
    PRIMARY KEY (cik, position),
    FOREIGN KEY (cik, source_id) REFERENCES report_sources(cik, source_id)
);

CREATE TABLE published_financials (
    cik INTEGER NOT NULL,
    metric TEXT NOT NULL CHECK (metric IN ('revenue','income','operating','cash','capex','eps')),
    current_value REAL NOT NULL,
    prior_value REAL NOT NULL,
    label TEXT NOT NULL,
    unit TEXT NOT NULL CHECK (unit IN ('USD','USD-per-shares')),
    source_id TEXT NOT NULL,
    PRIMARY KEY (cik, metric),
    FOREIGN KEY (cik, source_id) REFERENCES report_sources(cik, source_id)
);

CREATE TABLE business_analyses (
    cik INTEGER PRIMARY KEY REFERENCES company_reports(cik),
    headline TEXT NOT NULL,
    summary TEXT NOT NULL,
    focus_title TEXT NOT NULL,
    focus_text TEXT NOT NULL
);

CREATE TABLE analysis_cards (
    cik INTEGER NOT NULL REFERENCES business_analyses(cik),
    position INTEGER NOT NULL CHECK (position BETWEEN 0 AND 3),
    label TEXT NOT NULL,
    tone TEXT NOT NULL CHECK (tone IN ('high','medium','positive')),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    actions_json TEXT NOT NULL,
    PRIMARY KEY (cik, position)
);

CREATE TABLE analysis_evidence (
    cik INTEGER NOT NULL,
    card_position INTEGER NOT NULL,
    evidence_position INTEGER NOT NULL,
    PRIMARY KEY (cik, card_position, evidence_position),
    FOREIGN KEY (cik, card_position) REFERENCES analysis_cards(cik, position),
    FOREIGN KEY (cik, evidence_position) REFERENCES report_evidence(cik, position)
);

CREATE TABLE bank_revenue_components (
    cik INTEGER NOT NULL,
    position INTEGER NOT NULL CHECK (position IN (0,1)),
    component TEXT NOT NULL CHECK (component IN ('net_interest_income','noninterest_income')),
    value REAL NOT NULL,
    source_id TEXT NOT NULL,
    PRIMARY KEY (cik, position, component),
    FOREIGN KEY (cik, source_id) REFERENCES report_sources(cik, source_id)
);

CREATE VIEW company_financial_pairs AS
SELECT cik, metric, current_value, prior_value, label, unit, source_id, 'published' AS method
FROM published_financials
UNION ALL
SELECT b.cik, 'revenue',
       SUM(CASE WHEN b.position = 0 THEN b.value ELSE 0 END),
       SUM(CASE WHEN b.position = 1 THEN b.value ELSE 0 END),
       'Net interest + noninterest income (calculated)', 'USD', MIN(b.source_id), 'sum_components'
FROM bank_revenue_components AS b
WHERE NOT EXISTS (SELECT 1 FROM published_financials AS p WHERE p.cik = b.cik AND p.metric = 'revenue')
GROUP BY b.cik
HAVING COUNT(*) = 4 AND COUNT(DISTINCT b.source_id) = 1;

CREATE VIEW comparisons AS
SELECT a.cik, a.metric, a.concept, a.unit,
       a.value AS current_value, b.value AS prior_value,
       a.accession AS current_accession, b.accession AS prior_accession,
       a.source_file AS current_source, b.source_file AS prior_source,
       a.value - b.value AS absolute_change,
       CASE WHEN b.value > 0
            THEN 100.0 * (a.value - b.value) / b.value END AS change_percent
FROM facts AS a
LEFT JOIN facts AS b ON b.cik = a.cik AND b.metric = a.metric
                       AND b.concept = a.concept AND b.position = 1
WHERE a.position = 0;

CREATE VIEW income_ratios AS
SELECT a.cik, a.position,
       100.0 * a.value / b.value AS income_to_revenue_percent
FROM facts AS a
JOIN facts AS b ON b.cik = a.cik AND b.position = a.position AND b.metric = 'revenue'
WHERE a.metric = 'income' AND b.value > 0;

CREATE VIEW reported_comparisons AS
SELECT p.cik, p.metric, p.label AS concept, p.unit,
       p.current_value, p.prior_value,
       NULL AS current_accession, NULL AS prior_accession,
       p.source_id AS current_source, p.source_id AS prior_source,
       p.current_value - p.prior_value AS absolute_change,
       CASE WHEN p.prior_value > 0
            THEN 100.0 * (p.current_value - p.prior_value) / p.prior_value END AS change_percent
FROM company_financial_pairs AS p
UNION ALL
SELECT c.* FROM comparisons AS c
WHERE NOT EXISTS (
    SELECT 1 FROM company_financial_pairs AS p WHERE p.cik = c.cik AND p.metric = c.metric
);

CREATE VIEW reported_income_ratios AS
SELECT a.cik, 0 AS position, 100.0 * a.current_value / b.current_value AS income_to_revenue_percent
FROM reported_comparisons AS a
JOIN reported_comparisons AS b ON a.cik = b.cik AND b.metric = 'revenue'
WHERE a.metric = 'income' AND b.current_value > 0
UNION ALL
SELECT a.cik, 1 AS position, 100.0 * a.prior_value / b.prior_value AS income_to_revenue_percent
FROM reported_comparisons AS a
JOIN reported_comparisons AS b ON a.cik = b.cik AND b.metric = 'revenue'
WHERE a.metric = 'income' AND b.prior_value > 0;
