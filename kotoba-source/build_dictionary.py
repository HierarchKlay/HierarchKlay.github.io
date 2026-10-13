"""Build an attributed offline JMdict English snapshot. No generated translations.

python3 build_dictionary.py /path/to/JMdict_e.gz
Refresh at least monthly from https://www.edrdg.org/pub/Nihongo/JMdict_e.gz.
"""
import gzip, hashlib, json, re, sys
from pathlib import Path
import xml.etree.ElementTree as ET

base = Path(__file__).resolve().parent / 'dist' / 'dictionary'
base.mkdir(parents=True, exist_ok=True)
xml = gzip.decompress(Path(sys.argv[1]).read_bytes())
date = re.search(rb'JMdict created: (\d{4}-\d{2}-\d{2})', xml).group(1).decode()
root = ET.fromstring(xml)
def texts(el, tag): return [x.text or '' for x in el.findall(tag)]
entries = []
for el in root.findall('entry'):
    if el.findtext('ent_seq') == '9999990': continue
    ks = [{'t':k.findtext('keb'), 'i':texts(k,'ke_inf')} for k in el.findall('k_ele')]
    rs = [{'t':r.findtext('reb'), 'i':texts(r,'re_inf'), 'k':texts(r,'re_restr'), 'n':r.find('re_nokanji') is not None} for r in el.findall('r_ele')]
    senses, pos = [], []
    for s in el.findall('sense'):
        pos = texts(s,'pos') or pos
        gloss = [{'t':g.text or '', 'type':g.get('g_type','')} for g in s.findall('gloss') if g.get('{http://www.w3.org/XML/1998/namespace}lang','eng') == 'eng']
        if not gloss: continue
        senses.append({'g':gloss,'p':pos,'k':texts(s,'stagk'),'r':texts(s,'stagr'),'m':texts(s,'misc'),'f':texts(s,'field'),'d':texts(s,'dial'),'i':texts(s,'s_inf'),'x':texts(s,'xref'),'a':texts(s,'ant'),'l':[{'t':l.text or '', 'lang':l.get('{http://www.w3.org/XML/1998/namespace}lang','eng'), 'type':l.get('ls_type',''), 'wasei':l.get('ls_wasei','')} for l in s.findall('lsource')]})
    if senses:
        entries.append({'id':el.findtext('ent_seq'),'k':ks,'r':rs,'s':senses,'c':any(x.text in ('ichi1','news1','spec1','spec2','gai1') for x in el.findall('.//ke_pri')+el.findall('.//re_pri'))})
# Omit empty metadata fields to keep mobile parsing memory small. Top-level
# writing/reading/sense arrays are retained so consumers share one stable shape.
for entry in entries:
    for item in entry['k'] + entry['r'] + entry['s']:
        for key in list(item):
            if item[key] in ([], '', False): del item[key]
    for sense in entry['s']:
        for gloss in sense['g']:
            if not gloss['type']: del gloss['type']
raw = json.dumps({'date':date,'entries':entries},ensure_ascii=False,separators=(',',':')).encode()
blob = gzip.compress(raw,compresslevel=9,mtime=0)
sha = hashlib.sha256(blob).hexdigest()
filename = f'jmdict-{date}-{sha[:12]}.json.gz'
for old in base.glob('jmdict-*.json.gz'): old.unlink()
(base / filename).write_bytes(blob)
meta = {'schema':1,'date':date,'entries':len(entries),'file':filename,'bytes':len(blob),'sha256':sha,'source':'https://www.edrdg.org/pub/Nihongo/JMdict_e.gz','license':'CC BY-SA 4.0','xmlSha256':hashlib.sha256(xml).hexdigest()}
(base/'manifest.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
(base/'config.mjs').write_text('export const PACK = '+json.dumps(meta,ensure_ascii=False,separators=(',',':'))+';\n')
sw = base/'sw.js'
if sw.exists():
    sw.write_text(re.sub(r"const CACHE='[^']+';", f"const CACHE='kotoba-dictionary-shell-v1-{date}-{sha[:12]}';", sw.read_text()))
print(json.dumps(meta,ensure_ascii=False)); print('Uncompressed bytes:',len(raw))
