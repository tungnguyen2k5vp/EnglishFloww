"""Extract only selected public UI assets and grammar from the user-supplied APK."""
import hashlib
import json
from html import escape
from html.parser import HTMLParser
from pathlib import Path
import re
import zipfile

root = Path(__file__).resolve().parents[1]
apk = root.parent / '.cache/4english/v10.4.16/base.apk'
allowed = {'p', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'br', 'strong', 'b', 'i', 'em', 'u', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'blockquote', 'sub', 'sup', 'hr'}

class SafeHTML(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.output = []
        self.blocked = 0
    def handle_starttag(self, tag, attrs):
        if tag in {'script', 'style', 'iframe', 'object', 'svg'}:
            self.blocked += 1
        if self.blocked or tag not in allowed:
            return
        style = []
        for key, value in attrs:
            if key == 'style' and value:
                for declaration in value.split(';'):
                    key, _, val = declaration.partition(':')
                    if key.strip().lower() in {'color', 'background-color', 'text-align', 'font-weight', 'font-style', 'text-decoration'} and re.fullmatch(r'[a-zA-Z0-9#(),.%\s-]{1,70}', val.strip()):
                        style.append(key.strip() + ':' + val.strip())
        self.output.append('<' + tag + (' style="' + escape(';'.join(style), quote=True) + '"' if style else '') + '>')
    def handle_endtag(self, tag):
        if tag in {'script', 'style', 'iframe', 'object', 'svg'}:
            self.blocked = max(0, self.blocked - 1)
        elif not self.blocked and tag in allowed and tag not in {'br', 'hr'}:
            self.output.append('</' + tag + '>')
    def handle_data(self, data):
        if not self.blocked:
            self.output.append(escape(data))

probe = SafeHTML()
probe.feed('<script>alert(1)</script><img onerror="alert(1)"><p style="color:red;background:url(x)" onclick="x">A & B</p>')
assert ''.join(probe.output) == '<p style="color:red">A &amp; B</p>'
out = root / 'public/reference'
out.mkdir(exist_ok=True)
records = []
with zipfile.ZipFile(apk) as z:
    groups = json.loads(z.read('assets/grammar_vi.json'))
    for group in groups:
        for lesson in group['smallTopics']:
            parser = SafeHTML()
            parser.feed(lesson['content'])
            lesson['content'] = ''.join(parser.output)
    assert len(groups) == 10 and sum(len(g['smallTopics']) for g in groups) == 55
    (out / 'grammar-vi.json').write_text(json.dumps(groups, ensure_ascii=False, separators=(',', ':')), encoding='utf8')
    members = ['assets/fonts/InterTight-' + weight + '.ttf' for weight in ['Regular', 'Medium', 'SemiBold', 'Bold']]
    members += ['res/drawable-nodpi-v4/vocab_' + name + '.png' for name in ['toeic', 'ielts', 'oxford', 'toefl', 'common']]
    for member in members:
        data = z.read(member)
        (out / Path(member).name).write_bytes(data)
        records.append({'member': member, 'sha256': hashlib.sha256(data).hexdigest()})
    records.append({'member': 'assets/grammar_vi.json', 'sha256': hashlib.sha256(z.read('assets/grammar_vi.json')).hexdigest(), 'groups': 10, 'lessons': 55, 'transformation': 'HTML allowlist; scripts, URLs, event attributes, embedded images and layout styles removed'})
(root / 'docs/evidence/deep-resources.json').write_text(json.dumps({'apkSHA256': hashlib.sha256(apk.read_bytes()).hexdigest(), 'resources': records, 'excluded': ['encrypted dictionary', 'personal device database', 'account data']}, indent=2), encoding='utf8')
print('Extracted 55 sanitized lessons, 4 font weights, 5 category images.')
