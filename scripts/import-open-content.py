"""Bounded, cached import from public APIs; only reviewed IDs reach the app.

python scripts/import-open-content.py --fetch   # refresh candidate metadata
python scripts/import-open-content.py           # build from pinned local cache
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'artifacts/open-content-2026-10-25'
OUT = ROOT / 'public/content'
DATE = '2026-10-25'
AGENT = 'EnglishFlowContentBuilder/2.0 (bounded educational open-content import)'
TOPICS = {
    'Học tập': 'school|study|learn|English',
    'Du lịch': 'travel|hotel|ticket|station|train',
    'Công việc': 'work|office|meeting|job|email',
    'Đời sống': 'home|family|breakfast|dinner|coffee',
    'Giao tiếp': 'please|help|thank|question|understand',
    'Thiên nhiên': 'weather|rain|garden|tree|water',
}
ALLOWED = {'api.tatoeba.org', 'downloads.tatoeba.org', 'en.wikipedia.org', 'science.nasa.gov', 'raw.githubusercontent.com', 'api.github.com'}
TEXT_LICENSES = {'CC BY 2.0 FR', 'CC0 1.0'}
AUDIO_LICENSES = {'CC BY 4.0', 'CC BY 3.0', 'CC BY 2.0', 'CC0 1.0'}


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8'))


def save_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + '.tmp')
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temp.replace(path)


def download(url, refresh=False, max_bytes=5_000_000):
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != 'https' or parsed.hostname not in ALLOWED:
        raise ValueError('Source URL is outside the import allowlist')
    key = hashlib.sha256(url.encode()).hexdigest()
    file = CACHE / (key + '.bin')
    meta = CACHE / (key + '.json')
    if not refresh and file.exists() and meta.exists():
        data = file.read_bytes()
        assert hashlib.sha256(data).hexdigest() == read_json(meta)['sha256'], 'Corrupt source cache'
        return data, read_json(meta)
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': AGENT}), timeout=30) as response:
                if urllib.parse.urlparse(response.url).hostname not in ALLOWED:
                    raise ValueError('Unexpected download redirect')
                data = response.read(max_bytes + 1)
                if len(data) > max_bytes:
                    raise ValueError('Source exceeds import size limit')
                info = {'url': url, 'resolved_url': response.url, 'retrieved_on': DATE, 'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data), 'content_type': response.headers.get('Content-Type', '')}
            CACHE.mkdir(parents=True, exist_ok=True)
            file.write_bytes(data)
            save_json(meta, info)
            time.sleep(0.35)
            return data, info
        except urllib.error.HTTPError as error:
            if error.code not in {429, 500, 502, 503, 504} or attempt == 2:
                raise
            time.sleep(min(5, 1 + attempt * 2))
        except (TimeoutError, urllib.error.URLError):
            if attempt == 2:
                raise
            time.sleep(1 + attempt)


def candidates(refresh=False):
    result = {}
    for topic, query in TOPICS.items():
        params = {'lang': 'eng', 'trans:lang': 'vie', 'trans:is_direct': 'yes', 'trans:is_unapproved': 'no', 'trans:is_orphan': 'no', 'is_unapproved': 'no', 'is_orphan': 'no', 'sort': 'words', 'word_count': '5-14', 'limit': 50, 'include': 'audios', 'q': query}
        raw, _ = download('https://api.tatoeba.org/v1/sentences?' + urllib.parse.urlencode(params), refresh)
        for row in json.loads(raw)['data']:
            translations = [t for t in row.get('translations', []) if t['lang'] == 'vie' and t.get('is_direct') and not t.get('is_unapproved') and t.get('owner') and t.get('license') in TEXT_LICENSES]
            if row.get('license') not in TEXT_LICENSES or row.get('is_unapproved') or not row.get('owner') or not translations:
                continue
            text = row['text']
            if not 15 <= len(text) <= 180 or re.search(r'\b(kill|murder|suicide|sex|naked|drunk|war|gun|hate)\b', text, re.I):
                continue
            result.setdefault(str(row['id']), {**row, 'translations': translations, 'topic': topic})
    params = {'lang': 'eng', 'owner': 'rul', 'has_audio': 'yes', 'is_unapproved': 'no', 'sort': 'words', 'word_count': '4-12', 'limit': 50, 'include': 'audios', 'showtrans:lang': 'vie', 'showtrans:is_direct': 'yes'}
    raw, _ = download('https://api.tatoeba.org/v1/sentences?' + urllib.parse.urlencode(params), refresh)
    for row in json.loads(raw)['data']:
        if row['license'] in TEXT_LICENSES and any(a['license'] in AUDIO_LICENSES for a in row.get('audios', [])):
            result.setdefault(str(row['id']), {**row, 'topic': 'Giao tiếp'})
    save_json(CACHE / 'candidates.json', result)
    return result


def build():
    editorial = read_json(ROOT / 'content/editorial.json')
    expansion = read_json(ROOT / 'content/expansion.json')
    rows = read_json(CACHE / 'candidates.json')
    approved = editorial['approved_sentences']
    assert approved and len(approved) <= 300
    selected, credits, media = [], [], []
    packs, pack_words = [], []
    for pack in read_json(ROOT / 'content/packs.json') + expansion['packs']:
        word_ids = []
        for entry in pack['rows']:
            term, pos, meaning, example = entry.split('|')
            dictionary = read_json(ROOT / 'public/dictionary' / (term[:2] + '.json'))
            aliases = {'N': {'N', 'noun', 'danh từ'}, 'V': {'V', 'verb', 'động từ'}, 'A': {'A', 'adjective', 'tính từ'}}
            source = next((w for w in dictionary.get(term, []) if w['pos'] in aliases[pos]), None)
            if term == 'download' and not source:
                source = dictionary[term][0]  # Editorial correction: the source labels this verb as a noun.
            if not source:
                raise ValueError('Missing dictionary sense: ' + term + ' / ' + pos)
            word_id = 'lib-word-' + pack['id'] + '-' + term
            word_ids.append(word_id)
            pack_words.append({**source, 'id': word_id, 'pos': {'N': 'danh từ', 'V': 'động từ', 'A': 'tính từ'}[pos], 'meaning': meaning, 'example': example, 'level': pack['level'], 'topic': pack['topic'], 'source': 'Skypedia 388adc0 / EnglishFlow adapted · CC BY-SA 4.0'})
        packs.append({'id': 'lib-pack-' + pack['id'], 'name': pack['name'], 'description': 'Nghĩa và ví dụ được EnglishFlow biên tập theo chủ đề; phiên âm từ Skypedia. CC BY-SA 4.0. Trình độ do EnglishFlow ước lượng.', 'level': pack['level'], 'topic': pack['topic'], 'wordIds': word_ids})
    credits.append({'id': 'skypedia-packs', 'title': 'Từ điển và bộ từ theo chủ đề', 'provider': 'Skypedia', 'url': 'https://github.com/skypediacode/english-vietnamese-dictionary/tree/388adc0826300912e5b0311c089e0e70494b065f', 'author': 'Skypedia and upstream contributors; EnglishFlow editorial adaptations', 'license': 'CC BY-SA 4.0', 'licenseUrl': 'https://creativecommons.org/licenses/by-sa/4.0/', 'changes': 'Selected headwords and pronunciation; topic-specific Vietnamese meanings and English examples rewritten by EnglishFlow. Adapted packs CC BY-SA 4.0. Full upstream attribution bundled in /dictionary/ATTRIBUTION.md.', 'retrieved': DATE})
    for sentence_id in approved:
        row = rows[str(sentence_id)]
        vi = next((t for t in row.get('translations', []) if t['lang'] == 'vie' and t.get('is_direct') and t.get('owner') and not t.get('is_unapproved') and t.get('license') in TEXT_LICENSES), None)
        if str(sentence_id) in editorial.get('translations', {}):
            vi = {'text': editorial['translations'][str(sentence_id)], 'owner': 'EnglishFlow', 'id': 'editorial', 'license': 'CC BY 4.0'}
        assert vi, 'Missing reviewed Vietnamese translation'
        credit_id = 'tatoeba-' + str(row['id'])
        assert row['license'] in TEXT_LICENSES and vi['license'] in TEXT_LICENSES | {'CC BY 4.0'}
        item = {'id': credit_id, 'en': row['text'], 'vi': vi['text'], 'topic': row['topic'], 'level': 'A2', 'credit': credit_id}
        selected.append(item)
        credits.append({'id': credit_id, 'title': row['text'], 'provider': 'Tatoeba', 'url': 'https://tatoeba.org/en/sentences/show/' + str(row['id']), 'author': row['owner'] + ' (EN); ' + vi['owner'] + ' (VI #' + str(vi['id']) + ')', 'license': row['license'], 'licenseUrl': 'https://creativecommons.org/licenses/by/2.0/fr/' if row['license'] != 'CC0 1.0' else 'https://creativecommons.org/publicdomain/zero/1.0/', 'translationLicense': vi['license'], 'translationUrl': 'https://tatoeba.org/en/sentences/show/' + str(vi['id']) if vi['id'] != 'editorial' else 'https://creativecommons.org/licenses/by/4.0/', 'changes': 'Original English text retained; Vietnamese ' + ('translated by EnglishFlow.' if vi['id'] == 'editorial' else 'direct translation retained.'), 'retrieved': DATE})
        if str(sentence_id) not in editorial['approved_audio']:
            continue
        audio_id = editorial['approved_audio'][str(sentence_id)]
        audio = next(a for a in row['audios'] if a['id'] == audio_id)
        assert audio['license'] in AUDIO_LICENSES, 'Audio license is independent from text license'
        raw, meta = download('https://api.tatoeba.org/v1/audios/' + str(audio_id) + '/file', max_bytes=2_000_000)
        assert meta['content_type'].startswith('audio/'), 'Expected an audio file'
        path = OUT / 'audio' / (str(audio_id) + '.mp3')
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(raw)
        item['audio'] = '/content/audio/' + path.name
        audio_credit = credit_id + '-audio'
        credits.append({'id': audio_credit, 'title': 'Audio: ' + row['text'], 'provider': 'Tatoeba', 'url': audio['attribution_url'], 'author': audio['author'], 'license': audio['license'], 'licenseUrl': 'https://creativecommons.org/licenses/by/4.0/' if audio['license'] == 'CC BY 4.0' else 'https://creativecommons.org/publicdomain/zero/1.0/' if audio['license'] == 'CC0 1.0' else 'https://creativecommons.org/licenses/by/' + audio['license'].split()[-1] + '/', 'changes': 'Unmodified original recording.', 'retrieved': DATE, 'sha256': meta['sha256'], 'asset': item['audio']})
        duration = editorial['audio_durations'][credit_id]
        options = [item['vi'], 'Tôi chưa quyết định ngày khởi hành.', 'Họ sẽ sửa chiếc xe vào ngày mai.', 'Cuốn sách này thuộc về thư viện.']
        offset = row['id'] % len(options)
        options = options[offset:] + options[:offset]
        media.append({'id': credit_id, 'title': row['text'], 'description': 'Nghe bản thu của cộng tác viên Tatoeba, luyện chính tả và nhắc lại. Bản dịch được ghi nguồn ở cuối bài.', 'level': 'A2', 'topic': row['topic'], 'type': 'audio', 'src': item['audio'], 'duration': '0:' + str(round(duration)).zfill(2), 'scene': 'travel' if row['topic'] == 'Du lịch' else 'garden' if row['topic'] == 'Thiên nhiên' else 'morning', 'segments': [{'start': 0, 'end': duration, 'en': item['en'], 'vi': item['vi']}], 'questions': [{'prompt': 'Chọn nghĩa đúng của câu vừa nghe.', 'options': options, 'answer': item['vi'], 'explanation': item['en'] + ' — ' + item['vi']}], 'credits': [credit_id, audio_credit]})
    for reading in editorial['articles']:
        url = reading['sourceUrl']
        raw, info = download(reading.get('fetchUrl', url))
        assert len(raw) > 100, 'Missing reading source'
        credit_id = reading['id'] + '-source'
        if reading['provider'] == 'Wikimedia':
            page = next(iter(json.loads(raw)['query']['pages'].values()))
            url = 'https://en.wikipedia.org/w/index.php?oldid=' + str(page['revisions'][0]['revid'])
        credits.append({'id': credit_id, 'title': reading['sourceTitle'], 'provider': reading['provider'], 'url': url, 'author': reading['sourceAuthor'], 'license': reading['sourceLicense'], 'licenseUrl': reading['licenseUrl'], 'changes': 'EnglishFlow bilingual teaching adaptation, simplified language and original comprehension questions. No source photos, logos or third-party media reused.', 'retrieved': DATE, 'sha256': info['sha256']})
        reading['credits'] = [credit_id]
    original_credit = 'englishflow-curriculum-1-7'
    credits.append({'id': original_credit, 'title': 'EnglishFlow: mở rộng thư viện A2–B2', 'provider': 'EnglishFlow', 'url': 'https://creativecommons.org/licenses/by/4.0/', 'author': 'EnglishFlow', 'license': 'CC BY 4.0', 'licenseUrl': 'https://creativecommons.org/licenses/by/4.0/', 'changes': 'Original bilingual practice sentences, fictional readings, prompts, models, dialogues and grammar exercises; not news reports or official exam materials.', 'retrieved': DATE})
    assessment = read_json(ROOT / 'public/content/assessment-sources.json')
    credits.extend([
        {'id': 'phoneme-model', 'title': 'Wav2Vec2 phoneme acoustic model, quantized ONNX', 'provider': 'Meta AI / ONNX Community', 'url': 'https://huggingface.co/' + assessment['model'] + '/tree/' + assessment['revision'], 'author': 'Meta AI; ONNX Community conversion', 'license': 'Apache-2.0', 'licenseUrl': 'https://www.apache.org/licenses/LICENSE-2.0', 'changes': 'Pinned upstream Q4 weights, bundled in Android only. EnglishFlow adds forced alignment and an uncalibrated acoustic practice index, not examination or prosody scoring.', 'retrieved': DATE, 'sha256': assessment['sha256'], 'nativeAsset': 'assessment/phonemes.onnx'},
        {'id': 'cmu-lexicon', 'title': 'CMU pronunciation lexicon', 'provider': 'Carnegie Mellon', 'url': 'https://github.com/cmusphinx/cmudict/tree/' + assessment['lexiconRevision'], 'author': 'Carnegie Mellon University and CMU Sphinx contributors', 'license': 'BSD-2-Clause', 'licenseUrl': 'https://github.com/cmusphinx/cmudict/blob/' + assessment['lexiconRevision'] + '/LICENSE', 'changes': assessment['lexiconChanges'], 'retrieved': DATE, 'sha256': assessment['lexiconSha256'], 'nativeAsset': 'assessment/lexicon.json'}
    ])
    for row in expansion['sentences']:
        key, topic, level, en, vi = row.split('|')
        selected.append({'id': 'ef-sentence-' + key, 'en': en, 'vi': vi, 'topic': topic, 'level': level, 'credit': original_credit})
    for article in expansion['articles']:
        article['credits'] = [original_credit]
    # ponytail: reviewed catalog stays below 1 MB; split into paged content files at that ceiling.
    data = {'sentences': selected, 'media': media, 'packs': packs, 'words': pack_words, 'articles': [{k: v for k, v in a.items() if k not in {'sourceUrl', 'fetchUrl', 'sourceTitle', 'provider', 'sourceAuthor', 'sourceLicense', 'licenseUrl'}} for a in editorial['articles']] + expansion['articles'], 'credits': credits, 'writing': expansion['writing'], 'speaking': expansion['speaking'], 'grammar': expansion['grammar']}
    assert len({s['id'] for s in selected}) == len(selected), 'Duplicate sentence IDs'
    assert len({s['en'].casefold() for s in selected}) == len(selected), 'Duplicate English sentences'
    assert len({p['id'] for p in packs}) == len(packs), 'Duplicate pack IDs'
    assert len(json.dumps(data, ensure_ascii=False).encode('utf-8')) < 1_000_000, 'Catalog paging ceiling reached'
    save_json(OUT / 'catalog.json', data)
    generated = '// Generated by scripts/import-open-content.py; reviewed IDs in content/editorial.json.\nimport type { Article, MediaLesson, Collection, Word } from "./model.ts";\n'
    generated += 'export const openContent = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n'
    generated += 'export const openArticles = openContent.articles as Article[];\nexport const openMedia = openContent.media as MediaLesson[];\nexport const libraryPacks = openContent.packs as Collection[];\nexport const libraryWords = openContent.words as Word[];\n'
    (ROOT / 'src/open-content-data.ts').write_text(generated, encoding='utf-8')
    wordlist = set()
    for shard in (ROOT / 'public/dictionary').glob('*.json'):
        values = read_json(shard)
        if isinstance(values, dict):
            wordlist.update(key for key, value in values.items() if isinstance(value, list) and value and isinstance(value[0], dict) and 'term' in value[0] and re.fullmatch(r"[a-z]+(?:'[a-z]+)?", key))
    assert len(wordlist) > 50000, 'Missing spelling lexicon'
    save_json(OUT / 'wordlist.json', sorted(wordlist))
    save_json(OUT / 'manifest.json', {'version': 2, 'retrieved': DATE, 'selection': 'Reviewed bilingual pairs and original EnglishFlow practice; direct or credited editorial translations; per-audio license allowlist. Topic pack meanings/examples edited by EnglishFlow. Levels estimated, not certified CEFR.', 'packs': len(packs), 'words': len(pack_words), 'sentences': len(selected), 'media': len(media), 'articles': len(data['articles']), 'spellingHeadwords': len(wordlist), 'sourceRequests': [read_json(p) for p in sorted(CACHE.glob('*.json')) if p.name != 'candidates.json' and 'url' in read_json(p)], 'credits': credits})
    print(json.dumps({key: len(data[key]) for key in ['sentences', 'media', 'articles', 'packs', 'words', 'writing', 'speaking', 'grammar', 'credits']}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--fetch', action='store_true')
    args = parser.parse_args()
    if args.fetch:
        data = candidates(True)
        print('Candidates:', len(data))
        for row in data.values():
            print(row['id'], row['topic'], row['text'], '|', row.get('translations', [{}])[0].get('text', '') if row.get('translations') else '', '|', [(a['id'], a['license']) for a in row.get('audios', []) if a['license'] in AUDIO_LICENSES])
    else:
        build()
