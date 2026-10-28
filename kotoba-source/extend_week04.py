"""Append the November 1 edition, prepared early on October 28, without editing history."""
import json
import re
from extend_course import ROOT, packs, matches, norm, mora

THEMES = ['天气、地理与动物', '动植物与材料', '环境与人际关系', '情绪与性格',
          '表达与日常动作', '动作与物品变化', '电脑与日常服务']

def extend_week04(data):
    files = [ROOT / f'source-data/week04-{part}.json' for part in 'abc']
    assert all(f.exists() for f in files), 'Incomplete week 4 source set'
    assert len(data['days']) == 21 and len(data['words']) == 945
    packed, manifest = packs()
    words = sum((json.loads(f.read_text()) for f in files), [])
    assert len(words) == 315 and len({w['id'] for w in words}) == 315
    assert not {w['id'] for w in data['words']}.intersection(w['id'] for w in words)
    heads = [norm(w['word']) for w in data['words'] + words]
    assert len(set(heads)) == len(heads), 'Duplicate normalized headword'
    index = {}
    for entry in packed['jmdict'].values():
        for form in entry['k'] + entry['r']:
            index.setdefault(form['t'], []).append(entry)
    prior_lexemes = {(e['id'], norm(w['reading'])) for w in data['words']
                    for e in index.get(w['word'], []) if matches(e, w['word'], w['reading'])}
    new_lexemes = set()
    for w in words:
        evidence = w['sourceEvidence']
        entry = packed['jmdict'][str(evidence['jmdictId'])]
        assert matches(entry, w['word'], w['reading']), w['word']
        lexeme = (entry['id'], norm(w['reading']))
        assert lexeme not in prior_lexemes and lexeme not in new_lexemes, ('Duplicate lexeme/reading', w['word'])
        new_lexemes.add(lexeme)
        assert evidence['senseIndices']
        for i in evidence['senseIndices']:
            sense = entry['s'][i]
            assert not sense.get('k') or w['word'] in sense['k'], w['word']
            assert not sense.get('r') or w['reading'] in sense['r'], w['word']
        expected_glosses = [[g['t'] for g in entry['s'][i]['g']] for i in evidence['senseIndices']]
        recorded_glosses = evidence['glosses']
        assert recorded_glosses in (expected_glosses, sum(expected_glosses, [])), ('Stale sense evidence', w['word'])
        evidence.update(source='JMdict / EDRDG', date='2026-10-13', reviewed='2026-10-28',
            url='https://www.edrdg.org/pub/Nihongo/JMdict_e.gz',
            entryUrl=f"https://www.edrdg.org/jmdictdb/cgi-bin/entr.py?svc=jmdict&sid=&q={entry['id']}",
            license='CC BY-SA 4.0')
        w['mora'] = mora(w['reading'])
        w.update(accent=None, accentStatus='声调未收录', accentSource='', accentUrl='')
        candidates = [a for a in packed['pitch'].get(entry['id'], {}).get('a', [])
                      if a['src'] == 'kanjium' and a['w'] == w['word'] and norm(a['r']) == norm(w['reading'])]
        eligible = [a for a in candidates if a.get('p') and all(
            set(x) == {'n'} and isinstance(x['n'], int) and 0 <= x['n'] <= len(w['mora']) for x in a['p'])]
        variants = list(dict.fromkeys(x['n'] for a in eligible for x in a['p']))
        if variants:
            w.update(accent=variants[0], accentStatus='已核对（辅助来源）',
                accentSource='Kanjium / Uros O.（辅助音调资料）',
                accentUrl='https://github.com/mifunetoshiro/kanjium/blob/master/data/source_files/raw/accents.txt',
                accentAlternatives=variants,
                accentEvidence={'jmdictId':entry['id'], 'records':eligible, 'snapshot':'2026-10-13', 'license':'CC BY-SA 4.0'})
        elif candidates:
            w['accentEvidence'] = {'unresolvedRecords':candidates, 'reason':'需词性或其他条件判定，未自动赋值'}
        sentence = ''.join(t[0] for t in w['example'])
        assert sentence == w['cloze']['before'] + w['cloze']['answer'] + w['cloze']['after'], w['word']
        assert w['cloze']['answer'] and sentence.count(w['cloze']['answer']) == 1, w['word']
        assert all(len(t) > 1 and t[1] for t in w['example'] if re.search('[一-鿿]', t[0])), w['word']
    kanji = json.loads((ROOT / 'source-data/week04-kanji.json').read_text())
    assert len(kanji) == 35 and [k['order'] for k in kanji] == list(range(106, 141))
    assert not {k['char'] for k in data['kanji']}.intersection(k['char'] for k in kanji)
    days = []
    for i in range(7):
        group = words[i * 45:(i + 1) * 45]
        days.append({'id':str(i + 22), 'number':i + 22, 'title':THEMES[i],
            'core':[w['id'] for w in group[:35]], 'reserve':[w['id'] for w in group[35:]],
            'kanji':[k['id'] for k in kanji[i * 5:(i + 1) * 5]]})
    data['words'] += words
    data['days'] += days
    data['kanji'] += kanji
    data.update(version='0.7.0', title='日々ことば · 28课')
    data['notes'][0] = '现有28课，每课35个核心新词、10个备用词与独立5字汉字手帖。手动切课，不推断已学习到哪一课。'
    count = sum(w['accent'] is not None for w in words)
    data['notes'].append(f'2026-10-28提前追加第22–28课（11月1日批次）：{count}/315词有精确匹配的Kanjium辅助声调记录；其余明确标记未收录。例句与译文原创，未经母语教师逐条审校。')
    (ROOT / 'source-data/week04-audio-input.json').write_text(json.dumps({'words':words, 'days':days}, ensure_ascii=False, indent=2) + '\n')

