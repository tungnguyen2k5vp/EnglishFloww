"""Fetch pinned Apache-2.0 phoneme weights and BSD CMU lexicon for Android.

Run once before build: python scripts/prepare-assessment.py
Weights stay outside public/dist: the web build does not download a mobile model.
"""
import hashlib
import json
from pathlib import Path
import re
import shutil
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'android/app/src/main/assets/assessment'
MODEL = 'onnx-community/wav2vec2-lv-60-espeak-cv-ft-ONNX'
REVISION = 'c69750f5043e5e1f8a71ab95dd3b98338c280c92'
MODEL_HASH = 'f020386a4f730675b59f833af1581c7a0fa2f1e1c48adcf526e5c3c96115f772'
CMU_REVISION = '74790861f652b15e4ac49015a90074ad62a27690'


def fetch(url, path, expected=None, limit=260_000_000):
    if path.exists() and (expected is None or hashlib.sha256(path.read_bytes()).hexdigest() == expected):
        return path.read_bytes()
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix('.part')
    try:
        with urllib.request.urlopen(url, timeout=60) as response, temp.open('wb') as target:
            count = 0
            while chunk := response.read(1024 * 1024):
                count += len(chunk)
                if count > limit:
                    raise ValueError('Assessment asset exceeds size limit')
                target.write(chunk)
        data = temp.read_bytes()
        if expected and hashlib.sha256(data).hexdigest() != expected:
            raise ValueError('Assessment asset hash mismatch')
        temp.replace(path)
        return data
    finally:
        temp.unlink(missing_ok=True)


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    base = f'https://huggingface.co/{MODEL}/resolve/{REVISION}/'
    model = fetch(base + 'onnx/model_q4.onnx', OUT / 'phonemes.onnx', MODEL_HASH)
    vocab_path = OUT / ('vocab-' + REVISION[:8] + '.json')
    vocab = json.loads(fetch(base + 'vocab.json', vocab_path))
    (OUT / 'vocab.json').write_text(json.dumps(vocab, ensure_ascii=False), encoding='utf-8')
    source = ROOT / 'artifacts/cmudict.dict'
    raw = fetch(f'https://raw.githubusercontent.com/cmusphinx/cmudict/{CMU_REVISION}/cmudict.dict', source, limit=8_000_000)
    fetch(f'https://raw.githubusercontent.com/cmusphinx/cmudict/{CMU_REVISION}/LICENSE', OUT / 'CMUDICT-LICENSE.txt')
    fetch('https://www.apache.org/licenses/LICENSE-2.0.txt', OUT / 'APACHE-2.0.txt', limit=30_000)
    phones = dict(zip('AA AE AH AO AW AY B CH D DH EH ER EY F G HH IH IY JH K L M N NG OW OY P R S SH T TH UH UW V W Y Z ZH'.split(),
                          'ɑː æ ʌ ɔː aʊ aɪ b tʃ d ð ɛ ɚ eɪ f ɡ h ɪ iː dʒ k l m n ŋ oʊ ɔɪ p ɹ s ʃ t θ ʊ uː v w j z ʒ'.split()))
    lexicon = {}
    for line in raw.decode('utf-8').splitlines():
        parts = line.split()
        term = parts[0] if parts else ''
        if not re.fullmatch(r"[a-z]+(?:'[a-z]+)?", term) or term in lexicon:
            continue
        sequence = []
        for phone in parts[1:]:
            if phone.startswith('#'):
                break
            ipa = 'ə' if phone == 'AH0' else phones.get(phone.rstrip('012'))
            if ipa not in vocab:
                raise ValueError('Unknown CMU phoneme: ' + phone)
            sequence.append(vocab[ipa])
        if sequence:
            lexicon[term] = sequence
    (OUT / 'lexicon.json').write_text(json.dumps(lexicon, separators=(',', ':')), encoding='utf-8')
    metadata = {'model': MODEL, 'revision': REVISION, 'sha256': MODEL_HASH, 'bytes': len(model), 'license': 'Apache-2.0',
                'baseModel': 'facebook/wav2vec2-lv-60-espeak-cv-ft', 'lexicon': 'cmusphinx/cmudict', 'lexiconRevision': CMU_REVISION,
                'lexiconLicense': 'BSD-2-Clause', 'lexiconSha256': hashlib.sha256((OUT / 'lexicon.json').read_bytes()).hexdigest(), 'lexiconChanges': 'Selected alphabetic headwords; first pronunciation; stress stripped; ARPAbet converted to model IPA token IDs.', 'headwords': len(lexicon), 'sampleRate': 16000,
                'method': 'Quantized phoneme CTC acoustic posteriors, forced alignment and posterior practice index. Not human-calibrated, accent-neutral, prosody or examination scoring.'}
    (OUT / 'sources.json').write_text(json.dumps(metadata, indent=2) + '\n', encoding='utf-8')
    public = ROOT / 'public/content'
    public.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(OUT / 'sources.json', public / 'assessment-sources.json')
    for name in ['APACHE-2.0.txt', 'CMUDICT-LICENSE.txt']:
        shutil.copyfile(OUT / name, public / name)
    print(json.dumps(metadata))
