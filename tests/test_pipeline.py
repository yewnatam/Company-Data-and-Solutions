import hashlib
import json
import math
import re
import shutil
import sqlite3
import unittest
from html.parser import HTMLParser
from pathlib import Path
from tempfile import TemporaryDirectory

from cds.build import build, export_database, make_database, verify_sources
from cds.ingest import collect, load_sources, same_period, select_company, valid_fact

ROOT = Path(__file__).resolve().parents[1]


class PipelineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.companies, cls.excluded, cls.counts = collect(ROOT / 'data')
        cls.frames = load_sources(ROOT / 'data')
        cls.temporary = TemporaryDirectory()
        cls.db = make_database(ROOT, Path(cls.temporary.name) / 'test.sqlite3', cls.companies)
        cls.payload = export_database(cls.db, cls.counts)

    @classmethod
    def tearDownClass(cls):
        cls.db.close()
        cls.temporary.cleanup()

    def test_all_roster_listings_are_corroborated_and_issuers_are_deduplicated(self):
        self.assertEqual(self.counts['roster_companies'], 500)
        self.assertEqual(self.counts['roster_listings'], 503)
        self.assertEqual(self.counts['holdings_matched_listings'], 503)
        self.assertEqual(self.counts['supported_companies'], 482)
        self.assertEqual(self.counts['excluded_companies'], 18)
        self.assertEqual(len({c['cik'] for c in self.companies}), 482)

    def test_all_eleven_sectors_have_supported_companies(self):
        self.assertEqual(len({c['sector'] for c in self.companies}), 11)

    def test_curated_profiles_survive_sqlite_and_keep_nonindex_originals_distinct(self):
        original = json.loads((ROOT / 'data/curated.json').read_text())
        self.assertEqual(self.payload['curated'], original)
        self.assertEqual(self.payload['coverage']['total_companies'], 484)
        self.assertEqual(self.payload['coverage']['supported_companies'], 482)
        self.assertEqual(self.payload['coverage']['additional_original_companies'], 2)
        self.assertEqual({c['profile'] for c in self.payload['companies'] if isinstance(c['id'], str)}, {'tsmc', 'spacex'})

    def test_every_selected_fact_preserves_the_primary_source_value_and_dates(self):
        for company in self.companies:
            anchor = company['facts']['revenue']
            for metric, (concept, current, prior) in company['facts'].items():
                for position, fact in enumerate((current, prior)):
                    if fact is None:
                        continue
                    with self.subTest(cik=company['cik'], metric=metric, position=position):
                        self.assertEqual(fact, self.frames[concept, 2025 if position == 0 else 2024][company['cik']])
                        self.assertTrue(same_period(fact, anchor[position + 1]))
                        self.assertTrue(valid_fact(fact))

    def test_current_and_prior_use_the_same_accounting_concept_and_unit(self):
        for company in self.payload['companies']:
            for metric, fact in company.get('sec_m', company['m']).items():
                self.assertTrue(math.isfinite(fact[0]))
                self.assertTrue(fact[1] is None or math.isfinite(fact[1]))
                self.assertTrue((fact[2], 2025) in self.frames, f"Missing SEC concept: {fact[2]}")
                self.assertEqual(self.frames[fact[2], 2025][company['id']]['val'], fact[0])
                if fact[1] is not None:
                    self.assertEqual(self.frames[fact[2], 2024][company['id']]['val'], fact[1])

    def test_growth_is_calculated_in_sql_and_undefined_bases_remain_null(self):
        for row in self.db.execute('SELECT * FROM comparisons'):
            if row['prior_value'] is None or row['prior_value'] <= 0:
                self.assertIsNone(row['change_percent'])
            else:
                expected = 100 * (row['current_value'] - row['prior_value']) / row['prior_value']
                self.assertAlmostEqual(row['change_percent'], expected)

    def test_broad_revenue_concept_is_preferred_over_partial_contract_revenue(self):
        berkshire = next(c for c in self.companies if 'BRK.B' in c['tickers'])
        self.assertEqual(berkshire['facts']['revenue'][0], 'Revenues')
        self.assertEqual(berkshire['facts']['revenue'][1]['val'], 371444000000)

    def test_net_bank_revenue_is_named_by_its_actual_concept(self):
        chase = next(c for c in self.companies if 'JPM' in c['tickers'])
        self.assertEqual(chase['facts']['revenue'][0], 'RevenuesNetOfInterestExpense')

    def test_negative_income_is_retained_instead_of_discarded(self):
        losses = [(c, c.get('sec_m', c['m'])) for c in self.payload['companies']
                  if 'income' in c.get('sec_m', c['m']) and c.get('sec_m', c['m'])['income'][0] < 0]
        self.assertTrue(losses)
        for company, facts in losses:
            self.assertEqual(facts['income'][0], self.frames[facts['income'][2], 2025][company['id']]['val'])

    def test_excluded_companies_never_enter_the_search_catalog(self):
        included = {c['id'] for c in self.payload['companies']}
        self.assertTrue(all(c['cik'] not in included and c['reason'] for c in self.excluded))

    def test_foreign_keys_and_bound_alias_queries_protect_the_relational_model(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute('INSERT INTO aliases VALUES (?, ?)', ('orphan', 1))
        self.assertIsNone(self.db.execute('SELECT cik FROM aliases WHERE alias = ?', ("aapl' OR 1=1 --",)).fetchone())

    def test_every_saved_input_matches_its_checksum(self):
        verify_sources(ROOT)

    def test_nonannual_or_misaligned_periods_are_not_matched(self):
        record = dict(self.frames['NetIncomeLoss', 2025][320193])
        record['start'] = record['end']
        self.assertFalse(valid_fact(record))
        original = self.frames['NetIncomeLoss', 2025][320193]
        record = dict(original, start='2024-09-28')
        self.assertFalse(same_period(record, original))


class BuildTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temporary = TemporaryDirectory()
        cls.root = Path(cls.temporary.name)
        for folder in ('web', 'sql', 'data'):
            shutil.copytree(ROOT / folder, cls.root / folder)

    @classmethod
    def tearDownClass(cls):
        cls.temporary.cleanup()

    def test_offline_output_has_six_tabs_unique_ids_and_no_remote_runtime_assets(self):
        html = build(self.root).read_text()
        class Inventory(HTMLParser):
            def __init__(self): super().__init__(); self.ids=[]; self.assets=[]; self.tabs=[]
            def handle_starttag(self, tag, attrs):
                a=dict(attrs)
                if 'id' in a:self.ids.append(a['id'])
                if 'data-tab' in a:self.tabs.append(a['data-tab'])
                if tag in ('script','img','iframe') and 'src' in a:self.assets.append(a['src'])
        page=Inventory(); page.feed(html)
        self.assertEqual(len(page.ids),len(set(page.ids)))
        self.assertEqual(page.assets,[])
        self.assertEqual(page.tabs,['overview','financials','markets','insights','deepanalysis','sources'])
        self.assertNotIn('{{COMPANY_DATA}}',html)

    def test_rebuild_is_deterministic_and_manifest_matches(self):
        path=build(self.root); first=path.read_bytes()
        build(self.root)
        self.assertEqual(first,path.read_bytes())
        info=json.loads((path.parent/'buildinfo.json').read_text())
        self.assertEqual(info['project'],'Company Data and Solutions')
        self.assertEqual(info['site_sha256'],hashlib.sha256(first).hexdigest())

    def test_corrupt_source_keeps_previous_output(self):
        path=build(self.root); before=path.read_bytes()
        data=self.root/'data/raw/NetIncomeLoss_2025.json'; original=data.read_bytes()
        try:
            data.write_text('{}')
            with self.assertRaisesRegex(ValueError,'checksum'):
                build(self.root)
            self.assertEqual(path.read_bytes(),before)
        finally:
            data.write_bytes(original)


if __name__=='__main__':
    unittest.main()
