// Dopamine Unified UI runtime — loaded from pinned GitHub commit by the stable bootstrap.
// This file is not a userscript. The bootstrap provides page window and GM upload functions.
// UI revision: display GOOD/BAD/MISS explicitly while preserving the frozen GitHub bootstrap.
(function () {
'use strict';
if(window.__dopamineUnifiedControl?.active)return;
const autoRoot=document.getElementById('dopamine-auto-v336-ui');
if(autoRoot)autoRoot.style.setProperty('display','none','important');
const box=document.createElement('div');box.id='du-integrated';
box.innerHTML='<style>'+
'#du-integrated *{box-sizing:border-box}#du-integrated{font:11px/1.38 system-ui,sans-serif;color:#e9f3ff}'+
'#du-integrated .panel{width:208px;max-width:calc(100vw - 16px);background:#152337;border:1px solid #667b91;border-radius:10px;padding:7px;box-shadow:0 5px 19px #0009;max-height:calc(100vh - 16px);overflow-y:auto;overscroll-behavior:contain}'+
'#du-integrated button{border:0;border-radius:5px;color:white;background:#38536e;padding:7px 3px;min-height:32px;font:700 10px/1.3 system-ui,sans-serif;cursor:pointer}'+
'#du-integrated button:disabled{opacity:.48;cursor:not-allowed}'+
'#du-integrated .head{display:flex;align-items:center;justify-content:space-between;gap:4px;touch-action:none;margin-bottom:5px;cursor:move}'+
'#du-integrated .head strong{font-size:12px;white-space:nowrap}#du-integrated .head-actions{display:flex;align-items:center;gap:3px}'+
'#du-integrated .head-actions button{padding:3px 5px;min-height:26px;white-space:nowrap;font-size:10px}'+
'#du-integrated #du-auto{background:#166b44}#du-integrated .grid{display:grid;grid-template-columns:1fr 1fr;gap:4px}'+
'#du-integrated .section{margin-top:5px;padding-top:5px;border-top:1px solid #405266}'+
'#du-integrated .status{font-size:10px;color:#bfd2e5;white-space:pre-wrap;overflow-wrap:anywhere;margin-top:4px}'+
'#du-integrated #du-status{font-size:10px;color:#e9f3ff;max-height:34px;overflow:hidden}'+
'#du-integrated #du-race-status{max-height:65px;overflow:hidden;line-height:1.35}'+
'#du-integrated #du-cloud-state{max-height:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9px;color:#9eb5cb}'+
'#du-integrated .run-config{display:flex;align-items:center;gap:5px;margin-bottom:5px;white-space:nowrap;font-size:10px;color:#cad9ec}'+
'#du-integrated .run-config input{width:45px;min-width:45px;padding:4px 3px;text-align:center}'+
'#du-integrated .run-config small{font-size:9px;color:#97b0c9}'+
'#du-integrated .report{background:#0e1b2b;border-radius:4px;padding:5px;max-height:200px;overflow:auto;white-space:pre-wrap;font-size:10px}'+
'#du-integrated label{display:block;font-size:10px;margin-top:5px}#du-integrated input{width:100%;padding:5px;background:#102034;border:1px solid #6c839d;border-radius:5px;color:#fff}'+
'#du-integrated .settings{max-height:180px;overflow:auto}#du-integrated #du-advanced .grid button{font-size:9px}'+
'#du-integrated .racing .run-config,#du-integrated .racing .race-buttons{display:none}'+
'#du-integrated .racing #du-status{max-height:18px}#du-integrated .racing #du-race-status{max-height:65px}'+
'</style>'+
'<div class="panel"><div class="head"><strong>🏎 AUTO</strong><div class="head-actions"><button id="du-auto">주행</button><button id="du-analyze">📊</button><button id="du-tools">⚙</button></div></div>'+
'<div class="status" id="du-status">초기화 중…</div>'+
'<div class="section" id="du-race"><label class="run-config">연속 <input id="du-run-limit" type="number" min="0" max="18" step="1" value="0" inputmode="numeric">판 <small>(0=타이어 모두)</small></label><div class="grid race-buttons"><button id="du-one">▶ 1판</button><button id="du-chain">🔁 연속</button><button id="du-stop" style="background:#a5313e">■ 중지</button><button id="du-garage">🚗 차고 갱신</button></div><div class="status" id="du-race-status"></div></div>'+
'<div class="status" id="du-cloud-state">☁ Google Sheets 확인 중…</div>'+
'<div class="section" id="du-advanced" hidden><div class="grid"><button id="du-log">📋 입력 기록 복사</button><button id="du-copy-analysis">📋 누적 분석 복사</button><button id="du-json">💾 누적 JSON 저장</button><button id="du-detect">🔍 차량 다시 읽기</button><button id="du-defaults">↩ 설정 초기화</button><button id="du-export">📥 차고 백업</button><button id="du-trades">🧾 거래 기록 수집</button><button id="du-force">⛔ 긴급 즉시 중지</button><button id="du-cloud-config">☁ 시트 연결 설정</button><button id="du-cloud-retry">☁ 미전송 기록 전송</button></div><div class="settings" id="du-settings"></div><div class="status" id="du-diagnostics"></div><button style="width:100%;margin-top:6px" id="du-save">⚙ AUTO 설정 저장</button></div>'+
'<div class="section" id="du-report" hidden><div class="report" id="du-report-body"></div><button style="width:100%;margin-top:6px" id="du-report-close">주행 화면으로</button></div></div>';
document.body.appendChild(box);
const q=s=>box.querySelector(s),autoUi=()=>document.getElementById('dopamine-auto-v336-ui');
const press=id=>{const e=autoUi()?.querySelector('#'+id);if(!e)return false;e.click();return true;};
const getA=()=>window.__duAuto?.state?.()||{}, getF=()=>window.__duFleet?.state?.()||{};

/* Google Sheets uploader ported from the preexisting AUTO Loader v1.1.2.
 * GM credentials are isolated per Tampermonkey script: one-time configuration required.
 * Race events are read from the original game-origin localStorage; AUTO engine unchanged.
 */
const cloudUploader=(()=>{
  const RUNS_KEY='dopamine-auto-v336:runs';
  const CFG_URL='dopamine-uploader:url',CFG_KEY='dopamine-uploader:key',SENT_KEY='dopamine-uploader:sent';
  const ENDPOINT_PATTERN=/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/;
  let sending=false,retryAfter=0,message='초기화 중',lastSuccess='',timer=null,disposed=false;
  const read=(k,fallback='')=>{try{return GM_getValue(k,fallback);}catch(_){return fallback;}};
  const write=(k,v)=>GM_setValue(k,v);
  const sentIds=()=>{try{const arr=JSON.parse(read(SENT_KEY,'[]'));return Array.isArray(arr)?arr:[];}catch(_){return [];}};
  const state=()=>({message,sending,configured:!!(read(CFG_URL)&&read(CFG_KEY)),lastSuccess});
  function report(msg){message=msg;const e=q('#du-cloud-state');if(e)e.textContent='☁ Google Sheets · '+msg;console.info('[Dopamine Unified] Sheets:',msg);}
  function uploadPending(force=false){
    if(disposed)return;
    if(sending){if(force)report('전송 중 · 완료 후 자동 재확인');return;}
    if(Date.now()<retryAfter&&!force)return;
    const url=read(CFG_URL),key=read(CFG_KEY);
    if(!url||!key||!ENDPOINT_PATTERN.test(url)){report('연결 설정 필요 · ⚙ → 시트 연결 설정');return;}
    let runs;
    try{runs=JSON.parse(localStorage.getItem(RUNS_KEY)||'[]');if(!Array.isArray(runs))throw Error('기록 형식 오류');}
    catch(e){report('로컬 기록 읽기 실패 · '+String(e?.message||e));return;}
    const sent=new Set(sentIds());
    const pending=runs.filter(r=>r&&r.runId&&!sent.has(r.runId));
    if(!pending.length){report('전송 완료 · 로컬 '+runs.length+'건 확인');return;}
    const run=pending[0],body=JSON.stringify({uploadKey:key,run});
    if(body.length>1800000){retryAfter=Date.now()+60000;report('기록 용량 초과 · '+run.runId);return;}
    sending=true;report('전송 중 · 미전송 '+pending.length+'건 · '+run.runId);
    try{GM_xmlhttpRequest({
      method:'POST',url,
      headers:{'Content-Type':'text/plain;charset=utf-8'},data:body,timeout:30000,
      onload(response){
        sending=false;if(disposed)return;
        let result;try{result=JSON.parse(response.responseText||'');}catch(_){}
        if(response.status>=200&&response.status<300&&result?.ok===true&&
           (result.status==='SAVED'||result.status==='ALREADY_SAVED')&&result.runId===run.runId){
          const ids=sentIds();if(!ids.includes(run.runId))ids.push(run.runId);
          write(SENT_KEY,JSON.stringify(ids.slice(-1000)));
          lastSuccess=run.runId;retryAfter=0;
          report((result.status==='ALREADY_SAVED'?'기존 기록 확인':'저장 성공')+' · '+run.runId);
          setTimeout(()=>uploadPending(),1000);
        }else{retryAfter=Date.now()+60000;report('전송 실패 · '+(result?.status||'HTTP '+response.status)+' · 60초 후 재시도');}
      },
      onerror(){sending=false;retryAfter=Date.now()+60000;report('네트워크 오류 · 60초 후 재시도');},
      ontimeout(){sending=false;retryAfter=Date.now()+60000;report('응답 시간 초과 · 60초 후 재시도');}
    });}catch(e){sending=false;retryAfter=Date.now()+60000;report('전송 실행 오류 · '+String(e?.message||e));}
  }
  function configure(){
    const previous=String(read(CFG_URL,'')||'');
    const url=window.prompt('Google Apps Script 웹 앱 URL (/exec)을 입력하세요.',previous);
    if(url===null)return;
    const clean=url.trim();if(!ENDPOINT_PATTERN.test(clean)){window.alert('올바른 Apps Script /exec 주소가 아닙니다.');return;}
    const keyRaw=window.prompt('UPLOAD_KEY를 입력하세요. 기존 통합판 연결 키를 유지하려면 빈칸으로 확인하세요.','');
    if(keyRaw===null)return;
    const key=keyRaw.trim()||String(read(CFG_KEY,'')||'');
    if(!key){window.alert('UPLOAD_KEY를 입력하세요.');return;}
    try{write(CFG_URL,clean);write(CFG_KEY,key);}catch(e){report('연결 정보 저장 실패 · '+String(e?.message||e));return;}
    retryAfter=0;report('연결 정보 저장 · 미전송 기록 검사 중');uploadPending(true);
  }
  report(read(CFG_URL)&&read(CFG_KEY)?'연결됨 · 로컬 기록 검사 중':'연결 설정 필요 · ⚙ → 시트 연결 설정');
  timer=setInterval(()=>uploadPending(),7000);
  setTimeout(()=>uploadPending(),2500);
  return {configure,retry:()=>{retryAfter=0;uploadPending(true);},state,destroy:()=>{disposed=true;clearInterval(timer);}};
})();
const fieldNames=[['brakeY','브레이크 판정선 Y'],['boostY','부스터 판정선 Y'],['brakeOffset','브레이크 보정 px'],['boostOffset','부스터 보정 px'],['predictionMs','예측 시간 ms'],['boostZones','부스터 구간 수'],['colorTolerance','색상 허용 오차'],['tolerance','판정 허용 오차']];
let view='race',notice='',drag=null,moved=false;
function settings(){const list=q('#du-settings');list.replaceChildren();const pl=document.createElement('label'),pi=document.createElement('input');pl.textContent='학습 프로필 (선택)';pi.type='text';pi.dataset.profile='yes';pi.value=autoUi()?.querySelector('#vehicleProfile')?.value??'';pl.appendChild(pi);list.appendChild(pl);for(const [id,title] of fieldNames){const label=document.createElement('label'),input=document.createElement('input');label.textContent=title;input.type='number';input.dataset.field=id;input.value=autoUi()?.querySelector('#'+id)?.value??'';label.appendChild(input);list.appendChild(label);}}
function analysis(){press('analysis-refresh');q('#du-report-body').textContent=autoUi()?.querySelector('#analysis-summary')?.textContent||'저장된 주행 기록이 없습니다.';}
function toggle(name){view=name;if(view==='tools')settings();if(view==='report')analysis();render();position();}
function say(m){notice=m;render();}
function relocate(){const dialogs=[...document.querySelectorAll('dialog[open]')].filter(d=>d.getClientRects().length&&d.matches(':modal'));const target=dialogs[dialogs.length-1]||document.body;if(box.parentElement!==target)target.appendChild(box);}
function render(){
 const a=getA(),f=getF(),active=!!(a.running||a.chainEnabled),busy=!!f.busy;
 const tm=a.lastRaceTiming,lap=tm?.recordedLapTimeSec;
 const gameLap=tm?.complete?(Number.isFinite(lap)?lap:(Number.isFinite(tm.resultTimeSec)?tm.resultTimeSec:tm.hudAtFinishSec)):null;
 const lastTime=Number.isFinite(gameLap)?gameLap.toFixed(3)+'초':'미확인';
 const currentHud=Number.isFinite(a.currentGameHudSec)?a.currentGameHudSec.toFixed(3)+'초':'—';
 const tire=a.chainCounts?'H'+a.chainCounts.hard+' M'+a.chainCounts.medium+' S'+a.chainCounts.soft:'타이어 확인 전';
 const status=a.running?'● 주행 중':a.chainEnabled?'● 연속 준비 중':'○ 대기';
 const mode=a.chainEnabled?(a.chainMaxRuns?a.chainRuns+'/'+a.chainMaxRuns+'판':'잔여 모두'):'';
 q('.panel').classList.toggle('racing',!!a.running);
 q('#du-auto').disabled=!!a.running;q('#du-analyze').disabled=!!a.running;
 q('#du-one').disabled=active||busy;q('#du-chain').disabled=active||busy;
 q('#du-run-limit').disabled=active||busy;
 q('#du-garage').disabled=active||busy;
 q('#du-stop').disabled=!active||!!a.running||!!a.stopAfterCurrent;
 q('#du-stop').textContent=a.stopAfterCurrent?'⏳ 중지 예약':'■ 다음 판 전 중지';
 q('#du-race').hidden=view!=='race';q('#du-advanced').hidden=view!=='tools';q('#du-report').hidden=view!=='report';
 q('#du-status').textContent=status+' · AUTO v'+(a.version||'?')+(notice?'\n'+notice:'');
 q('#du-race-status').textContent=(mode?'연속 '+mode+' · ':'')+tire+
   '\nP '+(a.stats?.perfect||0)+' / G '+(a.stats?.great||0)+' / GOOD '+(a.stats?.good||0)+' / BAD '+(a.stats?.bad||0)+' / MISS '+(a.stats?.miss||0)+
   '\n랩 '+currentHud+' · 지난 완주 '+lastTime+
   (a.running?'\n⚠ 주행 중 패널 터치 금지':'');
 const cloud='☁ '+cloudUploader.state().message;
 q('#du-cloud-state').textContent=cloud;
 q('#du-cloud-state').title=cloud;
 const diagnostics=q('#du-diagnostics');
 if(diagnostics)diagnostics.textContent='AUTO: '+(a.lastMessage||'대기')+'\n트랙: '+(a.courseName||'미확인')+
   '\n차고: '+(f.message||'대기')+'\n게임 최근 완주: '+(tm?.complete?(tm.recordedLapTimeSource==='game-explicit-result'?'최종 확인 ':'HUD 관측 ')+lastTime:'없음')+
   '\n'+cloud;
 relocate();
}
q('#du-auto').onclick=()=>toggle('race');
q('#du-tools').onclick=()=>toggle('tools');
q('#du-one').onclick=()=>{if(getF().busy)return say('차고 갱신 중에는 주행할 수 없습니다.');press('start-btn');notice='';render();};
q('#du-chain').onclick=()=>{
 if(getF().busy||getA().running||getA().chainEnabled)return say('주행 중에는 새 연속 주행을 시작할 수 없습니다.');
 const v=Number(q('#du-run-limit').value),field=autoUi()?.querySelector('#chain-run-limit');
 if(!Number.isInteger(v)||v<0||v>18)return say('예약 판수는 0~18 사이 정수만 입력하세요.');
 if(!field)return say('AUTO 예약 판수 설정 기능을 찾을 수 없습니다. 새로고침 후 다시 시도하세요.');
 field.value=String(v);
 if(!press('chain-btn'))return say('AUTO 연속 주행 시작 버튼 연결 실패');
 notice='';render();
};
q('#du-stop').onclick=()=>{
 if(getA().running)return say('주행 중 화면 터치가 게임을 중단할 위험이 있습니다. 출발 전 실행 판수를 예약하세요.');
 if(!press('stop-btn'))return say('AUTO 중지 버튼 연결 실패');
 say('다음 주행 시작 전 AUTO 중지 요청 완료');
};
q('#du-garage').onclick=async()=>{if(getA().running||getA().chainEnabled)return say('주행 중 차고 갱신 불가');const fleet=window.__duFleet;if(!fleet)return say('차고 분석기 실행 오류');notice='';render();try{await fleet.refresh();}catch(e){say('갱신 오류: '+String(e?.message||e));}render();};
q('#du-analyze').onclick=()=>toggle('report');q('#du-report-close').onclick=()=>toggle('race');
q('#du-log').onclick=()=>{press('copy-btn');say('입력 기록 복사 실행');};
q('#du-copy-analysis').onclick=()=>{press('analysis-copy');say('누적 분석 기록 복사 실행');};
q('#du-json').onclick=()=>{press('analysis-download');say('주행 기록 JSON 저장 실행');};
q('#du-detect').onclick=()=>{press('detect-btn');say('차량 정보 재확인');};
q('#du-defaults').onclick=()=>{if(getA().running||getA().chainEnabled)return say('주행 중 설정 변경 불가');press('reset-btn');settings();say('AUTO 기본값 복원');};
q('#du-save').onclick=()=>{if(getA().running||getA().chainEnabled)return say('주행 중 설정 변경 불가');const profileSource=q('#du-settings').querySelector('[data-profile]'),profileTarget=autoUi()?.querySelector('#vehicleProfile');if(profileSource&&profileTarget){profileTarget.value=profileSource.value;profileTarget.dispatchEvent(new Event('change',{bubbles:true}));}for(const el of q('#du-settings').querySelectorAll('[data-field]')){const target=autoUi()?.querySelector('#'+el.dataset.field);if(target){target.value=el.value;target.dispatchEvent(new Event('change',{bubbles:true}));}}press('save-btn');say('AUTO 설정 저장');};
q('#du-export').onclick=()=>{window.__duFleet?.exportJson?.();say('차고 백업 다운로드 실행');};
q('#du-trades').onclick=async()=>{await window.__duFleet?.captureTrades?.();render();};
q('#du-force').onclick=()=>{press('force-stop-btn');render();};
q('#du-cloud-config').onclick=()=>cloudUploader.configure();
q('#du-cloud-retry').onclick=()=>cloudUploader.retry();
const posKey='dopamine-unified-position-v1';let x=Math.max(8,innerWidth-224),y=Math.max(8,innerHeight-265);
try{const p=JSON.parse(localStorage.getItem(posKey)||'null');if(Number.isFinite(p?.x)&&Number.isFinite(p?.y)){x=p.x;y=p.y;}}catch(_){}
function position(){const w=q('.panel').offsetWidth||208,h=q('.panel').offsetHeight||220;x=Math.max(8,Math.min(x,Math.max(8,innerWidth-w-8)));y=Math.max(8,Math.min(y,Math.max(8,innerHeight-h-8)));box.style.cssText='position:fixed;left:'+x+'px;top:'+y+'px;z-index:2147483647;pointer-events:auto;max-width:calc(100vw - 16px);';}
for(const ev of ['pointerdown','pointermove','pointerup','pointercancel','click','mousedown','mouseup','touchstart','touchend'])box.addEventListener(ev,e=>e.stopPropagation(),{passive:true});
for(const h of [q('.head')]){
h.addEventListener('pointerdown',e=>{if(getA().running||e.target.closest('button'))return;drag={id:e.pointerId,cx:e.clientX,cy:e.clientY,x,y};moved=false;h.setPointerCapture?.(e.pointerId);});
h.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;let dx=e.clientX-drag.cx,dy=e.clientY-drag.cy;if(Math.abs(dx)+Math.abs(dy)>5)moved=true;if(!moved)return;x=drag.x+dx;y=drag.y+dy;position();});
h.addEventListener('pointerup',e=>{if(!drag||e.pointerId!==drag.id)return;if(moved)try{localStorage.setItem(posKey,JSON.stringify({x,y}));}catch(_){}drag=null;});
h.addEventListener('pointercancel',()=>{drag=null;});
}
window.addEventListener('resize',position);
const timer=setInterval(()=>{render();position();},750);
window.__dopamineUnifiedControl={active:true,destroy:()=>{clearInterval(timer);cloudUploader.destroy();box.remove();window.__dopamineUnifiedControl=null;}};
render();position();

})();
