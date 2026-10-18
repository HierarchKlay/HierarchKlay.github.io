"""Append reviewed weekly sources; never reassign prior lesson IDs or audio offsets."""
import gzip
import hashlib
import html
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent
JOY_URL = 'https://www.bunka.go.jp/kokugo_nihongo/sisaku/joho/joho/kijun/naikaku/kanji/joyokanjisakuin/index.html'

def norm(s):
    return ''.join(chr(ord(c)-96) if 'ァ' <= c <= 'ヶ' else c for c in unicodedata.normalize('NFKC', s))

def mora(s):
    result=[]
    for c in s:
        if c in 'ゃゅょャュョぁぃぅぇぉァィゥェォ' and result: result[-1]+=c
        else: result.append(c)
    return result

def packs():
    folder=ROOT/'dist/dictionary'
    manifest=json.loads((folder/'manifest.json').read_text())
    result={}
    for p in manifest['packs']:
        if p['id'] not in ('jmdict','pitch'): continue
        raw=(folder/p['file']).read_bytes()
        assert hashlib.sha256(raw).hexdigest()==p['sha256']
        result[p['id']]={e['id']:e for e in json.loads(gzip.decompress(raw))['entries']}
    return result,manifest

def matches(entry,word,reading):
    writings=[k['t'] for k in entry['k']]
    if word not in writings and not any(r['t']==word for r in entry['r']):return False
    return any(norm(r['t'])==norm(reading) and (not r.get('k') or word in r['k']) and (not r.get('n') or word not in writings) for r in entry['r'])

def extend_course(data):
    additions=sorted((ROOT/'source-data').glob('week02-[abc].json'))
    if not additions:return
    assert len(additions)==3,'Incomplete weekly source set'
    p,manifest=packs()
    words=sum((json.loads(f.read_text()) for f in additions),[])
    assert len(words)==315
    assert len({w['id'] for w in words})==315
    previous={norm(w['word']) for w in data['words']}
    assert not previous.intersection(norm(w['word']) for w in words),'Duplicate prior headword'
    assert len({norm(w['word']) for w in words})==315,'Duplicate batch headword'
    for w in words:
        ev=w['sourceEvidence'];entry=p['jmdict'][str(ev['jmdictId'])]
        assert matches(entry,w['word'],w['reading']),(w['word'],w['reading'])
        for i in ev['senseIndices']:
            s=entry['s'][i]
            assert not s.get('k') or w['word'] in s['k'],w['word']
            assert not s.get('r') or w['reading'] in s['r'],w['word']
        ev.update({'source':'JMdict / EDRDG','date':'2026-10-13','url':'https://www.edrdg.org/pub/Nihongo/JMdict_e.gz','entryUrl':f"https://www.edrdg.org/jmdictdb/cgi-bin/entr.py?svc=jmdict&sid=&q={entry['id']}",'license':'CC BY-SA 4.0'})
        w['mora']=mora(w['reading'])
        w.update(accent=None,accentStatus='声调未收录',accentSource='',accentUrl='')
        # Use only exact identity and unconditional numeric Kanjium records.
        # Preserve all variants and reject conditional patterns rather than guess POS.
        candidates=[a for a in p['pitch'].get(entry['id'],{}).get('a',[]) if a['src']=='kanjium' and a['w']==w['word'] and norm(a['r'])==norm(w['reading'])]
        eligible=[a for a in candidates if a.get('p') and all(set(x)=={'n'} and isinstance(x['n'],int) and 0<=x['n']<=len(w['mora']) for x in a['p'])]
        variants=list(dict.fromkeys(x['n'] for a in eligible for x in a['p']))
        if variants:
            w.update(accent=variants[0],accentStatus='已核对（辅助来源）',accentSource='Kanjium / Uros O.（辅助音调资料）',accentUrl='https://github.com/mifunetoshiro/kanjium/blob/master/data/source_files/raw/accents.txt',accentAlternatives=variants,accentEvidence={'jmdictId':entry['id'],'records':eligible,'snapshot':'2026-10-13','license':'CC BY-SA 4.0'})
        elif candidates:w['accentEvidence']={'unresolvedRecords':candidates,'reason':'需词性或其他条件判定，未自动赋值'}
        sentence=''.join(t[0] for t in w['example'])
        assert sentence==w['cloze']['before']+w['cloze']['answer']+w['cloze']['after'],w['word']
        assert sentence.count(w['cloze']['answer'])==1,w['word']
        assert all(len(t)>1 and t[1] for t in w['example'] if re.search('[一-鿿]',t[0])),w['word']
    kanji=json.loads((ROOT/'source-data/week02-kanji.json').read_text())
    assert len(kanji)==35 and not set(k['char'] for k in data['kanji']).intersection(k['char'] for k in kanji)
    themes=['家居与厨房','饮食与购物','购物与工作沟通','职场与日常动词','表达与公共交通','出行与自然','天气、健康与休闲']
    days=[]
    for i in range(7):
        group=words[i*45:(i+1)*45]
        days.append({'id':str(i+8),'number':i+8,'title':themes[i],'core':[w['id'] for w in group[:35]],'reserve':[w['id'] for w in group[35:]],'kanji':[k['id'] for k in kanji[i*5:(i+1)*5]]})
    data['words']+=words;data['days']+=days;data['kanji']+=kanji
    data['version']='0.5.0';data['title']='日々ことば · 14课'
    data['notes'][0]='现有14课，每课35个核心新词、10个备用词与独立5字汉字手帖。手动切课，不推断已学习到哪一课。'
    data['notes'][2]=data['notes'][2].replace('本周其他备用词','课程其他备用词')
    data['notes'][6]=f"第8–14课：{sum(w['accent'] is not None for w in words)}/315词有精确匹配的Kanjium辅助声调记录，保留变体；其余明确标记未收录。合成朗读不验证词典声调。"
    data['notes'].append('2026-10-18追加课程：词形、假名和选定义项对照JMdict；中文释义、例句和译文为学习用途整理，未经母语教师逐条审校。')
    data['sources'] += [['JMdict / EDRDG（词形、读音及义项核对，CC BY-SA 4.0）','https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project'],['Kanjium / Uros O.（辅助声调，CC BY-SA 4.0）','https://github.com/mifunetoshiro/kanjium'],['课程来源、许可与核验范围','course-attribution.txt']]
    (ROOT/'source-data/week02-audio-input.json').write_text(json.dumps({'words':words,'days':days},ensure_ascii=False,indent=2)+'\n')

