"""Install only the checked October 25 batch, preserving all earlier sprites."""
import hashlib
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DEST = ROOT.parent / 'dist/audio'
new = json.loads((ROOT / 'sprites/audio-sprites.json').read_text())
old = json.loads((DEST / 'manifest.json').read_text())
audit = json.loads((ROOT / 'audio-manifest.json').read_text())
assert audit['fileCount'] == 630 and audit['wordCount'] == 315
assert new['lessonSha256'] == audit['lessonSha256']
assert new['lessonSha256'] == hashlib.sha256((ROOT.parent / 'source-data/week03-audio-input.json').read_bytes()).hexdigest(), 'Stale generation input'
assert len(new['files']) == 7 and len(new['clips']) == 630
assert [f['file'] for f in new['files']] == [f'day-{i:02}.mp3' for i in range(15, 22)]
assert all(key.startswith('w03-') for key in new['clips'])
installed_batch = next((b for b in old.get('batches', []) if b['days'] == [15, 21]), None)
assert installed_batch is None or installed_batch['inputSha256'] == new['lessonSha256'], 'Refusing inconsistent batch provenance'
for f in new['files']:
    raw = (ROOT / 'sprites' / f['file']).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == f['sha256'] and len(raw) == f['bytes']
    existing = next((x for x in old['files'] if x['file'] == f['file']), None)
    assert existing is None or existing == f, 'Refusing to replace an installed sprite'
for ident, clip in new['clips'].items():
    assert ident not in old['clips'] or old['clips'][ident] == clip, 'Refusing to move installed offsets'
for f in new['files']:
    shutil.copyfile(ROOT / 'sprites' / f['file'], DEST / f['file'])
    if not any(x['file'] == f['file'] for x in old['files']):
        old['files'].append(f)
old['clips'].update(new['clips'])
old['totalBytes'] = sum(f['bytes'] for f in old['files'])
assert 'batches' in old
if not any(b['days'] == [15, 21] for b in old['batches']):
    old['batches'].append({'days':[15, 21], 'inputSha256':new['lessonSha256'], 'date':'2026-10-23', 'scheduledEdition':'2026-10-25'})
(DEST / 'manifest.json').write_text(json.dumps(old, ensure_ascii=False, indent=2) + '\n')
(ROOT.parent / 'source-data/week03-audio-audit.json').write_text(json.dumps(audit, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'newFiles':7, 'newClips':630, 'newBytes':new['totalBytes'], 'mergedClips':len(old['clips'])}))
