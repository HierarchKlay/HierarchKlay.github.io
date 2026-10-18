"""Merge a fully checked new sprite batch without changing prior audio entries."""
import hashlib
import json
from pathlib import Path
import shutil

ROOT=Path(__file__).resolve().parent
DEST=ROOT.parent/'dist/audio'
new=json.loads((ROOT/'sprites/audio-sprites.json').read_text())
old=json.loads((DEST/'manifest.json').read_text())
audit=json.loads((ROOT/'audio-manifest.json').read_text())
assert audit['fileCount']==630 and audit['wordCount']==315
assert new['lessonSha256']==audit['lessonSha256']
assert len(new['files'])==7 and len(new['clips'])==630
assert [f['file'] for f in new['files']]==[f'day-{i:02}.mp3' for i in range(8,15)]
for f in new['files']:
    raw=(ROOT/'sprites'/f['file']).read_bytes()
    assert hashlib.sha256(raw).hexdigest()==f['sha256'] and len(raw)==f['bytes']
    existing=next((x for x in old['files'] if x['file']==f['file']),None)
    assert existing is None or existing==f,'Refusing to replace an installed sprite'
for ident,clip in new['clips'].items():
    assert ident not in old['clips'] or old['clips'][ident]==clip,'Refusing to move installed offsets'
for f in new['files']:
    shutil.copyfile(ROOT/'sprites'/f['file'],DEST/f['file'])
    if not any(x['file']==f['file'] for x in old['files']):old['files'].append(f)
old['clips'].update(new['clips'])
old['totalBytes']=sum(f['bytes'] for f in old['files'])
old.setdefault('batches',[{'days':[1,7],'inputSha256':old['lessonSha256']}])
if not any(b['days']==[8,14] for b in old['batches']):old['batches'].append({'days':[8,14],'inputSha256':new['lessonSha256'],'date':'2026-10-18'})
(DEST/'manifest.json').write_text(json.dumps(old,ensure_ascii=False,indent=2)+'\n')
# Retain generation provenance in source, not individual unneeded MP3 files.
(ROOT.parent/'source-data/week02-audio-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'newFiles':7,'newClips':630,'newBytes':new['totalBytes'],'mergedClips':len(old['clips'])}))
