"""Build source-labelled accent and example packs without replacing the three gloss packs.

Inputs: Kanjium accents.txt; the SAME Chinese Wiktionary raw snapshot used by
build_multilingual_dictionary.py; official JMdict_e_examp.gz; and Tatoeba's
jpn/cmn/eng detailed sentences plus direct jpn-cmn/jpn-eng link exports.
No model inference or machine translation is performed.
"""
import argparse
import bz2
import collections
import gzip
import hashlib
import json
import re
import unicodedata
import xml.etree.ElementTree as ET
from pathlib import Path
from build_multilingual_dictionary import norm, reading

BASE = Path(__file__).resolve().parent / 'dist' / 'dictionary'
LANG = '{http://www.w3.org/XML/1998/namespace}lang'
SMALL = set('ゃゅょぁぃぅぇぉゎ')


def morae(value):
    value = norm(value)
    if not re.fullmatch('[ぁ-ゖー]+', value):
        return []
    out = []
    for c in value:
        if c in SMALL and out:
            out[-1] += c
        else:
            out.append(c)
    return out


def same_pronunciation(written, spoken):
    """Only accept exact kana or an explicitly equivalent long-vowel spelling."""
    left, right = morae(written), morae(spoken)
    if not left or len(left) != len(right):
        return False
    vowels = ['あかがさざただなはばぱまやらわぁゃ', 'いきぎしじちぢにひびぴみりぃ',
              'うくぐすずつづぬふぶぷむゆるぅゅゔ', 'えけげせぜてでねへべぺめれぇ',
              'おこごそぞとどのほぼぽもよろをぉょ']
    previous = None
    for a, b in zip(left, right):
        if a != b:
            allowed = ['あ', 'い', 'う', 'えい', 'おう'][previous] if previous is not None else ''
            if b != 'ー' or a not in allowed:
                return False
        if b != 'ー':
            previous = next((i for i, chars in enumerate(vowels) if b[-1] in chars), None)
    return True


def roman_mora_count(roman):
    text = ''.join(c for c in unicodedata.normalize('NFD', roman.lower()) if not unicodedata.combining(c))
    text = text.replace('ꜜ', '').replace('[', '').replace(']', '')
    if not re.fullmatch("[a-z’'ː]+", text):
        return None
    count = len(re.findall('[aeiou]', text))
    # Syllabic nasal; geminate consonant (including t + ch).
    count += len(re.findall("n(?=[^aeiouy]|$)|m(?=[bmp])", text))
    count += len(re.findall(r'([bcdfghjkpqrstvwxyz])(?=\1)|t(?=ch)', text))
    if 'ː' in text:
        return None
    return count


def wiki_positions(sound, reading_text):
    tags, roman = sound.get('tags', []), sound.get('roman', '')
    size = len(morae(reading_text))
    if len(tags) != 1 or not size or not roman or ' ' in roman:
        return []
    tag = tags[0]
    if roman_mora_count(roman) != size:
        return []
    if tag == 'Heiban' and 'ꜜ' not in roman:
        return [{'n': 0}]
    if roman.count('ꜜ') != 1:
        return []
    position = roman_mora_count(roman.split('ꜜ')[0])
    if ((tag == 'Atamadaka' and position == 1) or
        (tag == 'Odaka' and position == size) or
        (tag == 'Nakadaka' and position is not None and 1 < position < size)):
        return [{'n': position}]
    return []


def kanjium_positions(text, size):
    out, label = [], ''
    for part in re.split(r'(\([^)]*\))', text):
        if not part:
            continue
        if part.startswith('('):
            label = part[1:-1]
            continue
        part = part.strip(',')
        if not re.fullmatch(r'\d+(,\d+)*', part):
            return []
        for n in map(int, part.split(',')):
            if not 0 <= n <= size:
                return []
            item = {'n': n}
            if label:
                item['label'] = label
            if item not in out:
                out.append(item)
    return out


