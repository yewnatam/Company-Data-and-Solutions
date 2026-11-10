-- Run after: python3 -m cds build
-- Database: .build/companies.sqlite3
-- These queries use the same published/SEC fallback views as annual comparisons.

-- 1. How did Costco's revenue and earnings change?
SELECT
    c.name,
    current_period.end AS current_year_end,
    prior_period.end AS prior_year_end,
    r.metric,
    r.concept AS measure_definition,
    ROUND(r.current_value / 1000000000.0, 3) AS current_usd_billions,
    ROUND(r.prior_value / 1000000000.0, 3) AS prior_usd_billions,
    ROUND(r.change_percent, 2) AS change_percent
FROM companies AS c
JOIN reported_comparisons AS r ON r.cik = c.cik
JOIN periods AS current_period ON current_period.cik = c.cik AND current_period.position = 0
JOIN periods AS prior_period ON prior_period.cik = c.cik AND prior_period.position = 1
WHERE c.cik = 909832 AND r.metric IN ('revenue', 'income')
ORDER BY r.metric;

-- 2. Which Consumer Staples companies had rising revenue and falling income?
-- Same sector narrows the comparison, but fiscal dates and business models still differ.
SELECT
    c.name,
    p.end AS current_year_end,
    revenue.concept AS revenue_definition,
    ROUND(revenue.change_percent, 2) AS revenue_change_percent,
    ROUND(income.absolute_change / 1000000000.0, 3) AS income_change_usd_billions,
    ROUND(ratio.income_to_revenue_percent, 2) AS income_to_revenue_percent
FROM companies AS c
JOIN periods AS p ON p.cik = c.cik AND p.position = 0
JOIN reported_comparisons AS revenue ON revenue.cik = c.cik AND revenue.metric = 'revenue'
JOIN reported_comparisons AS income ON income.cik = c.cik AND income.metric = 'income'
JOIN reported_income_ratios AS ratio ON ratio.cik = c.cik AND ratio.position = 0
WHERE c.sector = 'Consumer Staples'
  AND revenue.change_percent > 0
  AND income.absolute_change < 0
ORDER BY revenue.change_percent DESC, c.name;

-- 3. How complete is annual operating cash-flow coverage within each sector?
-- LEFT JOIN retains companies with no cash-flow fact. Missing is not zero.
SELECT
    c.sector,
    COUNT(*) AS companies,
    COUNT(cash.current_value) AS current_cash_flow_available,
    COUNT(cash.prior_value) AS paired_cash_flow_available,
    ROUND(100.0 * COUNT(cash.prior_value) / COUNT(*), 1) AS paired_coverage_percent
FROM companies AS c
LEFT JOIN reported_comparisons AS cash ON cash.cik = c.cik AND cash.metric = 'cash'
GROUP BY c.sector
ORDER BY paired_coverage_percent, c.sector;
