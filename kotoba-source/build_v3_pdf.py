from pathlib import Path
import json,argparse,math,re
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4

ROOT=Path(__file__).resolve().parent
PAPER='#F4F2E9';WHITE='#FFFEFA';INK='#283E37';MUTED='#778178';LINE='#DCDDCE';GREEN='#3B6654';ORANGE='#B96342'
W,H=A4
def main():
    p=argparse.ArgumentParser();p.add_argument('--out',required=True);args=p.parse_args()
    for font in ['SC','JP']:pdfmetrics.registerFont(TTFont(font,str(ROOT/'source-fonts'/(font+'.ttf'))))
    data=json.loads((ROOT/'dist/lesson.json').read_text());byid={w['id']:w for w in data['words']};day=data['days'][0]
    core=[byid[x] for x in day['core']];reserve=[byid[x] for x in day['reserve']]
    total=math.ceil(len(core)/4)+math.ceil(len(reserve)/4)+6
    c=canvas.Canvas(args.out,pagesize=A4);c.setTitle('日々ことば · 第1天：35词与10备用词');c.setAuthor('日々ことば')
    def text(x,y,s,size=10,font='SC',color=INK):c.setFont(font,size);c.setFillColor(HexColor(color));c.drawString(x,y,s)
    def right(x,y,s,size=9,font='SC',color=MUTED):c.setFont(font,size);c.setFillColor(HexColor(color));c.drawRightString(x,y,s)
    def line(x,y,xx,yy,color=LINE):c.setStrokeColor(HexColor(color));c.setLineWidth(.65);c.line(x,y,xx,yy)
    def rect(x,y,w,h,fill=WHITE,stroke=LINE):c.setFillColor(HexColor(fill));c.setStrokeColor(HexColor(stroke));c.setLineWidth(.6);c.roundRect(x,y,w,h,5,fill=1,stroke=1)
    def wrap(s,width,size,font='SC'):
        lines=[];part=''
        for ch in s:
            if part and (ch=='\n' or pdfmetrics.stringWidth(part+ch,font,size)>width):
                # Keep closing punctuation with preceding text (CJK line-breaking rule).
                if ch in '），。、；：！？)]」』' and len(part)>1:
                    tail=part[-1];lines.append(part[:-1]);part=tail
                else:lines.append(part);part=''
            if ch!='\n':part+=ch
        if part:lines.append(part)
        return lines
    def para(x,y,s,width,size=9,leading=14,font='SC',color=INK):
        for a in wrap(s,width,size,font):text(x,y,a,size,font,color);y-=leading
        return y
    def page(n,title,subtitle,label):
        c.setFillColor(HexColor(PAPER));c.rect(0,0,W,H,fill=1,stroke=0)
        rect(38,H-64,25,29,PAPER,ORANGE);text(42,H-56,'言',20,'JP',ORANGE)
        text(74,H-48,'日々ことば',16,'JP');text(75,H-64,'日语词汇手帖',7.5,color=MUTED)
        right(W-38,H-46,'WEEK 01 / DAY 01',8);line(38,H-79,W-38,H-79)
        text(38,H-117,title,21);text(39,H-139,subtitle,8.5,color=MUTED);right(W-38,H-116,label,8,color=ORANGE)
        line(38,31,W-38,31);text(38,18,'自分のペースで。',7.5,'JP',GREEN);text(121,18,'按自己的节奏来。',7,color=MUTED);right(W-38,18,f'{n:02d} / {total:02d}',7.5)
    def ruby(tokens,x,y,width,size=10.5):
        pos=x;baseline=y
        for token in tokens:
            val=token[0];rd=token[1] if len(token)>1 else ''
            tw=max(pdfmetrics.stringWidth(val,'JP',size),pdfmetrics.stringWidth(rd,'JP',5.1))
            if tw>width:
                for fragment in wrap(val,width,size,'JP'):
                    if pos>x:pos=x;baseline-=20
                    text(pos,baseline,fragment,size,'JP');pos+=pdfmetrics.stringWidth(fragment,'JP',size)
                continue
            if pos+tw>x+width and pos>x:pos=x;baseline-=20
            text(pos+(tw-pdfmetrics.stringWidth(val,'JP',size))/2,baseline,val,size,'JP')
            if rd:text(pos+(tw-pdfmetrics.stringWidth(rd,'JP',5.1))/2,baseline+11,rd,5.1,'JP',MUTED)
            pos+=tw
        return baseline
    def card(w,n,x,top,backup=False):
        cw=251.6;ch=318;pad=16;width=cw-2*pad;bottom=top-ch;rect(x,bottom,cw,ch)
        text(x+pad,top-20,w['category'],8,color=ORANGE);right(x+cw-pad,top-20,('备用 ' if backup else '')+f'{n:02d}',8)
        fs=34
        while pdfmetrics.stringWidth(w['word'],'JP',fs)>width:fs-=1
        text(x+pad,top-65,w['word'],fs,'JP');text(x+pad,top-86,w['reading'],11,'JP',GREEN)
        ac=f"{w['accent']} 型" if isinstance(w['accent'],int) else '声调未收录'
        right(x+cw-pad,top-86,ac,7.5,color=GREEN)
        y=top-105
        if w.get('rare'):y=para(x+pad,y,w['rare'],width,6.7,10,color=MUTED)
        y=para(x+pad,y-7,w['meaning'],width,12,15)-3
        line(x+pad,y,x+cw-pad,y);y-=16;text(x+pad,y,'例句',7,color=MUTED);y-=23
        y=ruby(w['example'],x+pad,y,width)-17
        y=para(x+pad,y,w['translation'],width,8,11,color=MUTED)-7
        y=para(x+pad,y,w['tip'],width,7.5,10.5,color=GREEN)-7
        if w['kanjiNote']:
            line(x+pad,y+4,x+cw-pad,y+4);y-=9
            y=para(x+pad,y,'汉字小注  '+w['kanjiNote'],width,7,10.3,color=MUTED)
        assert y>=bottom+4,('Card overflow',w['word'],round(y-bottom,1))
    page_number=0
    for words,backup in [(core,False),(reserve,True)]:
        for start in range(0,len(words),4):
            page_number+=1;page(page_number,'会的跳过，新的补上' if backup else '今天，记住三十五个词','备用词用于替换已经完全掌握的词，不必额外全学。' if backup else '读词、读例句，再遮住答案回想。汉字小注仅列部分常用读法。','10 个备用词' if backup else '35 个核心词')
            for j,w in enumerate(words[start:start+4]):card(w,start+j+1,38+j%2*267,684-j//2*331,backup)
            c.showPage()
    reading=[w for w in core if re.search(r'[\u4e00-\u9fff]',w['word'])][:10];cloze=core[10:20]
    page_number+=1;page(page_number,'先不看答案','写下词语的假名。第 15 页可核对答案。','练习 A / 读音')
    for i,w in enumerate(reading):
        y=672-i*53;text(43,y,f'{i+1:02d}',9,color=ORANGE);text(77,y,w['word'],19,'JP');line(290,y-2,550,y-2)
    para(40,100,'自评：想起来了 / 有点印象 / 再看一次。PDF 为固定课程，不会自动补位或记录进度；这些功能请使用网页。',W-80,9,15,color=MUTED);c.showPage()
    page_number+=1;page(page_number,'把词放回句子里','按给定读音，填入目标词的合适形式。其他词也可能组成自然句。','练习 B / 填空')
    for i,w in enumerate(cloze):
        y=674-i*57;text(40,y,f'{i+1:02d}',8,color=ORANGE)
        sentence=w['cloze']['before']+'（　　　　）'+w['cloze']['after']
        para(70,y,sentence,W-110,11,15,'JP');text(70,y-33,'目标词读音：',8,'SC',GREEN);text(126,y-33,w['reading'],8,'JP',GREEN)
    c.showPage()
    page_number+=1;page(page_number,'核对，再回想一次','答对不等于永久掌握；完全掌握请在网页中单独标记。','答案 / 说明')
    text(40,680,'A. 读音',13,color=GREEN)
    y=658
    for i,w in enumerate(reading):text(42+(i//5)*267,y-(i%5)*25,f'{i+1:02d}  '+w['word']+'  '+w['reading'],10,'JP')
    text(40,501,'B. 例句目标答案',13,color=GREEN)
    for i,w in enumerate(cloze):text(42+(i//5)*267,479-(i%5)*25,f'{i+1:02d}  '+w['cloze']['answer'],10,'JP')
    text(40,326,'使用与来源',12,color=GREEN);y=308
    for note in [
        '网页版含 7 课、245 核心词和 70 备用词。此 PDF 为第 1 课固定版本，不是补位后的个性化清单。网页“打印本课”可打印当前实际词目。',
        '声调数字表示第几拍后由高转低，0 表示平板型。本卡仅展示有来源记录的读法；其他词待核对。系统试听不作为标准声调示范。',
        '例句与译文为学习示例，未经母语教师逐条审校。选词是人工编排，不是 BCCWJ 前 315 名，也不是视频课程逐条复刻。',
        '汉字小注为部分常用音训与字义，不应逐字拼成整词读音。熟字训和音变请按整词记忆。'
    ]:y=para(40,y,note,W-80,8,12,color=MUTED)-7
    for label,url in [data['sources'][0],data['sources'][1],['国際交流基金 まるごと 词汇索引（部分声调）','https://marugoto.jpf.go.jp/'],data['sources'][3]]:
        y=para(40,y,label,W-80,7.5,11,color=GREEN);c.linkURL(url,(40,y,W-40,y+12),relative=0);y-=4
    assert y>40,('Source overflow',y)
    c.showPage()
    ks={k['id']:k for k in data['kanji']};daily=[ks[x] for x in day['kanji']]
    for start in [0,3]:
        page_number+=1;page(page_number,'五个字，单独记','汉字手帖独立编排。词卡汉字小注不在此重复汇集。','汉字 / 第 1 天')
        for i,k in enumerate(daily[start:start+3]):
            top=683-i*208;rect(38,top-194,W-76,194)
            text(53,top-60,k['char'],46,'JP',GREEN)
            text(122,top-26,'音读',8,color=ORANGE);text(153,top-26,k['on'],10,'JP')
            text(122,top-47,'训读',8,color=ORANGE);text(153,top-47,k['kun'],10,'JP')
            para(122,top-70,k['meaning'],W-183,10,13)
            text(55,top-99,k['hook'],10,color=GREEN)
            y=top-121
            for word,rd,meaning in k['examples']:
                text(55,y,word,11,'JP');text(210,y,rd,9,'JP');text(375,y,meaning,8);y-=17
            para(55,top-176,k['note'],W-111,7.2,10,color=MUTED)
        c.showPage()
    page_number+=1;page(page_number,'字音与字形，都回想一次','先完成全部题目，再折开或向下查看答案。','练习 C / 汉字')
    text(40,677,'A. 写出整个词组的假名',12,color=GREEN)
    for i,k in enumerate(daily):
        y=643-i*42;text(42,y,f'{i+1:02d}',9,color=ORANGE);text(75,y,k['practice']['word'],17,'JP');line(300,y-2,550,y-2)
    text(40,410,'B. 根据读音和词义，写出目标汉字',12,color=GREEN)
    for i,k in enumerate(daily):
        p=k['practice'];y=376-i*37;text(42,y,f'{i+1:02d}',9,color=ORANGE);text(75,y,p['word'].replace(k['char'],'□'),16,'JP');text(240,y,p['reading'],10,'JP');text(390,y,p['meaning'],8)
    line(38,177,W-38,177);text(40,156,'核对答案',11,color=GREEN)
    for i,k in enumerate(daily):text(42+(i%2)*265,133-(i//2)*23,f"{i+1:02d}  {k['char']}  {k['practice']['reading']}",10,'JP')
    text(40,51,'复习：1 / 3 / 7 / 14 / 30 / 60 天。网页按实际作答分别安排词汇与汉字。',7.5,color=MUTED)
    c.showPage();c.save();assert page_number==total;print(json.dumps({'pdf':args.out,'pages':total,'core':35,'reserve':10,'kanji':5},ensure_ascii=False))
if __name__=='__main__':main()