def wiki_shape(row):
    # Reproduce the original three-pack row identity exactly; enrich separately.
    if row.get('lang_code') != 'ja' or row.get('pos') == 'romanization':
        return None
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
        return None
    word, readings = row['word'], set()
    for f in row.get('forms', []):
        if f.get('form') == word and ('canonical' in f.get('tags', []) or f.get('ruby')):
            if r := reading(f):
                readings.add(r)
    if r := reading({'form': word}):
        readings.add(r)
    w = {'t': word, 'r': sorted(readings), 'p': row.get('pos_title') or row.get('pos', ''), 's': senses}
    tags = list(dict.fromkeys(row.get('tags', []) + row.get('raw_tags', [])))
    if tags:
        w['tag'] = tags
    signature = json.dumps(w, ensure_ascii=False, sort_keys=True)
    return 'wiki-' + hashlib.sha256(signature.encode()).hexdigest()[:16]


def build_pitch(args, entries, wiki):
    by_form = collections.defaultdict(set)
    by_id = {e['id']: e for e in entries}
    for e in entries:
        for k in e['k'] + e['r']:
            by_form[norm(k['t'])].add(e['id'])
    out, stats = collections.defaultdict(list), collections.Counter()
    def add(id, item):
        if item not in out[id]:
            out[id].append(item)
            stats[item['src'] + 'Records'] += 1
    for line in Path(args.kanjium).read_text().splitlines():
        word, kana, accent = line.split('\t')
        kana = norm(kana or word)
        positions = kanjium_positions(accent, len(morae(kana)))
        if not morae(kana) or not positions:
            stats['invalidKanjium'] += 1
            continue
        ids = []
        for id in by_form.get(norm(word), []):
            e = by_id[id]
            kanji = any(norm(k['t']) == norm(word) for k in e['k'])
            if any(norm(r['t']) == kana and not (kanji and r.get('n')) and
                   (not kanji or not r.get('k') or norm(word) in map(norm, r['k'])) for r in e['r']):
                ids.append(id)
        if len(ids) == 1:
            add(ids[0], {'w': word, 'r': kana, 'p': positions, 'src': 'kanjium'})
        else:
            stats['unmatchedOrAmbiguousKanjium'] += 1
    by_wiki = {w['id']: w for w in wiki}
    opener = gzip.open if str(args.wiktionary).endswith('.gz') else open
    with opener(args.wiktionary, 'rt', encoding='utf8') as f:
        for line in f:
            row = json.loads(line)
            sounds = [s for s in row.get('sounds', []) if '東京' in s.get('raw_tags', []) and s.get('other') and s.get('roman')]
            if not sounds:
                continue
            w = by_wiki.get(wiki_shape(row))
            if not w:
                continue
            for sound in sounds:
                compatible = [r for r in w['r'] if same_pronunciation(r, sound['other'])]
                if len(compatible) != 1:
                    stats['unmatchedWikiReading'] += 1
                    continue
                kana = compatible[0]
                positions = wiki_positions(sound, kana)
                item = {'w': w['t'], 'r': kana, 'src': 'wiktionary', 'roman': sound['roman'],
                        'kind': sound.get('tags', []), 'p': positions}
                if not positions:
                    stats['wikiNotationOnly'] += 1
                add(w.get('j', w['id']), item)
    return [{'id': id, 'a': values} for id, values in sorted(out.items())], dict(stats)


def links(path, wanted):
    out = collections.defaultdict(set)
    with bz2.open(path, 'rt', encoding='utf8') as f:
        for line in f:
            a, b = line.strip().split('\t')
            if a in wanted:
                out[a].add(b)
    return out


def sentences(path, wanted, language):
    out = {}
    with bz2.open(path, 'rt', encoding='utf8') as f:
        for line in f:
            row = line.rstrip('\n').split('\t')
            if row[0] in wanted and row[1] == language:
                out[row[0]] = {'id': row[0], 't': row[2], 'a': row[3] if row[3] != '\\N' else ''}
    return out


