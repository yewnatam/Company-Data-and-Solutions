"""Validate business recommendations and retain their underlying evidence relationships."""

import json
import re

from .reports import required_text

LABELS = {'What stands out', 'What could improve', 'What is working', 'Risk to watch'}
PRIORITIES = {'high': 'High priority', 'medium': 'Medium priority', 'positive': 'Positive'}


def import_analyses(db, root):
    analyses = json.loads((root / 'data/analysis.json').read_text(encoding="utf-8"))
    seen = set()
    for analysis in analyses:
        cik = analysis['id']
        known = {row[0] for row in db.execute('SELECT position FROM report_evidence WHERE cik = ?', (cik,))}
        if cik in seen or not known:
            raise ValueError(f'Unexpected or duplicate business analysis: {cik}')
        seen.add(cik)
        fields = [required_text(analysis, key) for key in ('headline', 'summary', 'focusTitle', 'focusText')]
        cards = analysis['cards']
        if not isinstance(cards, list) or len(cards) != 4:
            raise ValueError(f'Business analysis requires four cards: {cik}')
        db.execute('INSERT INTO business_analyses VALUES (?, ?, ?, ?, ?)', (cik, *fields))
        used = set()
        for position, card in enumerate(cards):
            if card['label'] not in LABELS or card['tone'] not in PRIORITIES:
                raise ValueError(f'Invalid business priority: {cik}')
            title, body = (required_text(card, key) for key in ('title', 'text'))
            actions = card['items']
            if not isinstance(actions, list) or len(actions) != 3 or any(not isinstance(a, str) or not a.strip() for a in actions) or len(set(actions)) != 3:
                raise ValueError(f'Business card requires three distinct actions: {cik}')
            evidence = card['evidence']
            if not isinstance(evidence, list) or not evidence or any(type(index) is not int or index not in known for index in evidence):
                raise ValueError(f'Business card lacks valid company evidence: {cik}')
            if re.search(r'https?://|www\.', ' '.join([*fields, title, body, *actions]), re.I):
                raise ValueError(f'Source URLs belong in Sources, not business analysis: {cik}')
            db.execute('INSERT INTO analysis_cards VALUES (?, ?, ?, ?, ?, ?, ?)',
                       (cik, position, card['label'], card['tone'], title, body, json.dumps(actions, ensure_ascii=False)))
            db.executemany('INSERT INTO analysis_evidence VALUES (?, ?, ?)',
                           [(cik, position, index) for index in sorted(set(evidence))])
            used.update(evidence)
        if used != known:
            raise ValueError(f'Business analysis omits a reported observation: {cik}')
    expected = {row[0] for row in db.execute('SELECT DISTINCT cik FROM report_evidence')}
    if seen != expected:
        raise ValueError(f'Missing business analyses for {len(expected - seen)} companies')


def export_analyses(db):
    result = {}
    for row in db.execute('SELECT * FROM business_analyses ORDER BY cik'):
        cards = []
        for card in db.execute('SELECT * FROM analysis_cards WHERE cik = ? ORDER BY position', (row['cik'],)):
            cards.append({'label': card['label'], 'tone': card['tone'], 'priority': PRIORITIES[card['tone']],
                          'title': card['title'], 'text': card['body'], 'items': json.loads(card['actions_json'])})
        result[str(row['cik'])] = {'headline': row['headline'], 'summary': row['summary'],
                                 'focusTitle': row['focus_title'], 'focusText': row['focus_text'], 'cards': cards}
    return result
