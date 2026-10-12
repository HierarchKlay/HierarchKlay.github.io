import {emptyDocument,capture,snapshot,mergeDocuments,applyDocument} from './sync-model.mjs';
import {renderMarkdown,searchLabel} from './markdown.mjs';
const DOC_KEY='kotoba.cloud.document.v1',OWNER_KEY='kotoba.cloud.owner.v1',DEVICE_KEY='kotoba.cloud.device.v1';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function attachCloud(ctx){
  let doc=emptyDocument(),before,client,config,user,ready=false,running=false,rerun=false,timer,actor;
  let conversation=[],asking=false,requestId=0;
  const status=(message)=>{ $('#cloudStatus').textContent=message;$('#storageNote').textContent=message; };
  const persist=()=>{
    // Canonical order prevents storage-event ping-pong between browser tabs.
    doc.records=Object.fromEntries(Object.entries(doc.records).sort(([a],[b])=>a<b?-1:a>b?1:0));
    doc.events=Object.fromEntries(Object.entries(doc.events).sort(([a],[b])=>a<b?-1:a>b?1:0));
    const text=JSON.stringify(doc);if(localStorage.getItem(DOC_KEY)!==text)localStorage.setItem(DOC_KEY,text);
  };
  try{
    actor=localStorage.getItem(DEVICE_KEY)||crypto.randomUUID();localStorage.setItem(DEVICE_KEY,actor);
    const saved=JSON.parse(localStorage.getItem(DOC_KEY)||'null');if(saved?.version===1&&saved.records&&saved.events)doc=saved;
    before=Object.keys(doc.records).length?snapshot(ctx.normalize(applyDocument(doc,ctx.state()))):undefined;
    before=capture(doc,before,ctx.state(),actor);persist();ctx.persist();
  }catch{status('本地存储不可用，请先导出进度');}
  function captureLocal(){
    if(!actor)return;
    try{before=capture(doc,before,ctx.state(),actor);persist();}
    catch{status('本地存储空间不足，请导出进度');return;}
    if(user&&ready){status('进度已存本机 · 等待同步');clearTimeout(timer);timer=setTimeout(sync,1200);}
  }
  function applyMerged(next){
    doc=mergeDocuments(doc,next);
    const nextState=ctx.normalize(applyDocument(doc,ctx.state()));
    if(JSON.stringify(nextState)!==JSON.stringify(ctx.state()))ctx.replace(nextState);
    before=snapshot(ctx.state());persist();ctx.persist();
  }
  function accountUI(){
    $('#loginForm').hidden=!ready||!!user;$('#cloudAccount').hidden=!user;
    $('#accountLabel').textContent=user?.email||'';
    $('#askInput').disabled=!ready||!user;
    $('#askSubmit').disabled=!ready||!user||asking;
    $('#askStatus').textContent=!ready?'问答待接入；课程学习可正常使用。':!user?'登录后可向日语助教提问。':'已设为日语助教。开启联网后，会显示实际检索状态与来源。';
  }
  async function sync(){
    if(!ready||!user)return;
    if(running){rerun=true;return;}
    if(navigator.onLine===false){status('离线 · 进度已存本机，联网后同步');return;}
    running=true;const owner=user.id;
    try{
      const binding=localStorage.getItem(OWNER_KEY);
      if(binding&&binding!==owner)throw Error('此浏览器已绑定另一学习账号，请使用独立浏览器资料登录。');
      const sent=JSON.stringify(doc);
      status('正在同步…');
      const {data,error}=await client.rpc('kotoba_merge',{p_course:ctx.course().id,p_document:doc}).abortSignal(AbortSignal.timeout(20000));
      if(error)throw Error(error.message?.includes('Account not enabled')?'此账号尚未开通学习同步，请完成账号配置。':'同步失败，进度已保留在本机，可稍后重试。');
      if(user?.id!==owner)return;
      localStorage.setItem(OWNER_KEY,owner);
      const changedWhileSending=sent!==JSON.stringify(doc);
      applyMerged(data);status('已同步 · '+new Intl.DateTimeFormat('zh-CN',{hour:'2-digit',minute:'2-digit'}).format(new Date()));
      if(changedWhileSending)rerun=true;
    }catch(e){status(e.message||'同步失败，进度已保留在本机');}
    finally{running=false;if(rerun){rerun=false;clearTimeout(timer);timer=setTimeout(sync,1200);}}
  }
  async function initialize(){
    try{
      const res=await fetch('cloud-config.json',{cache:'no-store'});if(!res.ok)throw Error();config=await res.json();
      if(!config.supabaseUrl||!config.publishableKey){status('本机存档 · 云同步待接入');accountUI();return;}
      const endpoint=new URL(config.supabaseUrl);
      if(endpoint.protocol!=='https:'||!endpoint.hostname.endsWith('.supabase.co'))throw Error();
      // A publishable/anon key is public; administrative keys must never reach this file.
      if(!config.publishableKey.startsWith('sb_publishable_')){
        const payload=JSON.parse(atob(config.publishableKey.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
        if(payload.role!=='anon')throw Error();
      }
      await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='vendor/supabase.js';script.onload=resolve;script.onerror=reject;document.head.appendChild(script);});
      client=window.supabase.createClient(config.supabaseUrl,config.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
      ready=true;$('#cloudSetup').hidden=true;$('#loginSubmit').disabled=false;
      const {data:{session}}=await client.auth.getSession();user=session?.user||null;accountUI();status(user?'正在读取云端进度…':'本机存档 · 登录后同步');
      client.auth.onAuthStateChange((_event,session)=>{
        const old=user?.id;user=session?.user||null;
        if(old!==user?.id){requestId++;conversation=[];$('#askMessages').innerHTML='';accountUI();}
        if(user)setTimeout(sync,0);else status('本机存档 · 已退出云同步');
      });
      await sync();
      setInterval(()=>{if(!document.hidden)sync();},60000);
      window.addEventListener('online',sync);
      document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync();});
    }catch{ready=false;status('云同步暂不可用 · 进度保存在本机');accountUI();}
  }
  $('#loginForm').addEventListener('submit',async e=>{
    e.preventDefault();if(!ready)return;
    const button=$('#loginSubmit');button.disabled=true;
    try{
      const {error}=await client.auth.signInWithPassword({email:$('#loginEmail').value.trim(),password:$('#loginPassword').value});
      $('#loginPassword').value='';if(error)status('登录未成功，请检查邮箱和密码。');
    }catch{status('登录连接失败，请稍后重试。');}finally{button.disabled=false;}
  });
  $('#cloudSync').addEventListener('click',sync);
  $('#cloudLogout').addEventListener('click',async()=>{
    // Local progress remains available offline; ownership binding prevents account mixing.
    try{const {error}=await client.auth.signOut({scope:'local'});if(error)status('退出未成功，请稍后重试。');}
    catch{status('退出未成功，请稍后重试。');}
  });
  $('#newQuestion').addEventListener('click',()=>{requestId++;conversation=[];asking=false;$('#askMessages').innerHTML='';accountUI();});
  $('#askForm').addEventListener('submit',async e=>{
    e.preventDefault();if(!ready||!user||asking)return;
    const question=$('#askInput').value.trim();if(!question)return;
    const search=$('#searchOnline').checked,mode=$('#askMode').value;
    const id=++requestId;asking=true;$('#askSubmit').disabled=true;
    $('#askStatus').textContent=search?'正在查询，可能需要几十秒…':'正在整理回答…';
    const bubble=document.createElement('article');bubble.className='ask-exchange';
    bubble.innerHTML=`<p class="ask-question">${esc(question)}</p><div class="ask-answer" aria-live="polite">正在整理回答…</div>`;
    $('#askMessages').appendChild(bubble);
    try{
      const {data:{session}}=await client.auth.getSession();if(!session)throw Error('请重新登录。');
      const res=await fetch(config.supabaseUrl+'/functions/v1/'+encodeURIComponent(config.questionFunction||'kotoba-ask'),{
        method:'POST',headers:{'Content-Type':'application/json',apikey:config.publishableKey,Authorization:'Bearer '+session.access_token},
        body:JSON.stringify({question,history:conversation.slice(-6),search,mode,context:$('#includeCard').checked?ctx.card():''}),signal:AbortSignal.timeout(80000)});
      const data=await res.json();if(!res.ok)throw Error(data.error||'查询暂时失败，请稍后重试。');
      if(id!==requestId)return;
      const answer=bubble.querySelector('.ask-answer');renderMarkdown(answer,data.answer);
      const metadata=document.createElement('p');metadata.className='ask-meta';metadata.textContent=searchLabel(data,search)+(data.incomplete?' · 回答未完整生成，可继续追问':'');bubble.appendChild(metadata);
      if(data.sources?.length){
        const links=document.createElement('div');links.className='ask-sources';
        for(const s of data.sources){let url;try{url=new URL(s.url);}catch{continue;}if(!['http:','https:'].includes(url.protocol)||url.username||url.password)continue;
          const a=document.createElement('a');a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';a.textContent=s.title||url.hostname;links.appendChild(a);}
        bubble.appendChild(links);
      }
      conversation.push({role:'user',content:question},{role:'assistant',content:data.answer});conversation=conversation.slice(-6);
      $('#askInput').value='';$('#askStatus').textContent='可以继续追问。对话只保留在当前页面。';
    }catch(e){if(id===requestId){bubble.querySelector('.ask-answer').textContent=e.name==='TimeoutError'?'查询超时，请稍后重试。':e.message;$('#askStatus').textContent='没有取得回答，可重试。';}}
    finally{if(id===requestId){asking=false;$('#askSubmit').disabled=!user;}}
  });
  window.addEventListener?.('storage',e=>{
    if(e.key!==DOC_KEY||!e.newValue)return;
    try{applyMerged(JSON.parse(e.newValue));if(user)setTimeout(sync,1200);}catch{/* Keep the current study session on malformed storage events. */}
  });
  initialize();
  return {capture:captureLocal};
}
