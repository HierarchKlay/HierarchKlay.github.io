"""Build small, attributed Chinese supplements to the existing JMdict pack.

python3 build_multilingual_dictionary.py --tomoshi /path/tomoshi.db \
  --wiktionary /path/raw-wiktextract-data.jsonl.gz --wiki-date YYYY-MM-DD

Only exact JMdict English-sense matches receive a Tomoshi translation. Wiki
entries keep their own senses and are linked only by unambiguous word+reading.
No model is invoked. The upstream downloads remain outside this repository.
"""
import argparse
import collections
import gzip
import hashlib
import json
import re
import sqlite3
import unicodedata
from pathlib import Path

BASE = Path(__file__).resolve().parent / 'dist' / 'dictionary'


def norm(s):
    return ''.join(chr(ord(c)-0x60) if 'ァ' <= c <= 'ヶ' else c
                   for c in unicodedata.normalize('NFKC', s).strip()).lower()


def packed(name, date, entries, **metadata):
    raw = json.dumps({'date': date, 'entries': entries}, ensure_ascii=False,
                     separators=(',', ':')).encode()
    blob = gzip.compress(raw, compresslevel=9, mtime=0)
    sha = hashlib.sha256(blob).hexdigest()
    file = f'{name}-{date}-{sha[:12]}.json.gz'
    (BASE / file).write_bytes(blob)
    for old in BASE.glob(f'{name}-*.json.gz'):
        if old.name != file:
            old.unlink()
    return dict(id=name, date=date, entries=len(entries), file=file,
                bytes=len(blob), sha256=sha, **metadata)


def reading(form):
    text = form.get('form', '')
    # Replace ruby bases sequentially, retaining the kana between kanji.
    cursor, result = 0, ''
    for base, kana in form.get('ruby', []):
        pos = text.find(base, cursor)
        if pos < 0:
            return ''
        result += text[cursor:pos] + kana
        cursor = pos + len(base)
    result += text[cursor:]
    result = norm(result)
    return result if re.fullmatch(r'[ぁ-ゖー・]+', result) else ''


