"""Build read-only JSON shards from the pinned HocTiengTrungApp dictionary."""
import hashlib
import html
import json
from pathlib import Path
import shutil
import sqlite3
import sys
import unicodedata

root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1]) if len(sys.argv) > 1 else root.parent / 'HocTiengTrungApp/artifacts/v7-2026-10-10/sources/skypedia-388adc0'
db_path = source / 'dictionary_en_vi.db'
digest = hashlib.sha256(db_path.read_bytes()).hexdigest()
assert digest == '2b65bea9577c2a4149caa90940c806f321d1c6cfac503ed8bbd9f93e43a0033a', 'Unexpected source version'
db = sqlite3.connect(db_path.resolve().as_uri() + '?mode=ro', uri=True)
assert db.execute('PRAGMA quick_check').fetchone()[0] == 'ok'
pronunciations = {}
for word_id, ipa, region in db.execute('SELECT word_id,ipa,region FROM pronunciations ORDER BY id'):
    pronunciations.setdefault(word_id, []).append({'ipa': ipa, 'region': region or ''})
shards = {}
count = 0
for sense_id, word_id, term, meaning, pos, example in db.execute('''
    SELECT wd.id,w.id,w.word,d.definition,d.pos,wd.example FROM words w
    JOIN word_definitions wd ON w.id=wd.word_id JOIN definitions d ON d.id=wd.definition_id
    WHERE w.lang_code='en' AND d.definition_lang='vi' ORDER BY wd.id'''):
    key = ' '.join(unicodedata.normalize('NFC', term).lower().replace('’', "'").replace('ʼ', "'").split()).rstrip('.!?,;:')
    if not key or len(term) > 100 or not meaning:
        continue
    bucket = key[:2] if len(key) >= 2 and all('a' <= c <= 'z' for c in key[:2]) else '_'
    voices = pronunciations.get(word_id, [])
    row = {'id': f'sky-{sense_id}', 'term': term, 'meaning': meaning, 'pos': pos or '',
           'example': example or '', 'ipa': voices[0]['ipa'] if voices else '',
           'pronunciations': voices, 'source': 'Skypedia 388adc0 · CC BY-SA 4.0',
           'level': 'B1', 'topic': 'Cá nhân'}
    assert len(row['meaning']) <= 1000 and len(row['ipa']) <= 150 and len(row['example']) <= 1000
    shards.setdefault(bucket, {}).setdefault(key, []).append(row)
    count += 1
out = root / 'public/dictionary'
out.mkdir(parents=True, exist_ok=True)
for bucket, entries in sorted(shards.items()):
    (out / f'{bucket}.json').write_text(json.dumps(entries, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
for name in ['LICENSE', 'ATTRIBUTION.md', 'README.en.md']:
    shutil.copyfile(source / name, out / name)
(out / 'attribution.html').write_text('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>EnglishFlow dictionary attribution</title><style>body{font:16px system-ui;max-width:800px;margin:24px auto;padding:16px}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style><h1>Dictionary data</h1><p>Skypedia, commit 388adc0826300912e5b0311c089e0e70494b065f. SQLite converted to JSON shards by EnglishFlow. Definitions, examples and IPA retained. Source examples and some IPA are generated upstream. IPA is attached to headwords, not individual senses.</p><p><a href="https://github.com/skypediacode/english-vietnamese-dictionary/tree/388adc0826300912e5b0311c089e0e70494b065f">Original data and source</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a></p><pre>' + html.escape((source / 'ATTRIBUTION.md').read_text(encoding='utf-8')) + '</pre><h2>License</h2><pre>' + html.escape((source / 'LICENSE').read_text(encoding='utf-8')) + '</pre></html>', encoding='utf-8')
manifest = {'source': 'https://github.com/skypediacode/english-vietnamese-dictionary/tree/388adc0826300912e5b0311c089e0e70494b065f',
            'sha256': digest, 'headwords': sum(map(len, shards.values())), 'senses': count, 'shards': sorted(shards),
            'changes': 'SQLite converted into normalized, read-only JSON prefix shards. Original definitions, examples and IPA retained. Source examples and some IPA are generated upstream.',
            'license': 'CC BY-SA 4.0; see LICENSE and ATTRIBUTION.md for upstream notices.'}
(out / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'headwords': manifest['headwords'], 'senses': count, 'shards': len(shards), 'bytes': sum(p.stat().st_size for p in out.iterdir())}))
