// ==UserScript==
// @name         도파민 레이스 통합 컨트롤
// @namespace    dopamine-race-unified
// @version      1.1.0
// @description  고정 GitHub 부트스트랩: 게임 접속마다 최신 AUTO·차고·통합 UI 직접 로딩 (Release 3.0 유지)
// @match        https://luck-game-hjh.jihwan1010.chatgpt.site/*
// @updateURL    https://raw.githubusercontent.com/tnsdudhaha-ops/dopamine-race-auto/main/dopamine-race-unified.user.js
// @downloadURL  https://raw.githubusercontent.com/tnsdudhaha-ops/dopamine-race-auto/main/dopamine-race-unified.user.js
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        unsafeWindow
// @connect      api.github.com
// @connect      raw.githubusercontent.com
// @connect      script.google.com
// @connect      script.googleusercontent.com
// @run-at       document-idle
// ==/UserScript==
(function(){
'use strict';
// This installed file is deliberately stable. All three runtime modules are downloaded
// from one immutable GitHub commit on EVERY navigation, independently of Tampermonkey updates.
const page=unsafeWindow, repo='tnsdudhaha-ops/dopamine-race-auto';
if(page.__dopamineUnifiedControl?.active||page.__duBootstrap?.loading)return;
const CACHE_KEY='dopamine-unified:verified-runtime-bundle-v1';
const PARTS=[
  {name:'auto',path:'dopamine-race-auto.user.js',signature:'const VERSION=',bridge:'window.__duAuto'},
  {name:'fleet',path:'dopamine-fleet-tracker.runtime.js',signature:'Dopamine Fleet Tracker runtime',bridge:'window.__duFleet'},
  {name:'ui',path:'dopamine-race-unified-ui.runtime.js',signature:'Dopamine Unified UI runtime',bridge:'__dopamineUnifiedControl'}
];
const state={loading:true,source:'loading',commit:null,autoVersion:null,error:null};
page.__duBootstrap=state;
function status(text,error=false,persistent=false){
  try{
    let element=document.getElementById('dopamine-unified-bootstrap-status');
    if(!element){
      element=document.createElement('div');
      element.id='dopamine-unified-bootstrap-status';
      element.style.cssText='position:fixed;left:8px;top:8px;z-index:2147483647;max-width:92vw;padding:8px 11px;border-radius:7px;background:#17324a;color:white;font:12px system-ui,sans-serif;box-shadow:0 2px 8px #0009;pointer-events:none';
      (document.body||document.documentElement).appendChild(element);
    }
    element.textContent=text;
    if(error)element.style.background='#9f1239';
    if(!persistent)setTimeout(()=>{if(element.isConnected)element.remove();},5500);
  }catch(_){}
  (error?console.error:console.info)('[Dopamine Unified Bootstrap]',text);
}
function get(url){
  return new Promise((resolve,reject)=>{
    GM_xmlhttpRequest({
      method:'GET',url,timeout:15000,
      headers:{'Accept':'application/vnd.github+json','Cache-Control':'no-cache'},
      onload:r=>r.status===200?resolve(r.responseText):reject(new Error('HTTP '+r.status)),
      onerror:()=>reject(new Error('GitHub connection error')),
      ontimeout:()=>reject(new Error('GitHub request timeout'))
    });
  });
}
function validate(bundle){
  if(!bundle||typeof bundle.commit!=='string'||!Array.isArray(bundle.sources)||bundle.sources.length!==PARTS.length)
    throw new Error('잘못된 런타임 묶음');
  if(!/^[a-f0-9]{40}$/.test(bundle.commit))throw new Error('GitHub 커밋 검증 실패');
  return PARTS.map((part,i)=>{
    const s=bundle.sources[i];
    if(typeof s!=='string'||s.length<200||!s.includes(part.signature)||!s.includes(part.bridge))
      throw new Error(part.path+' 형식/호환성 확인 실패');
    if(part.name==='auto'&&!s.startsWith('// ==UserScript=='))throw new Error('AUTO 파일 형식 오류');
    if(part.name==='ui'&&!s.startsWith('// Dopamine Unified UI runtime'))throw new Error('통합 UI 파일 형식 오류');
    return new Function('window','document','localStorage','GM_xmlhttpRequest','GM_getValue','GM_setValue','unsafeWindow',s+'\n//# sourceURL=dopamine-github-'+part.name+'.js');
  });
}
function run(bundle,fromCache){
  // Never mix components from different commits or launch partial downloads.
  const compiled=validate(bundle);
  if(page.__dopamineUnifiedControl?.active)return;
  if(document.getElementById('dft-root')&&!page.__duFleet)
    throw new Error('별도 차량 추적기가 실행 중입니다. 중복 스크립트를 비활성화한 후 새로고침하세요.');
  if(page.__dopamineAutoActive&&!page.__duMode)
    throw new Error('별도 AUTO가 실행 중입니다. 독립 AUTO/Loader를 비활성화한 후 새로고침하세요.');
  page.__duMode=true;
  const args=[page,document,page.localStorage,GM_xmlhttpRequest,GM_getValue,GM_setValue,page];
  let started=false;
  try{
    page.__duUnifiedLoadingAuto=true;started=true;
    try{compiled[0](...args);}finally{page.__duUnifiedLoadingAuto=false;}
    if(typeof page.__duAuto?.state!=='function')throw new Error('AUTO 통합 인터페이스 없음');
    compiled[1](...args);
    if(typeof page.__duFleet?.state!=='function')throw new Error('차고 통합 인터페이스 없음');
    compiled[2](...args);
    if(!page.__dopamineUnifiedControl?.active)throw new Error('통합 UI 시작 실패');
  }catch(e){
    state.partiallyStarted=started;
    throw e;
  }
  state.source=fromCache?'cached':'github';
  state.commit=bundle.commit;
  state.autoVersion=page.__duAuto.state().version||'unknown';
  state.loading=false;
  if(!fromCache){try{page.localStorage.setItem(CACHE_KEY,JSON.stringify(bundle));}catch(_){}}
  status(fromCache?'GitHub 연결 실패 · 마지막 정상 통합 버전 사용 중':
    'GitHub 최신 통합 로드 완료 · AUTO v'+state.autoVersion+' · '+bundle.commit.slice(0,7),
    false,fromCache);
}
async function main(){
  status('GitHub 최신 AUTO · 차고 · 통합 UI 확인 중…',false,true);
  try{
    const api='https://api.github.com/repos/'+repo+'/commits/main?_='+Date.now();
    const head=JSON.parse(await get(api));
    if(!/^[a-f0-9]{40}$/.test(head.sha||''))throw new Error('커밋 응답 검증 실패');
    const sources=await Promise.all(PARTS.map(p=>get(
      'https://raw.githubusercontent.com/'+repo+'/'+head.sha+'/'+p.path+'?p='+Date.now()
    )));
    run({commit:head.sha,sources},false);
  }catch(error){
    if(state.partiallyStarted){
      state.loading=false;state.error=String(error?.message||error);
      status('통합 실행 중 오류: '+state.error+' · 새로고침 전 주행 금지',true,true);
      return;
    }
    try{
      const cached=JSON.parse(page.localStorage.getItem(CACHE_KEY)||'null');
      if(!cached)throw new Error('검증된 이전 실행 파일 없음');
      run(cached,true);
    }catch(fallbackError){
      state.loading=false;state.source='error';
      state.error=String(error?.message||error)+' / '+String(fallbackError?.message||fallbackError);
      status('통합 AUTO 로드 실패: '+state.error,true,true);
    }
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',main,{once:true});
else main();
})();
