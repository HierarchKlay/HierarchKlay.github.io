"""Build the curated first-week course from reviewable source records."""
import json,re,random
from pathlib import Path
ROOT=Path(__file__).resolve().parent
def mora(reading):
    out=[]
    for c in reading:
        if c in 'ゃゅょャュョぁぃぅぇぉァィゥェォ' and out:out[-1]+=c
        else:out.append(c)
    return out
def main():
    groups=[json.loads((ROOT/'source-data'/name).read_text()) for name in ['nouns.json','verbs.json','other.json']]
    words=sum(groups,[]);assert len(words)==315
    assert len({w['id'] for w in words})==315
    assert len({(w['word'],w['reading']) for w in words})==315
    sample=json.loads((ROOT/'source-data/sample-v2.json').read_text())
    old={w['id']:w for w in sample['words']}
    accents={x['id']:x for x in json.loads((ROOT/'source-data/other-accents.json').read_text()) if isinstance(x.get('accent'),int)}
    noun_accents=ROOT/'source-data/noun-accents.json'
    if noun_accents.exists():accents.update({x['id']:x for x in json.loads(noun_accents.read_text()) if isinstance(x.get('accent'),int)})
    patch=ROOT/'source-data/accent-patch-v4.json'
    if patch.exists():accents.update({x['id']:x for x in json.loads(patch.read_text()) if isinstance(x.get('accent'),int)})
    for w in words:
        if w['id'] in accents:w.update(accents[w['id']])
        if w['id'] in old:
            o=old[w['id']]
            assert o['reading']==w['reading'] and o['word']==w['word']
            for key in ['accent','mora','accentSource','accentUrl','corpus']:
                if key in o:w[key]=o[key]
            w['accentStatus']='已核对'
        w['mora']=mora(w['reading'])
        assert w['accent'] is None or 0<=w['accent']<=len(w['mora']),w['word']
        assert ''.join(t[0] for t in w['example'])==w['cloze']['before']+w['cloze']['answer']+w['cloze']['after'],w['word']
        assert w['cloze']['answer']
    buckets={cat:[w['id'] for w in words if w['category']==cat] for cat in ['名词','动词','い形容词','な形容词','副词']}
    expressions=[w['id'] for w in words if w['category'] not in buckets]
    assert [len(buckets[k]) for k in buckets]==[105,70,35,35,35]
    assert len(expressions)==35
    days=[]
    for i in range(7):
        core=buckets['名词'][i*10:i*10+10]+buckets['动词'][i*5:i*5+5]+buckets['い形容词'][i*5:i*5+5]+buckets['な形容词'][i*5:i*5+5]+buckets['副词'][i*5:i*5+5]+expressions[i*5:i*5+5]
        reserve=buckets['名词'][70+i*5:75+i*5]+buckets['动词'][35+i*5:40+i*5]
        # Stable seeded order supplies variety without changing the daily lesson on reload.
        random.Random(710+i).shuffle(core)
        days.append({'id':str(i+1),'number':i+1,'core':core,'reserve':reserve})
    ids=[x for d in days for x in d['core']+d['reserve']]
    assert len(set(ids))==315 and len(ids)==315
    verified=sum(isinstance(w['accent'],int) for w in words)
    data={'id':'week01-v1','version':'0.3.0','dailyGoal':35,'title':'日々ことば · 第一周','words':words,'days':days,'kanji':sample['kanji'],'notes':[
        '首批 7 课，每课 35 新词与 10 备用词，共 315 个不同词条。课程手动切换；不设置提醒。',
        '选词沿用日常实用与高频优先的方向，按词性人工编排并固定打乱，不是 BCCWJ 词频前 315 名，也不是老师课程的逐条复刻。',
        '完全掌握会从新词与复习中排除；先补入本课备用词，再借用本周其他备用词，不挪用其他课的核心词。备用池有限，用尽会提示。',
        '记住了仍安排复习：3、7、14、30、60 天；有点印象隔天，再看一次当天。实际安排按北京时间日期计算。',
        '学习进度先保存在当前浏览器；配置云同步并登录后可跨设备合并，也可导出 JSON 备份。',
        '汉字小注只列部分常用音训和字义，不等于本词中每个字的实际读法。遇到熟字训或音变，以整词读音为准。',
        f'本批 {verified} / 315 词已有声调来源记录；其他词标记“待核对”。有多种读法时本卡只展示所选一种。设备试听为合成语音，不保证复现卡上音调。',
        '例句、译文和填空为学习用途编写，未经母语教师逐条审校。填空给出目标词读音；其他词可能也能构成自然句。',
        '下载的 PDF 是第 1 课固定版本（35 核心词 + 10 备用词）。打印本课会包含当前补位后的词目；不包含网页的动态复习状态。'
    ],'sources':[
        ['NINJAL BCCWJ 短单位词频表 v1.1（选词背景参考）','https://doi.org/10.15084/00003219'],
        ['OJAD 东京大学 在线日语重音辞典','https://www.gavo.t.u-tokyo.ac.jp/ojad/'],
        ['ゆっくり 声调：Wiktionary（辅助来源）','https://en.wiktionary.org/wiki/ゆっくり'],
        ['文化庁 常用漢字表 音训索引','https://www.bunka.go.jp/kokugo_nihongo/sisaku/joho/joho/kijun/naikaku/kanji/joyokanjisakuin/index.html'],
        ['NINJAL 拟声拟态词资料','https://www2.ninjal.ac.jp/Onomatope/']
    ]}
    data['version']='0.4.0'
    data['kanji']=json.loads((ROOT/'source-data/kanji-v4.json').read_text())
    assert len(data['kanji'])==35
    assert len({k['char'] for k in data['kanji']})==35
    for i,d in enumerate(data['days']):d['kanji']=[k['id'] for k in data['kanji'][i*5:(i+1)*5]]
    data['notes'][0]='首批 7 课，每课 35 新词、10 备用词与独立的 5 字汉字手帖。课程手动切换；每日北京时间 12:40 为约定学习时间。'
    data['notes'][3]='记住后按 1、3、7、14、30、60 天安排复习；有点印象隔天，再看一次当天。提前练习不升级间隔。词汇与汉字分别排期，按北京时间计算。这是启发式间隔规则，不是对个人遗忘曲线的测量。'
    data['notes'][6]=f'本批 {verified} / 315 词有可追溯声调记录；其余标记“声调未收录”，不表示没有声调。多种声调时展示所选一种，来源记录保留其他变体。合成音频不保证复现词典声调。'
    data['notes'].append('汉字手帖按常用汉字表顺序独立编排，每天 5 字，与词卡汉字小注分开。读音按表内音训；词组的音变、熟字训按整词记忆。')
    data['notes'].append('学习记录不上传公开仓库。配置云同步并登录后可合并设备记录，也可手动导入备份。图表只计算实际事件，不补造旧学习日期。')
    audio_manifest=ROOT/'dist/audio/manifest.json'
    if audio_manifest.exists():data['audio']=json.loads(audio_manifest.read_text())
    data['sources'].append(['国際交流基金 まるごと 词汇索引（部分声调）','https://marugoto.jpf.go.jp/'])
    if 'audio' in data:data['sources'].append(['合成音频署名与许可','audio/ATTRIBUTION.txt'])
    from extend_course import extend_course
    extend_course(data)
    (ROOT/'dist/lesson.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
    from build_kanji_pitch import write_kanji_pitch
    write_kanji_pitch(data)
    print(json.dumps({'words':len(data['words']),'days':len(data['days']),'core':sum(len(d['core']) for d in data['days']),'reserve':sum(len(d['reserve']) for d in data['days']),'accent_verified':sum(isinstance(w['accent'],int) for w in data['words'])},ensure_ascii=False))
if __name__=='__main__':main()