def build_examples(args, entries):
    by_id = {e['id']: e for e in entries}
    raw = gzip.decompress(Path(args.jmdict_examples).read_bytes())
    date = re.search(rb'JMdict created: (\d{4}-\d{2}-\d{2})', raw).group(1).decode()
    root = ET.fromstring(raw)
    candidates, stats = [], collections.Counter()
    for el in root:
        id = el.findtext('ent_seq')
        e = by_id.get(id)
        if not e:
            continue
        if {k.findtext('keb') for k in el.findall('k_ele')} != {k['t'] for k in e['k']} or {r.findtext('reb') for r in el.findall('r_ele')} != {r['t'] for r in e['r']}:
            stats['identityMismatch'] += 1
            continue
        old = collections.defaultdict(list)
        for i, s in enumerate(e['s']):
            old[(tuple(g['t'] for g in s['g']), tuple(s.get('k', [])), tuple(s.get('r', [])))].append(i)
        source = []
        for s in el.findall('sense'):
            sig = (tuple(g.text or '' for g in s.findall('gloss') if g.get(LANG, 'eng') == 'eng'),
                   tuple(x.text for x in s.findall('stagk')), tuple(x.text for x in s.findall('stagr')))
            source.append((sig, s))
        counts = collections.Counter(sig for sig, s in source)
        for sig, s in source:
            if len(old.get(sig, [])) != 1 or counts[sig] != 1:
                stats['senseMismatch'] += len(s.findall('example'))
                continue
            for ex in s.findall('example'):
                srce = ex.find('ex_srce')
                if srce is None or srce.get('exsrc_type') != 'tat' or not (srce.text or '').isdigit():
                    continue
                texts = {x.get(LANG): x.text or '' for x in ex.findall('ex_sent')}
                if not texts.get('jpn') or not texts.get('eng') or len(texts['jpn']) > 240:
                    continue
                candidates.append((id, str(old[sig][0]), srce.text, texts['jpn'], texts['eng'], ex.findtext('ex_text', '')))
    del root, raw
    wanted = {c[2] for c in candidates}
    folder = Path(args.tatoeba)
    zh_links = links(folder / 'jpn-cmn_links.tsv.bz2', wanted)
    en_links = links(folder / 'jpn-eng_links.tsv.bz2', wanted)
    jp = sentences(folder / 'jpn_sentences_detailed.tsv.bz2', wanted, 'jpn')
    zh = sentences(folder / 'cmn_sentences_detailed.tsv.bz2', {x for xs in zh_links.values() for x in xs}, 'cmn')
    en = sentences(folder / 'eng_sentences_detailed.tsv.bz2', {x for xs in en_links.values() for x in xs}, 'eng')
    out = collections.defaultdict(lambda: collections.defaultdict(list))
    for id, sense, sid, ja, english, term in candidates:
        if sid not in jp or jp[sid]['t'] != ja:
            stats['changedOrMissingJapanese'] += 1
            continue
        english_rows = [en[x] for x in sorted(en_links.get(sid, []), key=int) if x in en and en[x]['t'] == english]
        if not english_rows:
            stats['changedOrUnlinkedEnglish'] += 1
            continue
        chinese_rows = [zh[x] for x in sorted(zh_links.get(sid, []), key=int) if x in zh and zh[x]['t']][:2]
        item = {'j': jp[sid], 'e': english_rows[0], 'z': chinese_rows, 'term': term}
        if not any(x['j']['id'] == sid for x in out[id][sense]):
            out[id][sense].append(item)
    result = []
    unique = set()
    for id, senses in sorted(out.items()):
        for s, rows in senses.items():
            rows.sort(key=lambda x: (not bool(x['z']), len(x['j']['t']), int(x['j']['id'])))
            senses[s] = rows[:3]
            stats['alignedSenses'] += 1
            stats['examples'] += len(senses[s])
            stats['withChinese'] += sum(bool(x['z']) for x in senses[s])
            unique.update(x['j']['id'] for x in senses[s])
        result.append({'id': id, 's': dict(senses)})
    stats['uniqueJapaneseSentences'] = len(unique)
    return result, dict(stats), date


