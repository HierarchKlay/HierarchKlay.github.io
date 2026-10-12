import {rateKanji,dueKanjiIds,dueIds,shuffled,checkReading,dayStamp,afterDays,activity} from './core.mjs';

export function features(ctx){
  const {esc,workspace,save,header,toast}=ctx;
  const state=()=>ctx.state(),course=()=>ctx.course(),day=()=>ctx.day();
  const kanji=()=>Object.fromEntries(course().kanji.map(k=>[k.id,k]));
  const todayKanji=()=>day().kanji||[];
  let drill=null,player=null;
  const voices=()=>window.speechSynthesis?.getVoices().filter(v=>/^ja([-_]|$)/i.test(v.lang))||[];
  const hasAudio=()=>!!course().audio||voices().length>0;
  function stop(){if(player){player.pause();player=null;}window.speechSynthesis?.cancel();}
  function systemSpeak(text){
    if(!voices().length){toast('当前浏览器未提供日语语音。请在设备设置中下载日语朗读声音，或用支持朗读的浏览器打开。');return;}
    const u=new SpeechSynthesisUtterance(text);u.lang='ja-JP';u.voice=voices()[0];u.rate=.85;u.onerror=()=>toast('朗读未完成，请重试。');window.speechSynthesis.speak(u);
  }
  function speakWord(w,example=false){
    stop();const text=example?w.example.map(t=>t[0]).join(''):w.word;
    const key=w.id+(example?'-example':''),clip=course().audio?.clips?.[key];
    if(clip){
      const audio=new Audio('audio/'+clip.file);player=audio;audio.preload='auto';audio.muted=true;
      audio.addEventListener('loadedmetadata',()=>{if(player===audio){if(clip.start===0)audio.muted=false;else audio.currentTime=clip.start;}},{once:true});
      let endTimer;audio.addEventListener('playing',()=>{clearTimeout(endTimer);endTimer=setTimeout(()=>audio.pause(),Math.max(0,(clip.end-audio.currentTime)*1000));});
      audio.addEventListener('pause',()=>clearTimeout(endTimer));
      audio.addEventListener('timeupdate',()=>{if(audio.currentTime>=clip.end)audio.pause();});
      audio.addEventListener('seeked',()=>{if(player===audio){audio.muted=false;audio.play().catch(()=>toast('请再次点击试听。'));}},{once:true});
      audio.onerror=()=>{if(player===audio){toast('音频加载失败，尝试设备语音。');systemSpeak(text);}};
      // Prime playback in the user gesture; the seek happens as soon as metadata arrives.
      audio.play().then(()=>{if(player!==audio)audio.pause();else if(audio.currentTime<clip.start)audio.currentTime=clip.start;}).catch(()=>{});
    }
    else systemSpeak(text);
  }
  function renderKanji(){drill=null;header();const s=state(),ks=kanji(),due=dueKanjiIds(s);
    workspace().innerHTML=`<div class="view-head"><div><p class="eyebrow">FIVE CHARACTERS A DAY</p><h2>第 ${day().number} 天 · 汉字手帖</h2><p>每天独立学习 5 字。音训、词组、字形，分开巩固。</p></div><button class="control primary" data-kanji-quiz="daily">练习今天与到期汉字 →</button></div><div class="kanji-toolbar"><span>本课 ${todayKanji().filter(id=>s.kanjiRatings[id]).length} / 5 字已自评 · ${due.length} 字到期</span><button class="control" data-kanji-quiz="due" ${due.length?'':'disabled'}>只练到期旧字</button><button class="control" data-kanji-quiz="lesson">只练本课</button></div><div class="kanji-grid">${todayKanji().map(id=>{const k=ks[id];return `<article class="kanji-card"><div class="kanji-intro"><div class="kanji-character" lang="ja">${esc(k.char)}</div><div><p><b>音读</b><span lang="ja">${esc(k.on)}</span></p><p><b>训读</b><span lang="ja">${esc(k.kun)}</span></p><p><b>字义</b>${esc(k.meaning)}</p></div></div><h3 class="kanji-hook">${esc(k.hook)}</h3><div class="kanji-words">${k.examples.map(x=>`<div class="kanji-word"><span lang="ja">${esc(x[0])}</span><span lang="ja">${esc(x[1])}</span><span>${esc(x[2])}</span></div>`).join('')}</div><p class="kanji-note">${esc(k.note)}</p><div class="kanji-ratings">${[['again','再看一次'],['familiar','有点印象'],['known','记住了']].map(([v,t])=>`<button class="control ${s.kanjiRatings[id]===v?'selected':''}" data-kanji-rate="${id}" data-value="${v}">${t}</button>`).join('')}</div><p class="kanji-due">${s.kanjiReviews[id]?`下次复习：${s.kanjiReviews[id].due}`:'尚未安排复习'}</p></article>`;}).join('')}</div><p class="small-note">词卡里的“汉字小注”仍留在词卡下方。这里按常用汉字表顺序学习；“—”表示常用汉字表未列该类读音，并非任何场合都没有该读音。</p>`;
  }
  function startKanji(source){
    const due=dueKanjiIds(state()),ids=source==='due'?due:source==='lesson'?todayKanji():[...new Set([...due,...todayKanji()])];
    if(!ids.length){toast('目前没有到期汉字。');return;}
    // Two complementary exercises per character; due items precede new characters.
    const selected=ids.slice(0,10),types=['reading','recall'];
    drill={items:types.flatMap(type=>selected.map(id=>({id,type,answered:false}))),index:0,correct:0};ctx.tab('kanji');renderDrill();
  }
  function renderDrill(){const q=drill.items[drill.index],k=kanji()[q.id],p=k.practice,recall=q.type==='recall';
    const prompt=recall?`<p class="quiz-hint">根据词组补出目标汉字，先在纸上写一遍。</p><h2 class="quiz-word" lang="ja">${esc(p.word.replaceAll(k.char,'□'))}</h2><p lang="ja">${esc(p.reading)}</p><p>${esc(p.meaning)}</p>`:`<p class="quiz-hint">写出这个词组的完整假名读音。</p><h2 class="quiz-word" lang="ja">${esc(p.word)}</h2><form id="kanjiReadingForm"><label for="kanjiInput">输入假名</label><div class="reading-input"><input id="kanjiInput" lang="ja" autocomplete="off" ${q.answered?'disabled':''} value="${esc(q.input||'')}"><button class="control primary" ${q.answered?'disabled':''}>核对</button></div></form>`;
    workspace().innerHTML=`<section class="quiz-card"><div class="quiz-top"><span>汉字 · ${recall?'字形回想':'词组读音'}</span><span>${drill.index+1} / ${drill.items.length}</span><button class="text-button" data-tab="kanji">结束练习</button></div>${prompt}${q.shown||q.answered?`<div class="quiz-answer"><h2 class="kanji-answer" lang="ja">${esc(k.char)}</h2><p lang="ja">${esc(p.word)} · ${esc(p.reading)}</p><p>音读：<span lang="ja">${esc(k.on)}</span>　训读：<span lang="ja">${esc(k.kun)}</span></p></div>`:''}${q.answered?`<p class="feedback ${q.correct?'correct':'incorrect'}">${q.correct?'✓ 已记下':'↻ 已加入待复习'}</p><button class="control primary" data-kanji-action="next">${drill.index+1===drill.items.length?'查看结果':'下一题 →'}</button>`:recall?q.shown?'<p class="quiz-hint">对照字形自行判断，不自动识别手写。</p><div class="review-links"><button class="control" data-kanji-answer="wrong">写错 / 没想起</button><button class="control primary" data-kanji-answer="right">写对了</button></div>':'<button class="control primary" data-kanji-action="show">显示字形</button>':''}</section>`;
  }
  function answerKanji(correct,input){if(!drill)return;const q=drill.items[drill.index];if(q.answered)return;q.answered=true;q.correct=correct;q.input=input;drill.correct+=correct?1:0;
    const earlierWrong=drill.items.some(x=>x.id===q.id&&x.answered&&!x.correct);
    // A later correct answer must not erase a failure on another skill in this round.
    rateKanji(state(),q.id,correct&&!earlierWrong?'known':'again',dayStamp(),{mode:q.type,objective:q.type==='reading',correct});save();header();renderDrill();
  }
  function renderStats(){header();const s=state(),rows=activity(s),today=rows.at(-1),max=Math.max(1,...rows.map(r=>r.words+r.kanji)),testCount=rows.reduce((a,r)=>a+r.tests,0),right=rows.reduce((a,r)=>a+r.correct,0);
    const forecast=Array.from({length:7},(_,i)=>{const date=afterDays(dayStamp(),i);return {date,w:Object.entries(s.reviews).filter(([id,r])=>!s.mastered[id]&&(i===0?r.due<=date:r.due===date)).length,k:Object.values(s.kanjiReviews).filter(r=>i===0?r.due<=date:r.due===date).length};});
    workspace().innerHTML=`<div class="view-head"><div><p class="eyebrow">YOUR LEARNING RHYTHM</p><h2>一点一点，看见积累。</h2><p>按北京时间记录。图表随学习自动更新。</p></div><button class="control" data-action="export">导出记录</button></div><div class="stat-cards"><article><span>今日初学词</span><b>${today.newWords}<small> / 35</small></b></article><article><span>累计接触词</span><b>${Object.keys(s.ratings).length}</b></article><article><span>累计接触汉字</span><b>${Object.keys(s.kanjiRatings).length}</b></article><article><span>近 7 天客观题正确率</span><b>${testCount?Math.round(right/testCount*100)+'%':'—'}</b><small>${right} / ${testCount} 题</small></article></div><div class="stats-grid"><article class="review-panel"><h3>近 7 天学习量</h3><p>绿色为词汇，橘色为汉字；每天按不同词 / 字去重。</p><div class="activity-chart" role="img" aria-label="近7天学习词与汉字数量，详细数值见下表">${rows.map(r=>`<div class="activity-day"><div class="activity-bar"><span style="height:${100*r.words/max}%" class="words-bar"></span><span style="height:${100*r.kanji/max}%" class="kanji-bar"></span></div><b>${r.words} / ${r.kanji}</b><small>${r.date.slice(5)}</small></div>`).join('')}</div></article><article class="review-panel"><h3>接下来 7 天</h3><p>今日包含逾期内容。每次作答会重新安排。</p><table class="stats-table"><thead><tr><th>日期</th><th>词汇</th><th>汉字</th></tr></thead><tbody>${forecast.map((r,i)=>`<tr><th>${i===0?'今天':r.date.slice(5)}</th><td>${r.w}</td><td>${r.k}</td></tr>`).join('')}</tbody></table></article></div><details class="stats-details"><summary>查看每日明细</summary><table class="stats-table"><thead><tr><th>日期</th><th>词汇 / 汉字</th><th>初学词</th><th>客观题</th></tr></thead><tbody>${rows.map(r=>`<tr><th>${r.date}</th><td>${r.words} / ${r.kanji}</td><td>${r.newWords}</td><td>${r.correct} / ${r.tests}</td></tr>`).join('')}</tbody></table></details><p class="small-note">统计从此版本开始记录；旧进度计入累计接触量，但不会补造过去的日期。回想题自评不计入客观正确率。未登录时使用本机记录；云同步接通并登录后，图表随合并记录更新。也可导出 / 导入备份。</p>`;
  }
  function onClick(d){if(d.kanjiRate){rateKanji(state(),d.kanjiRate,d.value);save();renderKanji();}if(d.kanjiQuiz)startKanji(d.kanjiQuiz);if(d.kanjiAnswer)answerKanji(d.kanjiAnswer==='right');if(d.kanjiAction&&drill){if(d.kanjiAction==='show'){drill.items[drill.index].shown=true;renderDrill();}if(d.kanjiAction==='next'&&drill.items[drill.index].answered){drill.index++;if(drill.index<drill.items.length)renderDrill();else{const n=drill.items.length,c=drill.correct;drill=null;workspace().innerHTML=`<div class="empty"><h2>汉字练习完成。</h2><p>${n} 题中，${c} 题答对或自评写对。<br>本轮任一项答错的汉字会继续留在待复习中。</p><button class="control primary" data-tab="kanji">回到汉字手帖</button></div>`;}}}}
  function onSubmit(e){if(e.target.id!=='kanjiReadingForm'||!drill)return;e.preventDefault();const input=document.querySelector('#kanjiInput').value;if(!input.trim()){toast('先输入假名。');return;}const k=kanji()[drill.items[drill.index].id];answerKanji(checkReading(input,k.practice.reading),input);}
  return {renderKanji,renderStats,onClick,onSubmit,hasAudio,speakWord,stop};
}