def build(args):
    old = json.loads((BASE / 'manifest.json').read_text())
    jm = next(p for p in old['packs'] if p['id'] == 'jmdict') if old.get('packs') else old
    jm = dict(jm, id='jmdict', title='JMdict 英文原义')
    entries = json.loads(gzip.decompress((BASE / jm['file']).read_bytes()))['entries']
    byid = {e['id']: e for e in entries}
    byword = collections.defaultdict(set)
    for e in entries:
        for k in e['k'] + e['r']:
            byword[norm(k['t'])].add(e['id'])

    db = sqlite3.connect(f'file:{Path(args.tomoshi).resolve()}?mode=ro', uri=True)
    assert db.execute('pragma quick_check').fetchall() == [('ok',)], 'Tomoshi integrity check failed'
    licences = dict(db.execute('select table_name, license from table_licenses'))
    assert all(licences.get(t) == 'CC-BY-SA-4.0' for t in ['entries', 'zh_defs'])
    tomoshi_date = dict(db.execute('select * from meta'))['exported_at'][:10]
    translations, stats = [], collections.Counter()
    for id, source, data in db.execute('select e.id,e.data,z.data from entries e join zh_defs z on z.entry_id=e.id where z.locale="zh-CN"'):
        e = byid.get(id)
        if not e:
            stats['missingEntry'] += 1
            continue
        source, data = json.loads(source), json.loads(data)
        source_readings = {norm(x['text']) for x in source['kana']}
        source_spellings = {norm(x['text']) for x in source['kanji']}
        if not source_readings.intersection(norm(x['t']) for x in e['r']) or (e['k'] and not source_spellings.intersection(norm(x['t']) for x in e['k'])):
            stats['changedIdentity'] += 1
            continue
        signatures = collections.defaultdict(list)
        for i, sense in enumerate(e['s']):
            signatures[tuple(g['t'] for g in sense['g'])].append(i)
        senses = {}
        source_counts = collections.Counter(tuple(g['text'] for g in s['glosses'] if g.get('lang') == 'eng') for s in source['senses'])
        for i, s in enumerate(source['senses']):
            english = tuple(g['text'] for g in s['glosses'] if g.get('lang') == 'eng')
            match = signatures.get(english, [])
            zh = data.get('senses', {}).get(str(i), {})
            gloss = list(dict.fromkeys(g['text'] for g in zh.get('glosses', []) if g.get('text')))
            if len(match) != 1 or source_counts[english] != 1 or not gloss:
                stats['unmatchedSense'] += 1
                continue
            # Sense restrictions/labels always come from the current JMdict.
            # Orphan example translations and other app-only fields are excluded.
            senses[str(match[0])] = {'g': gloss}
            stats['alignedSenses'] += 1
        if senses:
            translations.append({'id': id, 's': senses})
    db.close()
    tomoshi = packed('tomoshi', tomoshi_date, translations, title='Tomoshi 中文辅助释义',
                     license='CC BY-SA 4.0', source='https://github.com/tomoshi-app/tomoshi-dict-data',
                     sourceSha256=hashlib.file_digest(Path(args.tomoshi).open('rb'), 'sha256').hexdigest(),
                     alignment=dict(stats))

    wiktionary, dedup = [], set()
    opener = gzip.open if str(args.wiktionary).endswith('.gz') else open
    with opener(args.wiktionary, 'rt', encoding='utf-8') as f:
        for line in f:
            row = json.loads(line)
            if row.get('lang_code') != 'ja' or row.get('pos') == 'romanization':
                continue
            senses = []
            for s in row.get('senses', []):
                gloss = list(dict.fromkeys(g.strip() for g in s.get('glosses', []) if g.strip()))
                if not gloss or 'no-gloss' in s.get('tags', []):
                    continue
                out = {'g': gloss}
                tags = list(dict.fromkeys(s.get('tags', []) + s.get('raw_tags', [])))
                if tags:
                    out['t'] = tags
                examples = [{'j': x['text'], 'z': x.get('translation', '')}
                            for x in s.get('examples', []) if x.get('text') and not x.get('ref')][:2]
                if examples:
                    out['ex'] = examples
                senses.append(out)
            if not senses:
                continue
            word = row['word']
            readings = set()
            for form in row.get('forms', []):
                if form.get('form') == word and ('canonical' in form.get('tags', []) or form.get('ruby')):
                    if r := reading(form):
                        readings.add(r)
            if r := reading({'form': word}):
                readings.add(r)
            w = {'t': word, 'r': sorted(readings), 'p': row.get('pos_title') or row.get('pos', ''), 's': senses}
            tags = list(dict.fromkeys(row.get('tags', []) + row.get('raw_tags', [])))
            if tags:
                w['tag'] = tags
            signature = json.dumps(w, ensure_ascii=False, sort_keys=True)
            if signature in dedup:
                continue
            dedup.add(signature)
            w['id'] = 'wiki-' + hashlib.sha256(signature.encode()).hexdigest()[:16]
            candidates = []
            for id in byword.get(norm(word), []):
                e = byid[id]
                is_kanji = any(norm(k['t']) == norm(word) for k in e['k'])
                compatible = {norm(r['t']) for r in e['r'] if not (is_kanji and r.get('n')) and (not r.get('k') or word in r['k'])}
                if readings and readings.issubset(compatible):
                    candidates.append(id)
            if len(candidates) == 1:
                w['j'] = candidates[0]
            wiktionary.append(w)
    wiktionary.sort(key=lambda w: (w['t'], w['r'], w['id']))
    wiki = packed('wiktionary', args.wiki_date, wiktionary, title='维基词典 中文释义',
                  license='CC BY-SA 4.0', source='https://kaikki.org/zhwiktionary/rawdata.html',
                  sourceSha256=hashlib.file_digest(Path(args.wiktionary).open('rb'), 'sha256').hexdigest(),
                  linkedEntries=sum('j' in w for w in wiktionary),
                  standaloneEntries=sum('j' not in w for w in wiktionary))
    packs = [jm, tomoshi, wiki]
    meta = {'schema': 2, 'date': max(p['date'] for p in packs), 'entries': len(entries),
            'bytes': sum(p['bytes'] for p in packs), 'packs': packs}
    (BASE / 'manifest.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2)+'\n')
    (BASE / 'config.mjs').write_text('export const PACK = '+json.dumps(meta, ensure_ascii=False, separators=(',', ':'))+';\n')
    print(json.dumps(meta, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--tomoshi', required=True)
    parser.add_argument('--wiktionary', required=True)
    parser.add_argument('--wiki-date', required=True)
    build(parser.parse_args())