def prepare_kanji(official_path):
    raw=Path(official_path).read_bytes();source=raw.decode('cp932')
    clean=lambda s:html.unescape(re.sub('<[^>]*>','',re.sub(r'<br\s*/?>','|',s))).strip()
    rows=[[clean(t) for t in re.findall(r'<td[^>]*>(.*?)</td>',r,re.S)] for r in re.findall(r'<tr>(.*?)</tr>',source,re.S)]
    rows={r[0][0]:r for r in rows if len(r)==4 and r[0] and re.match('[一-鿿]',r[0][0])}
    p,_=packs();index={}
    for e in p['jmdict'].values():
        for k in e['k']+e['r']:index.setdefault(k['t'],[]).append(e)
    result=[]
    for n,line in enumerate(x for x in (ROOT/'source-data/week02-kanji.tsv').read_text().splitlines() if x and not x.startswith('#')):
        char,meaning,word,reading,translation,w2,r2,t2,note=line.split('|')
        row=rows[char];reads=[x.strip() for x in row[1].split('|') if x.strip()]
        verified=[]
        for w,r,t in [(word,reading,translation),(w2,r2,t2)]:
            exact=[e for e in index.get(w,[]) if matches(e,w,r)]
            # 壱万円 is a transparent numeral+currency compound, and 茨城 is an official table place-name.
            exception=(w=='壱万円' and w in row[2]) or (w=='茨城' and '茨城県' in row[3])
            assert exact or exception,(char,w,r)
            verified.append({'word':w,'reading':r,'jmdictIds':[e['id'] for e in exact],'officialExample':exception})
        result.append({'id':f'joyo-{n+36:03}','order':n+36,'day':8+n//5,'char':char,'on':'・'.join(x for x in reads if re.match('[ァ-ヶ]',x)) or '—','kun':'・'.join(x for x in reads if re.match('[ぁ-ゖ]',x)) or '—','meaning':meaning,'hook':f'从「{word}（{reading}）」记住本字。','note':note,'examples':[[word,reading,translation],[w2,r2,t2]],'practice':{'word':word,'reading':reading,'meaning':translation,'source':'JMdict / EDRDG + 文化庁常用漢字表','sourceUrl':JOY_URL,'verified':True},'source':'文化庁《常用漢字表》音訓索引（2010年告示）','sourceUrl':JOY_URL,'referenceUrls':[JOY_URL,'https://www.edrdg.org/pub/Nihongo/JMdict_e.gz'],'verification':{'onKun':'2026-10-18对照文化庁本表，仅表内音训','officialRow':row,'officialPageSha256':hashlib.sha256(raw).hexdigest(),'examples':verified,'practiceReading':'已核对'}})
    (ROOT/'source-data/week02-kanji.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')

if __name__=='__main__':
    import sys
    prepare_kanji(sys.argv[1])
