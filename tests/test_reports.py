import copy
import json
import sqlite3
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from cds.analysis import import_analyses
from cds.build import export_database, make_database
from cds.ingest import collect
from cds.reports import import_reports

ROOT = Path(__file__).resolve().parents[1]


class CompanyReportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.companies, _, cls.counts = collect(ROOT / 'data')
        cls.temporary = TemporaryDirectory()
        cls.db = make_database(ROOT, Path(cls.temporary.name) / 'reports.sqlite3', cls.companies)
        cls.payload = export_database(cls.db, cls.counts)
        cls.saved = json.loads((ROOT / 'data/reports.json').read_text())
        cls.analyses = json.loads((ROOT / 'data/analysis.json').read_text())

    @classmethod
    def tearDownClass(cls):
        cls.db.close()
        cls.temporary.cleanup()

    def test_each_observation_has_a_company_source_for_the_displayed_fiscal_year(self):
        companies = {c['id']: c for c in self.payload['companies']}
        self.assertTrue(self.saved)
        for report in self.saved:
            company = companies[report['id']]
            self.assertNotIn('profile', company)
            self.assertEqual(report['period_end'], company['p'][0][1])
            sources = {s['id']: s for s in report['sources']}
            for item in report['evidence']:
                source = sources[item['source_id']]
                self.assertEqual(source['period_end'], report['period_end'])
                self.assertTrue(source['url'].startswith('https://'))
                self.assertNotIn('sec.gov/', source['url'])
            if report['status'] == 'verified':
                self.assertEqual(len(report['evidence']), 4)
                self.assertTrue(all(s['access'] == 'opened' for s in report['sources']))
                self.assertTrue(all(item.get('metric_label') and item.get('metric_value') for item in report['evidence']))

    def test_all_additional_companies_have_an_explicit_research_status(self):
        expected = {c['id'] for c in self.payload['companies'] if not c.get('profile')}
        self.assertEqual(len(expected), 474)
        self.assertEqual({r['id'] for r in self.saved}, expected)
        self.assertEqual({int(cik) for cik, report in self.payload['reports'].items() if 'analysis' in report}, expected)

    def test_published_pairs_use_sql_changes_and_keep_original_sec_values(self):
        companies = {c['id']: c for c in self.payload['companies']}
        for row in self.db.execute('SELECT * FROM published_financials'):
            company = companies[row['cik']]
            fact = company['m'][row['metric']]
            self.assertEqual(fact[:2], [row['current_value'], row['prior_value']])
            self.assertEqual(company['labels'][row['metric']], row['label'])
            self.assertIn('sec_m', company)
            self.assertAlmostEqual(fact[6], row['current_value'] - row['prior_value'])
            if row['prior_value'] > 0:
                self.assertAlmostEqual(fact[5], 100 * fact[6] / row['prior_value'])
            else:
                self.assertIsNone(fact[5])

    def test_income_ratios_use_the_displayed_definitions_in_both_years(self):
        for company in self.payload['companies']:
            if not company['m']:
                continue
            for position in (0, 1):
                expected = 100 * company['m']['income'][position] / company['m']['revenue'][position]
                self.assertAlmostEqual(company['r'][position], expected)

    def test_calculated_bank_revenue_uses_all_four_gaap_components(self):
        for report in self.saved:
            components = report.get('revenue_components')
            if not components:
                continue
            row = self.db.execute("SELECT * FROM company_financial_pairs WHERE cik = ? AND metric = 'revenue'", (report['id'],)).fetchone()
            self.assertEqual(row['method'], 'sum_components')
            self.assertEqual(row['current_value'], sum(components['current'].values()))
            self.assertEqual(row['prior_value'], sum(components['prior'].values()))
            self.assertIn('calculated', row['label'])

    def test_sql_does_not_allow_an_observation_to_point_to_another_company(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO report_evidence VALUES (?,0,'missing','x','x','x','x','medium','','')", (1,))

    def check_rejected(self, change, message):
        report = copy.deepcopy(next(r for r in self.saved if r['status'] == 'verified'))
        change(report)
        with TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'data').mkdir()
            (root / 'data/reports.json').write_text(json.dumps([report]))
            db = sqlite3.connect(':memory:')
            db.row_factory = sqlite3.Row
            db.executescript((ROOT / 'sql/schema.sql').read_text())
            db.execute('INSERT INTO companies VALUES (?, ?, ?, ?, ?)', (report['id'], 'Test issuer', 'Sector', 'Industry', '[]'))
            end = next(c['p'][0][1] for c in self.payload['companies'] if c['id'] == report['id'])
            db.execute('INSERT INTO periods VALUES (?, 0, ?, ?)', (report['id'], '2025-01-01', end))
            try:
                with self.assertRaisesRegex(ValueError, message):
                    import_reports(db, root)
            finally:
                db.close()

    def test_quarterly_evidence_cannot_enter_an_annual_report(self):
        self.check_rejected(lambda r: r['sources'][0].update(period_end='2026-06-30'), 'period or access')

    def test_unopened_publications_cannot_be_claimed_as_verified(self):
        self.check_rejected(lambda r: r['sources'][0].update(access='search_excerpt'), 'unopened')

    def test_adjusted_earnings_cannot_replace_gaap_financials(self):
        def change(report):
            report['financials'] = {'income': {'current': 2, 'prior': 1, 'label': 'Adjusted net income',
                                             'unit': 'USD', 'source_id': report['sources'][0]['id']}}
        self.check_rejected(change, 'Adjusted amount')

    def test_unsafe_urls_cannot_enter_source_links(self):
        self.check_rejected(lambda r: r['sources'][0].update(url='javascript:alert(1)'), 'Unsafe')

    def check_analysis_rejected(self, change, message):
        analysis = copy.deepcopy(self.analyses[0])
        report = next(r for r in self.saved if r['id'] == analysis['id'])
        change(analysis)
        with TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'data').mkdir()
            (root / 'data/reports.json').write_text(json.dumps([report]))
            (root / 'data/analysis.json').write_text(json.dumps([analysis]))
            db = sqlite3.connect(':memory:')
            db.row_factory = sqlite3.Row
            db.executescript((ROOT / 'sql/schema.sql').read_text())
            db.execute('INSERT INTO companies VALUES (?, ?, ?, ?, ?)', (report['id'], 'Test issuer', 'Sector', 'Industry', '[]'))
            db.execute('INSERT INTO periods VALUES (?, 0, ?, ?)', (report['id'], '2025-01-01', report['period_end']))
            try:
                import_reports(db, root)
                with self.assertRaisesRegex(ValueError, message):
                    import_analyses(db, root)
            finally:
                db.close()

    def test_business_cards_require_three_distinct_actions(self):
        for items in (['Only one action'], ['Same action'] * 3):
            with self.subTest(items=items):
                self.check_analysis_rejected(lambda a: a['cards'][0].update(items=items), 'three distinct actions')

    def test_business_cards_cannot_reference_unknown_evidence(self):
        for evidence in ([4], [True]):
            with self.subTest(evidence=evidence):
                self.check_analysis_rejected(lambda a: a['cards'][0].update(evidence=evidence), 'valid company evidence')

    def test_business_cards_keep_source_urls_in_sources(self):
        self.check_analysis_rejected(lambda a: a['cards'][0].update(text='See https://example.com/report'), 'URLs belong in Sources')


if __name__ == '__main__':
    unittest.main()
