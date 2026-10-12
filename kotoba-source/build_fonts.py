import argparse
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.subset import Subsetter,Options
from fontTools.varLib.instancer import instantiateVariableFont
ROOT=Path(__file__).resolve().parent
def main():
    p=argparse.ArgumentParser();p.add_argument('--full-font-dir',required=True);args=p.parse_args()
    text=''.join(path.read_text() for path in (ROOT/'dist').iterdir() if path.suffix in ['.html','.json','.css','.js','.mjs'])
    text+=(ROOT/'build_v3_pdf.py').read_text()+''.join(chr(c) for c in range(32,127))+'□〇一二三四五六七八九十'
    for name,out in [('SC','notebook'),('JP','notebook-jp')]:
        font=TTFont(Path(args.full_font_dir)/(name+'.ttf'));subset=Subsetter(options=Options());subset.populate(text=text);subset.subset(font)
        font=instantiateVariableFont(font,{'wght':400},inplace=True);font.save(ROOT/'source-fonts'/(name+'.ttf'));font.flavor='woff';font.save(ROOT/'dist/assets'/(out+'.woff'))
    print('SC + JP fonts rebuilt from course and interface glyphs')
if __name__=='__main__':main()