def sha(path):
    with Path(path).open('rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()


def pack(id, date, entries, **metadata):
    data = gzip.compress(json.dumps({'date': date, 'entries': entries}, ensure_ascii=False, separators=(',', ':')).encode(), compresslevel=9, mtime=0)
    digest = hashlib.sha256(data).hexdigest()
    file = f'{id}-{date}-{digest[:12]}.json.gz'
    (BASE / file).write_bytes(data)
    return dict(id=id, date=date, entries=len(entries), file=file, bytes=len(data), sha256=digest, **metadata)


def main(args):
    manifest = json.loads((BASE / 'manifest.json').read_text())
    original = [p for p in manifest['packs'] if p['id'] in ['jmdict', 'tomoshi', 'wiktionary']]
    corpora = {p['id']: json.loads(gzip.decompress((BASE / p['file']).read_bytes()))['entries'] for p in original if p['id'] != 'tomoshi'}
    pitch, pitch_stats = build_pitch(args, corpora['jmdict'], corpora['wiktionary'])
    examples, example_stats, date = build_examples(args, corpora['jmdict'])
    assert pitch and examples, 'Empty supplement: keep the working manifest'
    pitch_meta = pack('pitch', args.date, pitch, title='音调 · Kanjium / 维基', license='CC BY-SA 4.0',
        sources=[{'name': 'Kanjium / Uros O.', 'url': 'https://github.com/mifunetoshiro/kanjium', 'sha256': sha(args.kanjium), 'retrieved': args.date},
                 {'name': 'Chinese Wiktionary / Kaikki', 'url': 'https://kaikki.org/zhwiktionary/rawdata.html', 'sha256': sha(args.wiktionary), 'date': next(p['date'] for p in original if p['id'] == 'wiktionary')}], stats=pitch_stats)
    files = ['jpn_sentences_detailed.tsv.bz2', 'cmn_sentences_detailed.tsv.bz2', 'eng_sentences_detailed.tsv.bz2', 'jpn-cmn_links.tsv.bz2', 'jpn-eng_links.tsv.bz2']
    ex_meta = pack('examples', args.date, examples, title='例句 · JMdict / Tatoeba',
        license='Text: CC BY 2.0 FR; JMdict sense associations: CC BY-SA 4.0',
        sources=[{'name': 'JMdict examples / EDRDG', 'url': 'https://www.edrdg.org/pub/Nihongo/JMdict_e_examp.gz', 'sha256': sha(args.jmdict_examples), 'date': date},
                 {'name': 'Tatoeba contributors', 'url': 'https://tatoeba.org/en/downloads', 'date': args.tatoeba_date,
                  'files': {name: sha(Path(args.tatoeba) / name) for name in files}}], stats=example_stats)
    manifest.update(schema=3, date=args.date, packs=original + [pitch_meta, ex_meta])
    manifest['bytes'] = sum(p['bytes'] for p in manifest['packs'])
    # Only publish the manifest after both complete supplements are produced.
    (BASE / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    (BASE / 'config.mjs').write_text('export const PACK = ' + json.dumps(manifest, ensure_ascii=False, separators=(',', ':')) + ';\n')
    keep = {p['file'] for p in manifest['packs']}
    for pattern in ['pitch-*.json.gz', 'examples-*.json.gz']:
        for path in BASE.glob(pattern):
            if path.name not in keep:
                path.unlink()
    print(json.dumps({'pitch': pitch_meta, 'examples': ex_meta, 'totalBytes': manifest['bytes']}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    for name in ['kanjium', 'wiktionary', 'jmdict-examples', 'tatoeba', 'date', 'tatoeba-date']:
        p.add_argument('--' + name, required=True)
    main(p.parse_args())
