// Dopamine Fleet Tracker runtime — Vehicle Analyzer Release 1.0 (bootstrap compatibility marker)
(function () {
  'use strict';
  const VERSION = '1.0.2';
  const KEY = 'dopamine-fleet-tracker-v1';
  const USERS = ['ㅇ발','구레긔','피콜로','ㅇ샘','영감','톩끼'];
  const ALIASES = {'○발':'ㅇ발','◯발':'ㅇ발','〇발':'ㅇ발','그레이트':'구레긔','픸홀':'피콜로','픽홀':'피콜로','핔홀':'피콜로','핗홀':'피콜로','픽홀':'피콜로','콜로':'피콜로','참돔':'ㅇ샘','킹황':'영감','갱서':'톩끼'};
  if (document.getElementById('dft-root')) return;
  let db;
  try { db = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (_) { db = {}; }
  db = Object.assign({version:1,garages:{},snapshots:[],transactions:[],events:[],seen:[],settings:{auto:true}},db);
  db.settings = Object.assign({auto:true},db.settings || {});
  let selected = 'ㅇ발';
  let message = '차고 팝업을 열고 참가자를 선택해 저장하세요.';
  let lastRefresh={status:'idle',stage:'idle',message:null,results:[]};
  let lastCaptureFailure=null;
  let collapsed = true;
  const root = document.createElement('div');
  root.id = 'dft-root';
  const shadow = root.attachShadow({mode:'open'});
  const clean = s => String(s || '').replace(/\s+/g,' ').trim();
  const who = s => ALIASES[clean(s)] || clean(s);
  const date = () => new Date().toISOString();
  const toKst = utc => { const ms=Date.parse(utc||'');return Number.isFinite(ms)?new Date(ms+9*60*60*1000).toISOString().replace('Z','+09:00'):null; };
  const save = () => localStorage.setItem(KEY,JSON.stringify(db));
  const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g,c => {
    if (c === '&') return '&amp;';
    if (c === '<') return '&lt;';
    if (c === '>') return '&gt;';
    if (c === '"') return '&quot;';
    return '&#39;';
  });
  function note(s) { message = s; render(); }
  function panels() {
    const selectors = '[role="dialog"],[aria-modal="true"],[class*="modal"],[class*="Modal"],[class*="popup"],[class*="Popup"]';
    return [...document.querySelectorAll(selectors)].filter(e => e !== root && !root.contains(e) && e.getClientRects().length);
  }
  function garageOwnerFromText(raw) {
    const t=String(raw||'').replace(/\s+/g,'').replace(/[\u200b-\u200d\ufeff]/g,'');
    const names=[...Object.keys(ALIASES),...USERS].sort((a,b)=>b.length-a.length);
    for(const name of names) {
      if(t.includes(name+'의차고')||t.includes(name+'차고')) return who(name);
    }
    return null;
  }
  function garageTitleCandidates() {
    const found=[];
    const els=document.querySelectorAll('h1,h2,h3,h4,h5,div,span,strong,b,p');
    for(const el of els) {
      if(el===root||root.contains(el)||!el.getClientRects().length) continue;
      const r=el.getBoundingClientRect();
      if(r.width<1||r.height<1||r.bottom<0||r.top>innerHeight) continue;
      const t=(el.textContent||'').replace(/[\u200b-\u200d\ufeff]/g,'').replace(/\s+/g,'').trim();
      if(t.length<3||t.length>55||!t.includes('의차고')) continue;
      const owner=garageOwnerFromText(t);
      found.push({text:t,owner,top:Math.round(r.top),length:t.length,area:Math.round(r.width*r.height)});
    }
    return found.sort((a,b)=>a.length-b.length||a.area-b.area||a.top-b.top).slice(0,12);
  }
  function currentGarageOwner() {
    const titles=garageTitleCandidates();
    return titles.find(x=>x.owner)?.owner||null;
  }
  function showDiagnostics() {
    const screen=tradeScreen();
    if(screen) {
      const saved=db.transactions.filter(x=>x.screen===screen.type);
      const samples=saved.filter(x=>/출고|거래|매입/.test(x.raw||'')).slice(0,3);
      const lines=['원문 진단 v'+VERSION,'화면: '+screen.type,'저장: '+saved.length+'건',
        ...samples.map((x,i)=>'샘플'+(i+1)+': '+JSON.stringify(x.raw).slice(0,360)),
        '샘플 해석: '+samples.map(x=>{const p=parseTradeEntry(x.raw,screen.type);return p?JSON.stringify({seller:p.seller,model:p.model,stars:p.stars}):'실패';}).join(' / ')];
      note(lines.join(' | '));
      return;
    }
    const titles=garageTitleCandidates();
    const p=activeGaragePanel();
    note(['진단 v'+VERSION,'제목 후보: '+titles.length,
      ...titles.map(x=>x.text+' => '+(x.owner||'미인식')),
      '차고 영역: '+(p?'찾음':'없음'),
      '현재 소유주: '+(currentGarageOwner()||'미인식')].join(' / '));
  }
  function activeGaragePanel() {
    const visible=el=>!!(el&&el.getClientRects().length);
    const all=panels();
    // Select the complete dialog, not a nested card or an inner popup-like component.
    const titled=[...document.querySelectorAll('h1,h2,h3,h4,header,div,span')]
      .filter(el=>visible(el)&&el.children.length<5&&
        garageOwnerFromText(el.textContent||'')&&
        (el.textContent||'').length<160);
    for(const title of titled) {
      const owner=garageOwnerFromText(title.textContent);
      let ancestor=title;
      for(let i=0;i<12&&ancestor.parentElement;i++) {
        ancestor=ancestor.parentElement;
        if(!visible(ancestor)) break;
        const text=ancestor.textContent||'';
        if(/보유\s*차량/.test(text)&&/최고\s*★/.test(text)&&text.length<30000) {
          if(owner) return ancestor;
        }
      }
    }
    const candidates=all.filter(el=>/보유\s*차량/.test(el.textContent||'')&&/최고\s*★/.test(el.textContent||''));
    return candidates.sort((a,b)=>(b.textContent||'').length-(a.textContent||'').length)[0]||null;
  }
  function panel() {
    return activeGaragePanel()||panels().sort((a,b)=>(b.textContent||'').length-(a.textContent||'').length)[0]||null;
  }
  function detectOwner(p) {
    if(!p) return null;
    return currentGarageOwner();
  }
  function expectedTotal(p) {
    const m=(p?.innerText||'').match(/보유차량\s*[·•:]?\s*(\d+)\s*대/);
    return m ? Number(m[1]) : null;
  }
  function parseGarage(p) {
    if (!p) return [];
    const items=[];
    const summaryRe=/최고\s*★\s*([1-5])\s*[·•]?\s*(\d+)\s*대/;
    const nodes=[...p.querySelectorAll('div,li,article,section,span,p')];
    const candidates=nodes.filter(el=>{
      if(el===root||root.contains(el)) return false;
      const t=el.textContent||'';
      if(!summaryRe.test(t)||t.length>650) return false;
      return ![...el.children].some(ch=>summaryRe.test(ch.textContent||''));
    });
    for(const leaf of candidates) {
      let card=leaf;
      for(let i=0;i<5 && card.parentElement && card.parentElement!==p;i++){
        const parent=card.parentElement;
        const text=parent.innerText||parent.textContent||'';
        if(text.length>650) break;
        if((text.match(/최고\s*★\s*[1-5]\s*[·•]?\s*\d+\s*대/g)||[]).length>1) break;
        card=parent;
        if(/(?:^|\s)(SSR|SR|S|R)(?=\s|$)/.test(text)) break;
      }
      const t=card.innerText||card.textContent||'';
      const summary=t.match(summaryRe);
      const grade=t.match(/(?:^|\s)(SSR|SR|S|R)(?=\s|$)/);
      if(!summary||!grade) continue;
      const lines=t.split(/\n/).map(clean).filter(Boolean);
      const ix=lines.findIndex(x=>summaryRe.test(x));
      if(ix<0) continue;
      const before=lines.slice(0,ix);
      const gradeIx=before.findIndex(x=>/^(SSR|SR|S|R)$/.test(x));
      const relevant=gradeIx>=0?before.slice(gradeIx+1):before;
      const filtered=relevant.filter(x=>!(/^(SSR|SR|S|R)$/.test(x)||
        /^(?:ERS|⚡|탑승중|최고\s*★|보유\s*차량)/.test(x)||
        /^\d+\s*(?:RP|E)$/.test(x)));
      const model=filtered.slice(-2).join(' ').trim();
      if(!model||model.length>80) continue;
      const qty=Number(summary[2]),stars=Number(summary[1]);
      const breakdown=[];
      for(const m of lines.slice(ix+1).join(' ').matchAll(/([1-5])\s*성\s*[×x]\s*(\d+)/g))
        breakdown.push({stars:Number(m[1]),qty:Number(m[2])});
      items.push({grade:grade[1],model,stars,qty,breakdown:breakdown.reduce((n,x)=>n+x.qty,0)===qty?breakdown:[]});
    }
    const map=new Map();
    for(const v of items) map.set([v.grade,v.model,v.stars].join('|'),v);
    return [...map.values()];
  }
  function differences(a,b) {
    const x = new Map(a.map(v=>[[v.grade,v.model,v.stars].join('|'),v.qty]));
    const y = new Map(b.map(v=>[[v.grade,v.model,v.stars].join('|'),v.qty]));
    return [...new Set([...x.keys(),...y.keys()])].map(k=>({key:k,delta:(y.get(k)||0)-(x.get(k)||0)})).filter(v=>v.delta);
  }
  let collecting = false;
  const pause = ms => new Promise(resolve => setTimeout(resolve,ms));
  function scrollContainer(p) {
    const nodes = [p,...p.querySelectorAll('*')];
    const possible = nodes.filter(el => {
      const cs = getComputedStyle(el);
      return el.scrollHeight > el.clientHeight + 12 &&
        el.clientHeight > 65 && /(auto|scroll)/.test(cs.overflowY);
    });
    return possible.sort((a,b) => (b.scrollHeight-b.clientHeight)-(a.scrollHeight-a.clientHeight))[0] || null;
  }
  async function captureGarage(silent=false, ownerOverride=null) {
    lastCaptureFailure=null;
    if(collecting){lastCaptureFailure='이미 수집 중';return false;}
    const p=activeGaragePanel(),observedOwner=currentGarageOwner(),actual=ownerOverride||observedOwner;
    if(!p){lastCaptureFailure='차고 팝업 인식 실패';return false;}
    if(!actual||(ownerOverride&&observedOwner!==ownerOverride)){
      lastCaptureFailure='소유주 불일치: 요청 '+ownerOverride+', 화면 '+observedOwner;return false;
    }
    if (actual !== selected) { selected=actual; render(); }
    collecting = true;
    const scroll = scrollContainer(p);
    const oldTop = scroll ? scroll.scrollTop : 0;
    const seen = new Map();
    const collect = () => {
      for (const v of parseGarage(p)) seen.set([v.grade,v.model,v.stars].join('|'),v);
    };
    let complete = !scroll;
    try {
      if (!silent) note(actual+' 차고 전체 차량 수집 중…');
      collect();
      if (scroll) {
        scroll.scrollTop = 0;
        await pause(180);
        collect();
        let stable = 0;
        for (let i=0;i<160;i++) {
          if (!p.isConnected || !scroll.isConnected) break;
          const before = scroll.scrollTop;
          const step = Math.max(100,Math.floor(scroll.clientHeight*0.75));
          scroll.scrollTop = Math.min(scroll.scrollHeight, before+step);
          await pause(120);
          collect();
          if (scroll.scrollTop === before) stable++;
          else stable=0;
          if (stable >= 2 && scroll.scrollTop + scroll.clientHeight >= scroll.scrollHeight-5) {complete=true;break;}
        }
      }
      const cars = [...seen.values()];
      const total=cars.reduce((n,v)=>n+v.qty,0);
      const expected=expectedTotal(p);
      if (!complete || !p.isConnected) {
        lastCaptureFailure='스크롤 완료 실패 '+cars.length+'종';if(!silent)note(lastCaptureFailure);return false;
      }
      if (!cars.length) {lastCaptureFailure='차량 카드 0건 인식';if(!silent)note(lastCaptureFailure);return false;}
      if (expected!==null && total!==expected) {lastCaptureFailure='수량 불일치: 게임 '+expected+'대 / 인식 '+total+'대';if(!silent)note(lastCaptureFailure);return false;}
      const prev = db.garages[actual]?.vehicles || [];
      const changes = differences(prev,cars);
      const at = date();
      if (prev.length && !changes.length) {
        // A successful scan counts as a new scan even when ownership is unchanged.
        // Keep change snapshots/events unchanged; update only last-confirmed scan time.
        db.garages[actual] = {...db.garages[actual],updatedAt:at,source:'full-popup-scroll'};
        save();
        if (!silent) note(actual+' 차고 변경 없음 ('+cars.length+'종 / '+total+'대) · 조회 '+toKst(at));
        return true;
      }
      db.garages[actual] = {vehicles:cars,updatedAt:at,source:'full-popup-scroll'};
      db.snapshots.push({user:actual,at,vehicles:cars,changes});
      if (prev.length && changes.length) db.events.push({user:actual,at,changes,note:'변동 원인 미확정'});
      db.snapshots = db.snapshots.slice(-800);
      db.events = db.events.slice(-800);
      save();
      selected = actual;
      if (!silent) note(actual+' 전체 수집 '+cars.length+'종 / '+total+'대 저장, 변경 '+changes.length+'건');
      return true;
    } catch(e) {
      lastCaptureFailure='차고 수집 오류: '+String(e?.message||e);if(!silent)note(lastCaptureFailure);return false;
    } finally {
      if (scroll && scroll.isConnected) scroll.scrollTop = oldTop;
      collecting = false;
    }
  }
  function resetGarageTest() {
    if(fleetRefreshing||collecting){note('수집 진행 중에는 초기화할 수 없습니다.');return;}
    if(!window.confirm('6명 차고 저장정보와 차고 변동 기록을 초기화할까요? 거래 원문과 거래 기록은 유지됩니다.'))return;
    const backupKey='dopamine-fleet-backup-'+Date.now();
    try {
      localStorage.setItem(backupKey,JSON.stringify(db));
      db.garages={};db.snapshots=[];db.events=[];
      save();
      note('차고 테스트 초기화 완료. 기존 전체 데이터 백업: '+backupKey+' / 거래 기록 유지. 전체 차고 갱신을 누르세요.');
    }catch(e){note('백업 실패로 초기화 취소: '+String(e.message||e));}
  }
  let fleetRefreshing=false;
  function participantRows() {
    const names=[...new Set([...Object.keys(ALIASES),...USERS])].sort((a,b)=>b.length-a.length);
    const buttons=[...document.querySelectorAll('button,[role="button"]')].filter(b=>
      b.getClientRects().length&&/차고\s*구경/.test(clean(b.innerText||b.textContent))&&clean(b.innerText||b.textContent).length<30);
    return buttons.map(button=>{
      let row=button.parentElement,owner=null;
      for(let n=0;n<12&&row;n++,row=row.parentElement){
        const t=clean(row.innerText||row.textContent);
        const matches=names.filter(name=>t.includes(name));
        const distinct=[...new Set(matches.map(who))];
        const buttonCount=[...row.querySelectorAll('button,[role="button"]')].filter(b=>/차고\s*구경/.test(clean(b.innerText||b.textContent))&&clean(b.innerText||b.textContent).length<30).length;
        if(distinct.length===1&&buttonCount===1){owner=distinct[0];break;}
        if(buttonCount>1)break;
      }
      return {button,owner};
    });
  }
  async function waitForGarage(owner,timeout=6000) {
    const start=Date.now();
    while(Date.now()-start<timeout){
      const p=activeGaragePanel();
      if(p&&p.getClientRects().length&&currentGarageOwner()===owner)return p;
      await pause(150);
    }
    return null;
  }
  function closeGarage(p) {
    if(!p)return false;
    const buttons=[...p.querySelectorAll('button')];
    const btn=buttons.find(b=>/닫기/.test(clean(b.innerText||b.textContent))||b.getAttribute('aria-label')==='Close');
    if(!btn)return false;
    btn.click();return true;
  }
  const GH_TOKEN_KEY='dopamine-fleet-github-token-v1';
  const GH_FILE_API='https://api.github.com/repos/tnsdudhaha-ops/dopamine-race-auto/contents/data/latest-garages.json';
  function aiGaragePayload(){
    const generatedAt=date();
    return {schema:'dopamine-race-garages-ai-v1',generatedAt,generatedAtKst:toKst(generatedAt),timeZone:'Asia/Seoul',
      source:'도파민레이스 차량 추적기',trackerVersion:VERSION,
      participants:USERS.map(user=>{
        const g=db.garages[user];
        const vehicles=(g?.vehicles||[]).map(v=>({
          grade:v.grade,model:v.model,maxStars:Number(v.stars),
          quantity:Number(v.qty),starBreakdown:Array.isArray(v.breakdown)?v.breakdown:[]
        }));
        return {user,updatedAt:g?.updatedAt||null,updatedAtKst:toKst(g?.updatedAt),modelCount:vehicles.length,
          vehicleCount:vehicles.reduce((n,v)=>n+v.quantity,0),vehicles};
      })};
  }
  function base64Utf8(s){
    const bytes=new TextEncoder().encode(s);
    let binary='';
    for(let i=0;i<bytes.length;i+=8192)
      binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
    return btoa(binary);
  }
  function downloadAiGarageJson(payload){
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=url;link.download='dopamine-race-garages-'+payload.generatedAt.replace(/[:.]/g,'-')+'.json';
    document.body.appendChild(link);
    try{link.click();}finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
    return link.download;
  }

  // Use the Tampermonkey cross-origin transport; keep credentials browser-local.
  function ghRequest(method,token,body=null){
    const headers={'Accept':'application/vnd.github+json','Authorization':'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28'};
    if(body!==null)headers['Content-Type']='application/json';
    const parse=(status,raw)=>{let data=null;try{data=JSON.parse(raw||'null');}catch(_){}return {status,data};};
    if(typeof GM_xmlhttpRequest==='function')return new Promise((resolve,reject)=>{
      try{GM_xmlhttpRequest({method,url:GH_FILE_API,headers,...(body===null?{}:{data:body}),timeout:20000,
        onload:r=>resolve(parse(r.status,r.responseText)),
        onerror:()=>reject(new Error('GitHub 네트워크/권한 연결 실패')),
        ontimeout:()=>reject(new Error('GitHub 접속 시간 초과'))});}
      catch(e){reject(new Error('GitHub 요청 실패: '+String(e?.message||e)));}
    });
    return fetch(GH_FILE_API,{method,headers,...(body===null?{}:{body}),cache:'no-store'}).then(async r=>parse(r.status,await r.text()));
  }
  async function uploadAiGarageJson(payload,token){
    const prior=await ghRequest('GET',token);
    if(prior.status!==200&&prior.status!==404)throw new Error('GitHub 기존 원본 HTTP '+prior.status+' · '+String(prior.data?.message||''));
    const sha=prior.status===200?prior.data?.sha:null;
    if(prior.status===200&&!sha)throw new Error('기존 원본 SHA 확인 실패');
    const body={message:'Update latest garages '+payload.generatedAt,content:base64Utf8(JSON.stringify(payload,null,2)),branch:'main'};
    if(sha)body.sha=sha;
    const saved=await ghRequest('PUT',token,JSON.stringify(body));
    if(saved.status!==200&&saved.status!==201)throw new Error('GitHub 업로드 HTTP '+saved.status+' · '+String(saved.data?.message||''));
    if(!saved.data?.content?.sha)throw new Error('GitHub 저장 응답 검증 실패');
    return true;
  }

  function ensureGhToken(){
    if(localStorage.getItem(GH_TOKEN_KEY))return true;
    // Prompt before the first await: mobile browsers can reject a delayed prompt.
    const input=(window.prompt('GitHub 차고 업로드 토큰을 이 브라우저에 입력하세요 (Contents 읽기/쓰기). 채팅에 공유하지 마세요.')||'').trim();
    if(!input)return false;
    localStorage.setItem(GH_TOKEN_KEY,input);return true;
  }
  async function publishAiGarageJson(){
    const payload=aiGaragePayload(),token=localStorage.getItem(GH_TOKEN_KEY)||'';
    if(!token){note('GitHub 인증 토큰 없음');return false;}
    note('6/6명 수집 완료 · GitHub 업로드 중…');
    try{
      await uploadAiGarageJson(payload,token);
      note('GitHub 자동 업로드 성공 · '+toKst(payload.generatedAt)+' · 총 '+payload.participants.reduce((n,p)=>n+p.vehicleCount,0)+'대');
      return true;
    }catch(e){
      const err=String(e?.message||e);
      if(/HTTP 401/.test(err))localStorage.removeItem(GH_TOKEN_KEY);
      try{downloadAiGarageJson(payload);}catch(_){}
      note('GitHub 업로드 실패: '+err+' · 로컬 백업 확인');
      return false;
    }
  }

  function rowsReady(rows){return rows.length===6&&rows.every(x=>x.owner)&&new Set(rows.map(x=>x.owner)).size===6;}
  function navButton(re){
    return [...document.querySelectorAll('button,[role="button"],[role="tab"],a')]
      .find(el=>el.getClientRects().length&&!el.disabled&&clean(el.innerText||el.textContent).length<36&&re.test(clean(el.innerText||el.textContent)))||null;
  }
  async function awaitRows(ms=3200){
    const start=Date.now();
    while(Date.now()-start<ms){const r=participantRows();if(rowsReady(r))return r;await pause(180);}
    return participantRows();
  }
  async function findRows(){
    let rows=participantRows();if(rowsReady(rows))return rows;
    const garage=activeGaragePanel();
    if(garage&&closeGarage(garage)){note('열린 차고 닫는 중…');await pause(250);rows=participantRows();if(rowsReady(rows))return rows;}
    let tab=navButton(/참가자\s*현황/);
    if(tab){note('참가자 현황으로 이동 중…');tab.click();rows=await awaitRows();if(rowsReady(rows))return rows;}
    const shop=navButton(/(?:^|\s)상점\s*$/);
    if(shop){note('상점 화면 이동 중…');shop.click();await pause(400);tab=navButton(/참가자\s*현황/);
      if(tab){tab.click();rows=await awaitRows();if(rowsReady(rows))return rows;}
      rows=await awaitRows(1000);
    }
    return rows;
  }
  function done(status,stage,msg,results){
    lastRefresh={status,ok:status==='success',stage,message:msg,timeKst:toKst(date()),results:results||[]};
    note(msg);return lastRefresh;
  }
  async function refreshAllGarages() {
    if(fleetRefreshing||collecting)return {ok:false,stage:'busy',message:'이미 수집 중'};
    if(!ensureGhToken())return done('failed','auth','GitHub 업로드 토큰이 없어 갱신하지 않았습니다');
    fleetRefreshing=true;lastRefresh={status:'running',stage:'navigate',message:'차고 갱신 시작',results:[]};
    const results=[];let successes=0;
    try{
      const initial=await findRows();
      if(!rowsReady(initial))return done('failed','navigation','참가자 인식 실패 '+initial.filter(x=>x.owner).length+'/6 · 상점 → 참가자 현황 화면 확인',results);
      for(let i=0;i<initial.length;i++){
        const owner=initial[i].owner;note('차고 수집 '+(i+1)+'/6 · '+owner);
        const row=participantRows().find(x=>x.owner===owner);
        if(!row||!row.button.isConnected){results.push({owner,ok:false,reason:'행 없음'});continue;}
        row.button.click();const p=await waitForGarage(owner);
        if(!p){results.push({owner,ok:false,reason:'차고 팝업/소유주 확인 실패'});continue;}
        await pause(250);const ok=await captureGarage(true,owner);
        const garage=db.garages[owner];
        const reason=ok?garage.vehicles.length+'종/'+garage.vehicles.reduce((n,v)=>n+v.qty,0)+'대':(lastCaptureFailure||'차량 수집 실패');
        results.push({owner,ok:!!ok,reason});if(ok)successes++;
        note((i+1)+'/6 '+owner+' '+(ok?'저장':'실패')+' · '+reason);
        if(!closeGarage(p)){results.push({owner,ok:false,reason:'차고 닫기 실패'});break;}
        await pause(350);
      }
      if(successes!==6)return done('failed','scanning','차고 갱신 실패 '+successes+'/6 · '+results.filter(r=>!r.ok).map(r=>r.owner+': '+r.reason).join(' / ')+' · 원본 업로드 보류',results);
      const uploaded=await publishAiGarageJson();
      return done(uploaded?'success':'failed','upload',message,results);
    }catch(e){return done('failed','exception','차고 갱신 예외: '+String(e?.message||e),results);}
    finally{fleetRefreshing=false;}
  }
  function tradeScreen() {
    const titles=['전체 공지','유저장터 거래현황 전체보기','딜러 매입 현황 전체보기'];
    const headings=[...document.querySelectorAll('h1,h2,h3,h4,div,span,strong')].filter(el=>{
      if(el===root||root.contains(el)||!el.getClientRects().length) return false;
      const t=(el.textContent||'').trim();
      return t.length<45&&titles.includes(t);
    });
    for(const h of headings) {
      let node=h;
      for(let i=0;i<12&&node.parentElement;i++) {
        node=node.parentElement;
        const t=node.innerText||'';
        if(t.length>250000) break;
        if(/(?:\d{2}\.\d{2}\.\d{2}\.?\s*\d{2}:\d{2}|차량출고|거래 완료|매입)/.test(t)&&t.length>80)
          return {type:h.textContent.trim(),container:node};
      }
    }
    return null;
  }
  function tradeRows(container) {
    const rows=[];
    const nodes=[...container.querySelectorAll('div,li,article,section')].filter(el=>el!==root&&!root.contains(el));
    const valid=t=>/(\d{2}\.\d{2}\.\d{2}\.?\s*\d{2}:\d{2})/.test(t)&&/(차량출고|거래\s*완료|매입|출고|성사)/.test(t)&&/(★\s*[1-5]|⚡\s*\d+)/.test(t);
    for(const el of nodes){
      const t=(el.innerText||el.textContent||'').trim();
      if(t.length<25||t.length>1000||!valid(t))continue;
      if([...el.children].some(ch=>{const ct=(ch.innerText||ch.textContent||'').trim();return ct.length>=25&&valid(ct)}))continue;
      rows.push(t);
    }
    return [...new Set(rows)];
  }
  function parseTradeEntry(raw,screen) {
    const t=clean(raw);
    const time=t.match(/(\d{2}\.\d{2}\.\d{2}\.?\s*\d{2}:\d{2})/);
    const names='그레이트|픸홀|픽홀|핔홀|핗홀|참돔|킹황|갱서|ㅇ발|○발|◯발|〇발|구레긔|피콜로|ㅇ샘|영감|톩끼';
    const pair=t.match(new RegExp('('+names+')\\s*(?:→|->)\\s*('+names+')'));
    const stars=t.match(/★\s*([1-5])/);
    let type=screen==='유저장터 거래현황 전체보기'?'market':screen==='딜러 매입 현황 전체보기'?'dealer':'notice';
    if(type==='notice') {
      if(/차량\s*출고|출고!/.test(t)) type='shipment';
      else if(/초롱이|거래\s*성사/.test(t)) type='dealer_notice';
      else return null;
    }
    let seller=null,buyer=null,model=null;
    if(type==='market'&&pair) {
      seller=who(pair[1]);buyer=who(pair[2]);
      const tail=t.slice(t.indexOf(pair[0])+pair[0].length);
      model=(tail.match(/^[\s·:]*([^★⚡]+?)\s*★\s*[1-5]/)||[])[1];
    } else if(type==='dealer') {
      const m=t.match(new RegExp('('+names+')\\s*의\\s*(.+?)\\s*★\\s*[1-5]'));
      if(m){seller=who(m[1]);model=m[2];}
    } else if(type==='shipment') {
      // Notice text: "픽홀, 제네시스 G70 출고! · ★1".
      const m=t.match(new RegExp('('+names+')\\s*[,，]\\s*(.+?)\\s*출고!?\\s*[·:]?\\s*★\\s*[1-5]'));
      if(m){seller=who(m[1]);model=m[2];}
    } else if(type==='dealer_notice') {
      const m=t.match(new RegExp('('+names+')\\s*[,，]\\s*원치\\s*않은\\s*쿨거래\\s*성사!?\\s*(.+?)\\s*⚡'));
      if(m){seller=who(m[1]);model=m[2];}
    }
    if(type==='market'&&(!seller||!model)){
      const m=t.match(new RegExp('('+names+')\\s*(?:→|->)\\s*('+names+')\\s*[·:]?\\s*([^★⚡]+?)\\s*★\\s*([1-5])'));
      if(m){seller=who(m[1]);buyer=who(m[2]);model=m[3];}
    }
    if(!seller||!model||!stars)return null;
    model=clean(model).replace(/^[·:]\s*/,'').replace(/[!·:]\s*$/,'');
    const price=t.match(/⚡\s*([\d,]+)/);
    return {type,screen,seller,buyer,model,stars:Number(stars[1]),price:price?Number(price[1].replace(/,/g,'')):null,occurredAt:time?time[1]:null,raw:t,observedAt:date(),parsed:true};
  }
  function reparseStoredTrades() {
    let updated=0;
    for(const old of db.transactions){
      if(old.parsed||!old.raw||!old.screen)continue;
      const parsed=parseTradeEntry(old.raw,old.screen);
      if(parsed){
        Object.assign(old,parsed,{observedAt:old.observedAt||parsed.observedAt});
        updated++;
      }
      old.category=classifyFeedItem(old);
    }
    if(updated)save();
    return updated;
  }
  function classifyFeedItem(item) {
    const raw=String(item.raw||'');
    if(item.screen!=='전체 공지') return 'vehicle';
    if(/차량출고|출고!|거래\s*성사|쿨거래|블로저/.test(raw)&&/★\s*[1-5]/.test(raw))return 'vehicle';
    return 'other';
  }
  function tradeScrollContainer(container) {
    const nodes=[container,...container.querySelectorAll('*')].filter(el=>el!==root&&!root.contains(el));
    return nodes.filter(el=>{
      const cs=getComputedStyle(el);
      return el.clientHeight>120&&el.scrollHeight>el.clientHeight+25&&/(auto|scroll)/.test(cs.overflowY);
    }).sort((a,b)=>(b.scrollHeight-b.clientHeight)-(a.scrollHeight-a.clientHeight))[0]||null;
  }
  db.feedCheckpoints=db.feedCheckpoints||{};
  function feedTimestamp(raw) {
    const m=String(raw||'').match(/(?:^|\s)(\d{2})\.(\d{2})\.(\d{2})\.\s*(\d{2}):(\d{2})/);
    if(!m)return null;
    return '20'+m[1]+'-'+m[2]+'-'+m[3]+'T'+m[4]+':'+m[5];
  }
  let tradeCollecting=false;
  async function captureTrades(silent=false) {
    if(tradeCollecting)return;
    const screen=tradeScreen();
    if(!screen){if(!silent)note('전체 공지 / 유저장터 / 딜러 매입 화면을 열어주세요.');return;}
    tradeCollecting=true;
    const scroll=tradeScrollContainer(screen.container);
    const oldTop=scroll?scroll.scrollTop:0;
    const found=new Set();
    const checkpoint=db.feedCheckpoints[screen.type]||null;
    const collect=()=>{for(const raw of tradeRows(screen.container))found.add(raw);};
    let complete=!scroll;
    try {
      if(!silent)note(screen.type+' 전체 내역 스크롤 수집 중…');
      collect();
      if(scroll){
        scroll.scrollTop=0;await pause(180);collect();
        let stable=0;
        for(let i=0;i<160;i++){
          if(!scroll.isConnected||!screen.container.isConnected)break;
          const before=scroll.scrollTop;
          scroll.scrollTop=Math.min(scroll.scrollHeight,before+Math.max(140,Math.floor(scroll.clientHeight*.75)));
          await pause(100);collect();
          if(scroll.scrollTop===before)stable++;else stable=0;
          if(stable>=2&&scroll.scrollTop+scroll.clientHeight>=scroll.scrollHeight-5){complete=true;break;}
        }
      }
      const reparsed=reparseStoredTrades();
      let added=0,skipped=0,rawAdded=0,parsedAdded=0,vehicleCount=0,otherCount=0,older=0,latest=null,undated=0;
      for(const raw of found){
        const stamp=feedTimestamp(raw);
        if(stamp&&(!latest||stamp>latest))latest=stamp;
        if(checkpoint&&stamp&&stamp<checkpoint&&!db.transactions.some(x=>x.screen===screen.type&&!x.parsed&&feedTimestamp(x.raw)===stamp)){older++;continue;}
        if(!stamp)undated++;
        let item=parseTradeEntry(raw,screen.type);
        if(!item) {
          // Preserve an unparsed source entry without inventing seller, car or transaction.
          const t=clean(raw);
          const tm=t.match(/(\d{2}\.\d{2}\.\d{2}\.?\s*\d{2}:\d{2})/);
          item={type:'unparsed',screen:screen.type,seller:null,buyer:null,model:null,stars:null,price:null,
            occurredAt:tm?tm[1]:null,raw:t,parsed:false,observedAt:date()};
        } else {item.parsed=true;}
        item.category=classifyFeedItem(item);
        const key='feed|'+screen.type+'|'+clean(raw);
        const old=db.transactions.find(x=>x.screen===screen.type&&!x.parsed&&stamp&&feedTimestamp(x.raw)===stamp&&clean(x.raw).length<clean(raw).length);
        if(old&&item.parsed){
          Object.assign(old,item,{observedAt:old.observedAt||item.observedAt});
          db.seen.push(key);parsedAdded++;continue;
        }
        if(db.seen.includes(key))continue;
        db.seen.push(key);db.transactions.push(item);added++;
        if(item.parsed)parsedAdded++;else rawAdded++;
        if(item.category==='vehicle')vehicleCount++;else otherCount++;
      }
      for(const item of db.transactions)if(!item.category)item.category=classifyFeedItem(item);
      db.seen=db.seen.slice(-6000);db.transactions=db.transactions.slice(-4000);
      if(complete&&latest&&undated===0)db.feedCheckpoints[screen.type]=!checkpoint||latest>checkpoint?latest:checkpoint;
      save();
      if(added||!silent)note(screen.type+': 신규 '+added+'건 (차량 관련 '+vehicleCount+' / 기타 '+otherCount+' / 신규 구조화 '+parsedAdded+' / 기존 재분석 '+reparsed+' / 원문 '+rawAdded+') / 이전 기록 건너뜀 '+older+' / 기준 '+(db.feedCheckpoints[screen.type]||'미설정')+' / 누적 '+db.transactions.length+'건'+(complete?' (끝까지 확인)':' (일부만 확인)'));
    }catch(e){if(!silent)note('거래 수집 오류: '+String(e.message||e));}
    finally{if(scroll&&scroll.isConnected)scroll.scrollTop=oldTop;tradeCollecting=false;}
  }
  function exportJson() {
    const blob = new Blob([JSON.stringify(db,null,2)],{type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'dopamine-fleet-'+date().slice(0,10)+'.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  function render() {
    root.style.setProperty('width','min(230px, calc(100vw - 16px))','important');
    const busy=fleetRefreshing||collecting;
    const status=String(message||'');
    const shortStatus=status.includes('GitHub 자동 업로드 성공')?'업로드 완료 ✓':
      status.includes('업로드 중')?'GitHub 업로드 중…':
      status.includes('전체 차고 갱신')?status.match(/전체 차고 갱신 \d+\/6[^:]*/)?.[0]||'차고 수집 중…':
      status.includes('오류')||status.includes('실패')||status.includes('보류')||status.includes('미등록')?status:'';
    shadow.innerHTML='<style>:host{all:initial}*{box-sizing:border-box}.wrap{font:12px system-ui,sans-serif;color:#f4f6fa;background:#172334;border:1px solid #71859b;border-radius:9px;box-shadow:0 3px 15px #0008;padding:6px;max-width:230px}button{width:100%;background:#395471;color:#fff;border:1px solid #9aafc4;border-radius:6px;padding:8px 10px;cursor:pointer;font-weight:700;font-size:12px}button:disabled{opacity:.65;cursor:wait}.status{font-size:10px;line-height:1.35;color:#d7e0ee;margin-top:4px;overflow-wrap:anywhere;max-height:62px;overflow:auto}</style>'+
      '<div class="wrap"><button id="fleet" '+(busy?'disabled':'')+'>🚗 차량 분석기 '+VERSION+' · '+(busy?'갱신 중…':'차량 갱신')+'</button>'+
      (shortStatus?'<div class="status" title="'+escapeHtml(status)+'">'+escapeHtml(shortStatus)+'</div>':'')+'</div>';
    shadow.getElementById('fleet').onclick=refreshAllGarages;
  }
  function relocateOverlay() {
    if(window.__duMode){root.style.setProperty('display','none','important');return;}
    // Ordinary CSS modals are not in the browser top layer: mount on body.
    // Only native showModal() dialogs require the toolbar inside the dialog.
    const nativeDialogs=[...document.querySelectorAll('dialog[open]')]
      .filter(d=>d.getClientRects().length&&d.matches(':modal'));
    const parent=nativeDialogs[nativeDialogs.length-1]||document.body;
    if(root.parentElement!==parent) parent.appendChild(root);
    root.style.setProperty('position','fixed','important');
    root.style.setProperty('right','8px','important');
    root.style.setProperty('bottom','8px','important');
    root.style.setProperty('z-index','2147483647','important');
    root.style.setProperty('visibility','visible','important');
    root.style.setProperty('opacity','1','important');
    root.style.setProperty('display','block','important');
  }
  if(window.__duMode)window.__duFleet={refresh:refreshAllGarages,exportJson,captureTrades,state:()=>({busy:fleetRefreshing||collecting,message,users:Object.keys(db.garages||{}).length,version:VERSION,lastRefresh})};
  function init() {
    document.body.appendChild(root);
    relocateOverlay();
    root.style.setProperty('position','fixed','important');
    root.style.setProperty('right','8px','important');
    root.style.setProperty('bottom','8px','important');
    root.style.setProperty('width','min(230px, calc(100vw - 16px))','important');
    root.style.setProperty('z-index','2147483647','important');
    root.style.setProperty('display','block','important');
    render();
    if(window.__duMode)root.style.setProperty('display','none','important');
    setInterval(relocateOverlay,1200);
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();