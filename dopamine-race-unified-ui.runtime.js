// Dopamine Unified UI runtime — loaded from pinned GitHub commit by the stable bootstrap.
// This file is not a userscript. The bootstrap provides page window and GM upload functions.
// UI revision: manual-recorder 0.1.4, MANUAL upload priority plus non-secret per-run transport audit; AUTO prediction unchanged.
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
'#du-integrated #du-garage-status{font-size:10px;max-height:70px;overflow-y:auto;color:#c5deee}'+
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
'<div class="section" id="du-race"><label class="run-config">연속 <input id="du-run-limit" type="number" min="0" max="18" step="1" value="0" inputmode="numeric">판 <small>(0=타이어 모두)</small></label><div class="grid race-buttons"><button id="du-one">▶ 1판</button><button id="du-chain">🔁 연속</button><button id="du-stop" style="background:#a5313e">■ 중지</button><button id="du-garage">🚗 차고 갱신</button></div><div class="status" id="du-race-status"></div><div class="status" id="du-garage-status" hidden></div></div>'+
'<div class="status" id="du-cloud-state">☁ Google Sheets 확인 중…</div>'+
'<div class="section" id="du-advanced" hidden><div class="grid"><button id="du-log">📋 입력 기록 복사</button><button id="du-copy-analysis">📋 누적 분석 복사</button><button id="du-json">💾 전체 기록 백업</button><button id="du-detect">🔍 차량 다시 읽기</button><button id="du-defaults">↩ 설정 초기화</button><button id="du-export">📥 차고 백업</button><button id="du-trades">🧾 거래 기록 수집</button><button id="du-force">⛔ 긴급 즉시 중지</button><button id="du-cloud-config">☁ 시트 연결 설정</button><button id="du-cloud-retry">☁ 미전송 기록 전송</button><button id="du-cloud-diagnostic">🧪 기록·전송 진단</button><button id="du-garage-diagnostic">📋 차고 갱신 진단 복사</button><button id="du-storage-diagnostic">📦 저장공간 진단</button><button id="du-clean-acked">🧹 서버확인 기록 정리</button></div><div class="settings" id="du-settings"></div><div class="status" id="du-diagnostics"></div><button style="width:100%;margin-top:6px" id="du-save">⚙ AUTO 설정 저장</button></div>'+
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
  const CFG_URL='dopamine-uploader:url',CFG_KEY='dopamine-uploader:key',SENT_KEY='dopamine-uploader:sent',UPLOAD_AUDIT_KEY='dopamine-uploader:transfer-audit-v1';
  const ENDPOINT_PATTERN=/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/;
  let sending=false,checking=false,retryAfter=0,message='초기화 중',lastSuccess='',timer=null,disposed=false;
  let lastDiagnostic={localCount:0,localPending:0,lastLocalRunId:null,lastChecked:null,archiveFallback:false};
  let lastAttempt=null,lastServerResult=null;
  // Only non-secret transport metadata is persisted: never URLs, keys, full JSON, or response bodies.
  const readAudit=()=>{try{const a=JSON.parse(GM_getValue(UPLOAD_AUDIT_KEY,'[]'));return Array.isArray(a)?a.slice(-60):[];}catch(_){return [];}};
  function noteTransfer(stage,run,extra={}){
    const entry={time:new Date().toISOString(),stage,runId:run?.runId||null,
      runSource:run?.runSource||'AUTO',version:run?.version||null,...extra};
    lastAttempt=entry;if(stage!=='start')lastServerResult=entry;
    try{const a=readAudit();a.push(entry);GM_setValue(UPLOAD_AUDIT_KEY,JSON.stringify(a.slice(-60)));}catch(_){}
  }
  const read=(k,fallback='')=>{try{return GM_getValue(k,fallback);}catch(_){return fallback;}};
  const write=(k,v)=>GM_setValue(k,v);
  const sentIds=()=>{try{const arr=JSON.parse(read(SENT_KEY,'[]'));return Array.isArray(arr)?arr:[];}catch(_){return [];}};
  const state=()=>({message,sending,checking,configured:!!(read(CFG_URL)&&read(CFG_KEY)),lastSuccess,lastAttempt,lastServerResult,sentCount:sentIds().length,...lastDiagnostic});
  function report(msg){message=msg;const e=q('#du-cloud-state');if(e)e.textContent='☁ Google Sheets · '+msg;console.info('[Dopamine Unified] Sheets:',msg);}
  async function uploadPending(force=false){
    if(disposed)return;
    if(sending||checking){if(force)report('전송/기록 검사 중 · 완료 후 재확인');return;}
    if(Date.now()<retryAfter&&!force)return;
    const url=read(CFG_URL),key=read(CFG_KEY);
    if(!url||!key||!ENDPOINT_PATTERN.test(url)){report('연결 설정 필요 · ⚙ → 시트 연결 설정');return;}
    checking=true;
    try{
      let runs=[];
      try{
        const data=JSON.parse(localStorage.getItem(RUNS_KEY)||'[]');
        if(!Array.isArray(data))throw Error('기록 형식 오류');
        runs=data;
      }catch(e){report('⚠ 로컬 기록 읽기 실패 · 보관소 복구 시도');}
      const sent=new Set(sentIds()),pending=runs.filter(r=>r?.runId&&!sent.has(r.runId));
      lastDiagnostic={localCount:runs.length,localPending:pending.length,lastLocalRunId:runs.at(-1)?.runId||null,lastChecked:new Date().toISOString(),archiveFallback:false};
      let archivedRun=null,archiveError=null;
      try{archivedRun=await window.__duRunArchive?.firstUnsent(sent)||null;}
      catch(e){archiveError=String(e?.message||e).slice(0,90);}
      // Keep the original AUTO queue available, but do not starve the MANUAL archive.
      // MANUAL runIds are not inserted into the legacy AUTO localStorage array.
      let sourceRun=(archivedRun?.runSource==='MANUAL'?archivedRun:null)||pending[0]||archivedRun||null;
      lastDiagnostic.archiveFallback=!!sourceRun&&sourceRun===archivedRun;
      lastDiagnostic.archiveError=archiveError;
      lastDiagnostic.sourcePriority=sourceRun?.runSource==='MANUAL'?'MANUAL':sourceRun?'AUTO':null;
      if(!sourceRun){
        report(archiveError?'보관소 확인 불가 · AUTO 로컬 '+runs.length+'건 · '+archiveError:'전송 대기 0건 · 로컬 '+runs.length+'건 확인');return;
      }
      const timestamp=Date.parse(sourceRun.time||'');
      if(!Number.isFinite(timestamp)){report('원본 주행시각 확인 필요 · '+sourceRun.runId);return;}
      const run={...sourceRun,timeKst:new Date(timestamp+9*60*60*1000).toISOString().replace('Z','+09:00'),timeZone:'Asia/Seoul'};
      const body=JSON.stringify({uploadKey:key,run});
      if(body.length>1800000){retryAfter=Date.now()+60000;report('기록 용량 초과 · '+run.runId);return;}
      sending=true;
      noteTransfer('start',run,{archiveSource:lastDiagnostic.archiveFallback,bodyBytes:body.length});
      report('전송 중 · '+(run.runSource==='MANUAL'?'수동 기록':'AUTO 기록')+' · '+run.runId);
      try{GM_xmlhttpRequest({
        method:'POST',url,
        headers:{'Content-Type':'text/plain;charset=utf-8'},data:body,timeout:30000,
        onload(response){
          sending=false;if(disposed)return;
          let result;try{result=JSON.parse(response.responseText||'');}catch(_){}
          if(response.status>=200&&response.status<300&&result?.ok===true&&
            (result.status==='SAVED'||result.status==='ALREADY_SAVED')&&result.runId===run.runId){
            noteTransfer('server-ack',run,{httpStatus:response.status,serverStatus:result.status});
            try{
              const ids=sentIds();if(!ids.includes(run.runId))ids.push(run.runId);
              write(SENT_KEY,JSON.stringify(ids.slice(-1000)));
            }catch(e){noteTransfer('ack-marker-error',run,{errorCode:String(e?.name||'storage-failure').slice(0,40)});report('서버 응답 수신 · 전송확인 로컬 저장 실패 · '+run.runId);return;}
            lastSuccess=run.runId;retryAfter=0;
            report((result.status==='ALREADY_SAVED'?'기존 기록 확인':'서버 저장 응답')+' · '+run.runId);
            setTimeout(()=>uploadPending(),1000);
          }else{
            const status=String(result?.status||result?.error||'not-acknowledged').replace(/[^A-Za-z0-9_-]/g,'').slice(0,48);
            noteTransfer('server-rejected',run,{httpStatus:response.status,serverStatus:status||'unknown',hasJsonBody:!!result});
            retryAfter=Date.now()+60000;report('전송 실패 · '+(status||'HTTP '+response.status)+' · '+run.runId+' · 60초 후 재시도');
          }
        },
        onerror(){sending=false;noteTransfer('network-error',run);retryAfter=Date.now()+60000;report('네트워크 오류 · '+run.runId+' · 60초 후 재시도');},
        ontimeout(){sending=false;noteTransfer('timeout',run);retryAfter=Date.now()+60000;report('응답 시간 초과 · '+run.runId+' · 60초 후 재시도');}
      });}catch(e){sending=false;noteTransfer('request-error',run,{errorCode:String(e?.name||'request-error').slice(0,40)});retryAfter=Date.now()+60000;report('전송 실행 오류 · '+String(e?.message||e));}
    }finally{checking=false;}
  }
  // Back up legacy localStorage runs in IndexedDB; original records are never deleted.
  async function archiveExisting(){
    try{
      const runs=JSON.parse(localStorage.getItem(RUNS_KEY)||'[]');
      if(Array.isArray(runs)&&runs.length)await window.__duRunArchive?.putMany(runs);
    }catch(e){console.warn('[Dopamine Unified] Archive backfill failed:',String(e));}
  }
  archiveExisting();
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
  return {configure,retry:()=>{retryAfter=0;uploadPending(true);},state,transferAudit:readAudit,acknowledgedIds:sentIds,destroy:()=>{disposed=true;clearInterval(timer);}};
})();
const fieldNames=[['brakeY','브레이크 판정선 Y'],['boostY','부스터 판정선 Y'],['brakeOffset','브레이크 보정 px'],['boostOffset','부스터 보정 px'],['predictionMs','예측 시간 ms'],['boostZones','부스터 구간 수'],['colorTolerance','색상 허용 오차'],['tolerance','판정 허용 오차']];
let view='race',notice='',drag=null,moved=false,diagnosticSnapshot='',garageRequested=false;
const RECORDER_AUDIT_KEY='dopamine-uploader:recorder-audit-v1';
const readRecorderAudit=()=>{
 try{const data=JSON.parse(GM_getValue(RECORDER_AUDIT_KEY,'[]'));return Array.isArray(data)?data.slice(-60):[];}
 catch(_){return [];}
};
let auditPrevious=null;
function observeRecorderState(auto){
 // This is observation only: never click or trigger game controls here.
 let phase=null;
 try{phase=document.querySelector('iframe[title="타임어택"]')?.contentDocument?.querySelector('#pedallap')?.dataset?.phase||null;}catch(_){}
 const state={
   autoRunning:!!auto.running,
   chainEnabled:!!auto.chainEnabled,
   phase,
   saveStatus:auto.lastRunPersistence?.status||'none',
   saveRunId:auto.lastRunPersistence?.runId||null,
   localRunCount:Number.isInteger(auto.localRunCount)?auto.localRunCount:null
 };
 const prior=auditPrevious;
 auditPrevious=state;
 const changed=prior?Object.keys(state).filter(k=>state[k]!==prior[k]):['initial'];
 if(!changed.length)return;
 // GM storage is separate from game-origin localStorage; it remains writable
 // when the legacy race-results array exhausts its localStorage quota.
 try{
   const history=readRecorderAudit();
   history.push({
     timeKst:new Date(Date.now()+9*3600000).toISOString().replace('Z','+09:00'),
     changed, ...state
   });
   GM_setValue(RECORDER_AUDIT_KEY,JSON.stringify(history.slice(-60)));
 }catch(e){console.warn('[Dopamine Unified] Recorder audit store unavailable:',String(e));}
}
function settings(){const list=q('#du-settings');list.replaceChildren();const pl=document.createElement('label'),pi=document.createElement('input');pl.textContent='학습 프로필 (선택)';pi.type='text';pi.dataset.profile='yes';pi.value=autoUi()?.querySelector('#vehicleProfile')?.value??'';pl.appendChild(pi);list.appendChild(pl);for(const [id,title] of fieldNames){const label=document.createElement('label'),input=document.createElement('input');label.textContent=title;input.type='number';input.dataset.field=id;input.value=autoUi()?.querySelector('#'+id)?.value??'';label.appendChild(input);list.appendChild(label);}}
function analysis(){press('analysis-refresh');q('#du-report-body').textContent=autoUi()?.querySelector('#analysis-summary')?.textContent||'저장된 주행 기록이 없습니다.';}
function toggle(name){view=name;if(view==='tools')settings();if(view==='report')analysis();render();position();}
function say(m){notice=m;render();}
function relocate(){
 // The game presents its finish screen as a top-layer modal dialog.
 // Keep controls visible in that top layer, but compensate for the dialog's own coordinate space.
 const dialogs=[...document.querySelectorAll('dialog[open]')].filter(d=>d.getClientRects().length&&d.matches(':modal'));
 const target=dialogs[dialogs.length-1]||document.body;
 if(box.parentElement!==target){target.appendChild(box);position();}
}
function render(){
 const a=getA(),f=getF(),active=!!(a.running||a.chainEnabled),busy=!!f.busy;
 observeRecorderState(a);
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
 q('#du-status').textContent=status+' · AUTO v'+(a.version||'?')+(a.lastRunPersistence?.status==='failed'?'\n⛔ 기록 저장 실패 · ⚙ 전체 기록 백업':a.lastRunPersistence?.status==='archive-pending'?'\n⚠ 주행 원본 별도 보관 중':'')+(notice?'\n'+notice:'');
 const garageStatus=q('#du-garage-status');
 garageStatus.hidden=!garageRequested||active;
 garageStatus.textContent=garageRequested?(f.message||'차고 갱신 상태 확인 중…'):'';
 garageStatus.title=f.message||'';
 q('#du-race-status').textContent=(mode?'연속 '+mode+' · ':'')+tire+
   '\nP '+(a.stats?.perfect||0)+' / G '+(a.stats?.great||0)+' / GOOD '+(a.stats?.good||0)+' / BAD '+(a.stats?.bad||0)+' / MISS '+(a.stats?.miss||0)+
   '\n랩 '+currentHud+' · 지난 완주 '+lastTime+
   (a.running?'\n⚠ 주행 중 패널 터치 금지':'');
 const cloud='☁ '+cloudUploader.state().message;
 q('#du-cloud-state').textContent=cloud;
 q('#du-cloud-state').title=cloud;
 const diagnostics=q('#du-diagnostics');
 if(diagnostics)diagnostics.textContent=diagnosticSnapshot||'AUTO: '+(a.lastMessage||'대기')+'\n트랙: '+(a.courseName||'미확인')+
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
q('#du-garage').onclick=async()=>{if(getA().running||getA().chainEnabled)return say('주행 중 차고 갱신 불가');const fleet=window.__duFleet;if(!fleet)return say('차고 분석기 실행 오류');garageRequested=true;notice='';render();try{const result=await fleet.refresh();if(result?.ok===false)notice='차고 갱신 실패 · 상세 사유는 아래 표시';}catch(e){say('갱신 오류: '+String(e?.message||e));}render();};
q('#du-garage-diagnostic').onclick=async()=>{const f=getF();const snapshot={checkedAtKst:new Date(Date.now()+9*3600000).toISOString().replace('Z','+09:00'),fleetVersion:f.version,garageMessage:f.message,refresh:f.lastRefresh};try{await navigator.clipboard.writeText(JSON.stringify(snapshot,null,2));say('차고 갱신 진단 복사 완료');}catch(e){say('차고 진단 복사 실패: '+String(e?.message||e));}};

const STORAGE_RUNS_KEY='dopamine-auto-v336:runs',STORAGE_FLEET_KEY='dopamine-fleet-tracker-v1';
function storageReport(){
 const bytes=k=>{try{const v=localStorage.getItem(k);return v===null?0:new Blob([v]).size;}catch(_){return null;}};
 const keys=[];let total=0;
 try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);const size=bytes(k);keys.push({key:k,bytes:size});if(size!==null)total+=size;}}
 catch(e){return {error:String(e?.message||e)};}
 keys.sort((a,b)=>(b.bytes||0)-(a.bytes||0));
 return {origin:location.origin,localStorageBytes:total,localStorageTopKeys:keys.slice(0,12),
   runBytes:bytes(STORAGE_RUNS_KEY),garageBytes:bytes(STORAGE_FLEET_KEY),
   sentIds:cloudUploader.state().sentCount,
   note:'localStorage 용량과 IndexedDB/CacheStorage 전체 할당량은 다릅니다. navigator.storage.estimate()는 전체 origin 추정치입니다.'};
}
async function storageDiagnostic(){
 const report=storageReport();
 try{if(navigator.storage?.estimate){const x=await navigator.storage.estimate();report.originUsageBytes=x.usage;report.originQuotaBytes=x.quota;}}
 catch(e){report.estimateError=String(e?.message||e);}
 return report;
}
async function cleanupAcknowledgedRuns(){
 if(getA().running||getA().chainEnabled||cloudUploader.state().sending||cloudUploader.state().checking){
   return {ok:false,reason:'주행/전송 진행 중에는 정리하지 않습니다'};
 }
 let runs;try{runs=JSON.parse(localStorage.getItem(STORAGE_RUNS_KEY)||'[]');if(!Array.isArray(runs))throw Error('형식 오류');}
 catch(e){return {ok:false,reason:'주행기록 파싱 오류 · 정리 취소'};}
 let ids;try{ids=new Set(JSON.parse(GM_getValue('dopamine-uploader:sent','[]')));}
 catch(e){return {ok:false,reason:'서버 확인 ID 목록 오류 · 정리 취소'};}
 if(!ids.size)return {ok:false,reason:'서버 저장 확인된 주행 ID가 없어 정리하지 않았습니다'};
 // Keep last 20 original runs for comparison/learning. Only IDs with explicit SAVED/ALREADY_SAVED acknowledgments are eligible.
 const keepLast=20;const eligible=runs.slice(0,Math.max(0,runs.length-keepLast)).filter(r=>r?.runId&&ids.has(r.runId));
 if(!eligible.length)return {ok:true,removed:0,reason:'정리 대상 없음 (최근 20건 또는 미확인 기록 보호)'};
 const remove=new Set(eligible.map(r=>r.runId)),remaining=runs.filter(r=>!remove.has(r?.runId));
 // Verify all removable originals have a second durable copy in IndexedDB before removing localStorage bytes.
 if(!window.__duRunArchive?.all)return {ok:false,reason:'IndexedDB 보관소를 확인할 수 없어 삭제 취소'};
 let archived;try{archived=await window.__duRunArchive.all();}
 catch(e){return {ok:false,reason:'IndexedDB 조회 실패 · 삭제 취소: '+String(e?.message||e)};}
 const archivedIds=new Set((archived||[]).map(r=>r?.runId).filter(Boolean));
 if(eligible.some(r=>!archivedIds.has(r.runId)))return {ok:false,reason:'보관소에 없는 기록이 있어 삭제 취소'};
 const previous=localStorage.getItem(STORAGE_RUNS_KEY);
 try{
   localStorage.setItem(STORAGE_RUNS_KEY,JSON.stringify(remaining));
   const check=JSON.parse(localStorage.getItem(STORAGE_RUNS_KEY)||'null');
   if(!Array.isArray(check)||check.length!==remaining.length)throw Error('쓰기 검증 실패');
 }catch(e){
   try{if(previous!==null)localStorage.setItem(STORAGE_RUNS_KEY,previous);}catch(_){}
   return {ok:false,reason:'정리 기록 쓰기 실패 · '+String(e?.message||e)};
 }
 return {ok:true,removed:eligible.length,remaining:remaining.length,
   reason:'서버 저장 확인 및 IndexedDB 이중 보관된 주행 '+eligible.length+'건을 localStorage에서만 정리 · 최근 20건 보호'};
}
q('#du-storage-diagnostic').onclick=async()=>{
 const report=await storageDiagnostic();
 try{await navigator.clipboard.writeText(JSON.stringify(report,null,2));say('저장공간 진단 복사 완료 · localStorage '+Math.round((report.localStorageBytes||0)/1024)+'KiB');}
 catch(e){say('저장공간 진단 복사 실패: '+String(e?.message||e));}
};
q('#du-clean-acked').onclick=async()=>{
 if(!window.confirm('서버 저장 응답과 IndexedDB 원본이 모두 확인된 오래된 주행기록만 브라우저 localStorage에서 정리합니다. 최근 20건과 미전송 기록은 유지합니다. 계속할까요?'))return;
 const result=await cleanupAcknowledgedRuns();
 say(result.reason);
};
q('#du-analyze').onclick=()=>toggle('report');q('#du-report-close').onclick=()=>toggle('race');
q('#du-log').onclick=()=>{press('copy-btn');say('입력 기록 복사 실행');};
async function allSavedRuns(){
  const local=JSON.parse(localStorage.getItem('dopamine-auto-v336:runs')||'[]');
  let archived=[];
  try{archived=await window.__duRunArchive?.all()||[];}
  catch(e){console.warn('[Dopamine Unified] Archive export unavailable; using available local runs:',String(e));}
  const byId=new Map();
  for(const run of archived)if(run?.runId)byId.set(run.runId,run);
  for(const run of local)if(run?.runId)byId.set(run.runId,run);
  if(window.__duUnsavedRun?.runId)byId.set(window.__duUnsavedRun.runId,window.__duUnsavedRun);
  if(window.__duUnsavedManualRun?.runId)byId.set(window.__duUnsavedManualRun.runId,window.__duUnsavedManualRun);
  return [...byId.values()].sort((a,b)=>String(a.time||'').localeCompare(String(b.time||'')));
}
function downloadRunBackup(runs){
  const blob=new Blob([JSON.stringify(runs,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='dopamine-auto-record-recovery-'+new Date().toISOString().slice(0,10)+'.json';
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),20000);
}
q('#du-copy-analysis').onclick=async()=>{
  try{const runs=await allSavedRuns();await navigator.clipboard.writeText(JSON.stringify(runs,null,2));say('전체 '+runs.length+'건 복사 완료');}
  catch(e){say('복사 실패 · ⚙ 전체 기록 백업 버튼 이용');}
};
q('#du-json').onclick=async()=>{
  try{const runs=await allSavedRuns();downloadRunBackup(runs);say('전체 '+runs.length+'건 JSON 백업 요청');}
  catch(e){
    if(window.__duUnsavedRun){downloadRunBackup([window.__duUnsavedRun]);say('⚠ 마지막 미저장 기록 긴급 백업');}
    else say('기록 백업 오류 · '+String(e?.message||e));
  }
};
q('#du-detect').onclick=()=>{press('detect-btn');say('차량 정보 재확인');};
q('#du-defaults').onclick=()=>{if(getA().running||getA().chainEnabled)return say('주행 중 설정 변경 불가');press('reset-btn');settings();say('AUTO 기본값 복원');};
q('#du-save').onclick=()=>{if(getA().running||getA().chainEnabled)return say('주행 중 설정 변경 불가');const profileSource=q('#du-settings').querySelector('[data-profile]'),profileTarget=autoUi()?.querySelector('#vehicleProfile');if(profileSource&&profileTarget){profileTarget.value=profileSource.value;profileTarget.dispatchEvent(new Event('change',{bubbles:true}));}for(const el of q('#du-settings').querySelectorAll('[data-field]')){const target=autoUi()?.querySelector('#'+el.dataset.field);if(target){target.value=el.value;target.dispatchEvent(new Event('change',{bubbles:true}));}}press('save-btn');say('AUTO 설정 저장');};
q('#du-export').onclick=()=>{window.__duFleet?.exportJson?.();say('차고 백업 다운로드 실행');};
q('#du-trades').onclick=async()=>{await window.__duFleet?.captureTrades?.();render();};
q('#du-force').onclick=()=>{press('force-stop-btn');render();};
q('#du-cloud-config').onclick=()=>cloudUploader.configure();
q('#du-cloud-retry').onclick=()=>cloudUploader.retry();
q('#du-cloud-diagnostic').onclick=async()=>{
  try{
    const status=cloudUploader.state(),auto=getA(),runs=await allSavedRuns();
    const sent=new Set(cloudUploader.acknowledgedIds());
    const archiveRuns=await window.__duRunArchive?.all?.().catch(()=>[])||[];
    const archiveIds=new Set(archiveRuns.map(r=>r?.runId).filter(Boolean));
    const manual=runs.filter(r=>r.runSource==='MANUAL'),unackedManual=manual.filter(r=>!sent.has(r.runId));
    const diagnostic={
      checkedAtKst:new Date(Date.now()+9*3600000).toISOString().replace('Z','+09:00'),
      autoVersion:auto.version||null,bootstrapSource:window.__duBootstrap?.source||null,
      lastRunPersistence:auto.lastRunPersistence||null,
      cloudConfigured:status.configured,cloudMessage:status.message,
      lastAcknowledgedId:status.lastSuccess||null,
      sentMarkers:sent.size,localCount:status.localCount,localPending:status.localPending,
      archiveFallback:status.archiveFallback,archiveError:status.archiveError||null,queuePriority:status.sourcePriority,
      lastUploadAttempt:status.lastAttempt,lastUploadResult:status.lastServerResult,
      recentUploadAttempts:cloudUploader.transferAudit().slice(-20),
      recoverableRuns:runs.length,manualRuns:manual.length,manualPendingAck:unackedManual.length,
      manualRunEvidence:manual.slice(-8).map(r=>({
        runId:r.runId,complete:!!r.complete,reason:r.reason||null,events:r.events||0,
        inIndexedDB:archiveIds.has(r.runId),serverAck:sent.has(r.runId),
        pendingUpload:!sent.has(r.runId),runSource:r.runSource,time:r.time||null
      })),
      emergencyManualInMemory:window.__duUnsavedManualRun?.runId||null,
      latestRuns:runs.slice(-8).map(r=>{
        const timestamp=Date.parse(r.time||'');
        const corrected=Number.isFinite(timestamp)?new Date(timestamp+9*3600000).toISOString().replace('Z','+09:00'):null;
        return {runId:r.runId,runSource:r.runSource||'AUTO',version:r.version,timeKst:corrected||r.timeKst||null,complete:r.complete,events:r.events,markedSent:sent.has(r.runId)};
      }),
      recentRecorderActivity:readRecorderAudit().slice(-15)
    };
    const content=JSON.stringify(diagnostic,null,2);
    diagnosticSnapshot=content;
    q('#du-diagnostics').textContent=content;
    try{await navigator.clipboard.writeText(content);say('기록·전송 진단 복사 완료 (인증키 제외)');}
    catch(_){say('진단 정보 표시됨 · ⚙ 화면 아래 확인');}
  }catch(e){say('진단 실패 · '+String(e?.message||e));}
};
const posKey='dopamine-unified-position-v1';let x=Math.max(8,innerWidth-224),y=Math.max(8,innerHeight-265);
try{const p=JSON.parse(localStorage.getItem(posKey)||'null');if(Number.isFinite(p?.x)&&Number.isFinite(p?.y)){x=p.x;y=p.y;}}catch(_){}
// The user's preferred coordinates must not be overwritten as the race panel grows/shrinks.
// Only the visible coordinates are clamped. The panel scrolls internally at the same top edge.
let placedX=x,placedY=y;
function position(){
 const panel=q('.panel'),vw=innerWidth,vh=innerHeight;
 const w=panel.offsetWidth||208;
 placedX=Math.max(8,Math.min(x,Math.max(8,vw-w-8)));
 placedY=Math.max(8,Math.min(y,Math.max(8,vh-54)));
 panel.style.maxHeight=Math.max(54,vh-placedY-8)+'px';
 // A modal dialog may establish a transformed containing block for fixed descendants.
 // Measure the viewport origin of left:0/top:0 after reparenting and convert coordinates.
 box.style.cssText='position:fixed;left:0px;top:0px;z-index:2147483647;pointer-events:auto;width:max-content;max-width:calc(100vw - 16px);';
 const origin=box.getBoundingClientRect();
 const sx=box.offsetWidth>0&&origin.width>0?origin.width/box.offsetWidth:1;
 const sy=box.offsetHeight>0&&origin.height>0?origin.height/box.offsetHeight:1;
 box.style.left=((placedX-origin.left)/sx)+'px';
 box.style.top=((placedY-origin.top)/sy)+'px';
}
for(const ev of ['pointerdown','pointermove','pointerup','pointercancel','click','mousedown','mouseup','touchstart','touchend'])box.addEventListener(ev,e=>e.stopPropagation(),{passive:true});
for(const h of [q('.head')]){
h.addEventListener('pointerdown',e=>{if(getA().running||e.target.closest('button'))return;drag={id:e.pointerId,cx:e.clientX,cy:e.clientY,x:placedX,y:placedY};moved=false;h.setPointerCapture?.(e.pointerId);});
h.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;let dx=e.clientX-drag.cx,dy=e.clientY-drag.cy;if(Math.abs(dx)+Math.abs(dy)>5)moved=true;if(!moved)return;x=drag.x+dx;y=drag.y+dy;position();});
h.addEventListener('pointerup',e=>{if(!drag||e.pointerId!==drag.id)return;if(moved){x=placedX;y=placedY;try{localStorage.setItem(posKey,JSON.stringify({x,y}));}catch(_){}}drag=null;});
h.addEventListener('pointercancel',()=>{drag=null;});
}
window.addEventListener('resize',position);
const timer=setInterval(()=>{render();position();},750);

// Passive MANUAL telemetry: no synthetic game input, no change to AUTO prediction.
const manualTelemetry=(()=>{
  'use strict';
  const VERSION='0.1.6',CHECKPOINT='dopamine-manual:checkpoint-v1';
  const FINISH=/^(finished|finish|complete|completed|result|results|ended|end|done)$/;
  const ACTIVE=/^(run|running|racing|playing|active|in-progress)$/;
  const STOPPED=/^(interrupted|aborted|canceled|cancelled|failed|stopped|quit)$/;
  const COLOR={brakeOn:[255,205,98],brakeOff:[122,235,198],boostOn:[255,89,107],boostOff:[255,157,155]};
  const names={brakeOn:'브레이크 ON',brakeOff:'브레이크 OFF',boostOn:'BOOST ON',boostOff:'BOOST OFF'};
  let doc=null,trackRoot=null,session=null,redSeen=false,previousPhase='',lastFrame=0,frameAvg=16.67,lastCanvasRead=0;
  let pending=[],pressState={brake:false,boost:false},lastPointerTime=0,lastCheckpoint=0,lastClockPoll=0,lastLightPoll=0,lastSaved=null;
  let fbElement=null,fbObserver=null,lastFeedback='',feedbackCleared=true,lastError='',lastStatus='게임 화면 대기';
  let lastPosition={},trace={brakeOn:[],brakeOff:[],boostOn:[],boostOff:[]},lastSpeed=null,lastSpeedAt=0;
  const statusNode=document.createElement('div');
  statusNode.className='status';statusNode.style.color='#bbdfcf';statusNode.textContent='✋ 수동 기록 · 게임 화면 대기';
  q('#du-race-status').after(statusNode);
  const analysisBtn=document.createElement('button'),exportBtn=document.createElement('button');
  analysisBtn.textContent='✋ 수동 주행 분석';exportBtn.textContent='💾 수동 기록 백업';
  q('#du-advanced .grid').append(analysisBtn,exportBtn);
  // Android Firefox: trusted manual touch release may be lost/retargeted by iframe.
  // Fix the gesture surface before touch starts, capture the pointer where possible,
  // observe real releases at frame/window and outer document, and only then consider
  // one synthetic pointerup if the game stays stationary after all five lights.
  const FIREFOX_START_KEY='dopamine-manual:firefox-start-assist-v1';
  const firefoxAndroid=/Android/i.test(navigator.userAgent||'')&&/Firefox\//i.test(navigator.userAgent||'');
  let firefoxAssist=firefoxAndroid,firefoxHeld=null,firefoxSawFive=false,firefoxRecoveryTimer=null;
  let firefoxRecoveryCount=0,firefoxReleaseCount=0,firefoxToken=0,firefoxLastRed=-1,firefoxLastSawFive=false,lastFirefoxLightPoll=0;
  let firefoxSurface=null,firefoxOriginalTouchAction=null,firefoxOriginalPriority='';
  const firefoxEvents=[];
  try{const option=localStorage.getItem(FIREFOX_START_KEY);if(option!==null)firefoxAssist=option==='on';}catch(_){}
  const firefoxToggle=document.createElement('button'),firefoxDiagnostic=document.createElement('button');
  q('#du-advanced .grid').append(firefoxToggle,firefoxDiagnostic);
  function firefoxToggleLabel(){firefoxToggle.textContent='🛠 수동 출발 보완: '+(firefoxAssist?'ON':'OFF');}
  firefoxToggleLabel();firefoxDiagnostic.textContent='📋 수동 출발 진단 복사';
  function firefoxLog(kind,e=null,extra={}){
    firefoxEvents.push({atMs:round(now(),1),kind,domEvent:e?.type||null,
      brakeTarget:!!e?.target?.closest?.('.cursor-interaction'),phase:phase(),...extra});
    if(firefoxEvents.length>100)firefoxEvents.shift();
  }
  function firefoxPrepareSurface(){
    const eligible=firefoxAndroid&&firefoxAssist&&!getA().running&&!getA().chainEnabled;
    const target=eligible?doc?.querySelector('.cursor-interaction'):null;
    if(firefoxSurface&&(!eligible||target!==firefoxSurface)){
      try{
        if(firefoxOriginalTouchAction)firefoxSurface.style.setProperty('touch-action',firefoxOriginalTouchAction,firefoxOriginalPriority);
        else firefoxSurface.style.removeProperty('touch-action');
      }catch(_){}
      firefoxSurface=null;firefoxOriginalTouchAction=null;firefoxOriginalPriority='';
    }
    if(target&&target!==firefoxSurface){
      try{
        firefoxOriginalTouchAction=target.style.getPropertyValue('touch-action');
        firefoxOriginalPriority=target.style.getPropertyPriority('touch-action');
        target.style.setProperty('touch-action','none','important');
        firefoxSurface=target;
        firefoxLog('touch-action-protected');
      }catch(err){firefoxLog('touch-action-error',null,{detail:String(err?.message||err).slice(0,90)});}
    }
  }
  function firefoxReset(reason='reset'){
    firefoxToken++;
    if(firefoxRecoveryTimer!==null){clearTimeout(firefoxRecoveryTimer);firefoxRecoveryTimer=null;}
    if(firefoxHeld)firefoxLog('held-reset',null,{reason,heldForMs:round(now()-firefoxHeld.at),sawFive:firefoxSawFive});
    firefoxHeld=null;firefoxSawFive=false;
  }
  function firefoxObserveLights(){
    if(!firefoxAndroid||!firefoxHeld)return;
    const red=countRed();
    if(red!==firefoxLastRed){firefoxLastRed=red;firefoxLog('red-light-count',null,{red});}
    if(red===5&&!firefoxSawFive){
      firefoxSawFive=true;firefoxLastSawFive=true;
      firefoxLog('five-red-lights-seen');
    }
  }
  function firefoxObserve(e,scope='iframe-document'){
    if(!firefoxAndroid||!e.isTrusted||getA().running||getA().chainEnabled)return;
    const type=e.type,brakeTarget=e.target?.closest?.('.cursor-interaction');
    if(type==='pointerdown'&&brakeTarget&&phase()==='ready'){
      firefoxReset('new-brake-down');
      firefoxHeld={id:e.pointerId,at:now(),touchIdentifier:null,cancelSeen:false};
      firefoxLastRed=-1;firefoxLastSawFive=false;
      firefoxLog('trusted-brake-down',e,{scope,pointerId:e.pointerId});
      if(firefoxAssist){
        try{
          if(typeof brakeTarget.setPointerCapture==='function'){
            brakeTarget.setPointerCapture(e.pointerId);
            firefoxLog('pointer-capture-requested',e,{pointerId:e.pointerId});
          }else firefoxLog('pointer-capture-not-supported');
        }catch(err){firefoxLog('pointer-capture-error',e,{detail:String(err?.message||err).slice(0,90)});}
      }
      firefoxObserveLights();
      return;
    }
    if(!firefoxHeld)return;
    if(type==='touchstart'){
      const changed=e.changedTouches;
      if(changed?.length===1&&firefoxHeld.touchIdentifier===null)
        firefoxHeld.touchIdentifier=changed[0].identifier;
      return;
    }
    const pointerEnd=type==='pointerup'||type==='pointercancel';
    const touchEnd=type==='touchend'||type==='touchcancel';
    if(!pointerEnd&&!touchEnd)return;
    if(pointerEnd&&e.pointerId!==firefoxHeld.id)return;
    if(touchEnd&&firefoxHeld.touchIdentifier!==null&&e.changedTouches?.length){
      if(!Array.from(e.changedTouches).some(t=>t.identifier===firefoxHeld.touchIdentifier))return;
    }
    firefoxObserveLights();
    if(type==='pointercancel'||type==='touchcancel'){
      firefoxHeld.cancelSeen=true;
      firefoxLog('trusted-cancel-no-release-inferred',e,{scope,pointerId:firefoxHeld.id,sawFive:firefoxSawFive});
      return; // cancellation alone does not establish that the finger was lifted
    }
    const sawFive=firefoxSawFive,releaseId=firefoxHeld.id;
    firefoxHeld=null;firefoxReleaseCount++;
    firefoxLog('trusted-brake-release',e,{scope,pointerId:releaseId,sawFive});
    if(!firefoxAssist||!sawFive)return;
    const token=++firefoxToken;
    // Never substitute an assumed release for an unobserved physical release.
    // The original trusted event is delivered before the delayed backup.
    firefoxRecoveryTimer=setTimeout(()=>{
      firefoxRecoveryTimer=null;
      if(disposed||token!==firefoxToken||!firefoxAssist||getA().running||getA().chainEnabled)return;
      if(!doc||!trackRoot?.isConnected||!/^(ready|running|racing|playing|active|in-progress|countdown|starting)$/.test(phase()))return;
      const red=countRed();
      if(red!==0){firefoxLog('backup-skipped-lights',null,{red});return;}
      const speed=readSpeed(),clock=readClock();
      if((Number.isFinite(speed)&&speed>0.5)||(Number.isFinite(clock)&&clock>0)){
        firefoxLog('backup-skipped-moving',null,{speed,clock});return;
      }
      const brake=doc.querySelector('.cursor-interaction'),w=doc.defaultView;
      if(!brake||!w?.PointerEvent){firefoxLog('backup-skipped-target-missing');return;}
      try{
        brake.dispatchEvent(new w.PointerEvent('pointerup',{
          bubbles:true,cancelable:true,pointerId:Number.isFinite(releaseId)?releaseId:1,
          pointerType:'touch',isPrimary:true,button:0,buttons:0
        }));
        firefoxRecoveryCount++;
        firefoxLog('fallback-pointerup-sent',null,{red,speed,clock});
      }catch(err){firefoxLog('fallback-error',null,{detail:String(err?.message||err).slice(0,90)});}
    },70);
  }
  function firefoxFrameRelease(e){firefoxObserve(e,'iframe-window');}
  function firefoxOuterRelease(e){firefoxObserve(e,'outer-document-or-window');}
  const firefoxReleaseTypes=['pointerup','pointercancel','touchend','touchcancel'];
  if(firefoxAndroid){
    for(const type of firefoxReleaseTypes){
      document.addEventListener(type,firefoxOuterRelease,true);
      window.addEventListener(type,firefoxOuterRelease,true);
    }
  }
  firefoxToggle.onclick=()=>{
    firefoxAssist=!firefoxAssist;
    if(!firefoxAssist)firefoxReset('user-disabled');
    try{localStorage.setItem(FIREFOX_START_KEY,firefoxAssist?'on':'off');}catch(_){}
    firefoxPrepareSurface();firefoxToggleLabel();
    say('Firefox 수동 출발 보완 '+(firefoxAssist?'켜짐':'꺼짐'));
  };
  firefoxDiagnostic.onclick=async()=>{
    const safe={checkedAt:new Date().toISOString(),platform:'Android Firefox',
      supported:firefoxAndroid,assistEnabled:firefoxAssist,
      gamePhase:phase(),redLights:countRed(),held:!!firefoxHeld,
      sawFive:firefoxSawFive,lastHoldSawFive:firefoxLastSawFive,lastObservedRed:firefoxLastRed,
      physicalReleases:firefoxReleaseCount,syntheticRecoveries:firefoxRecoveryCount,
      relayEnabled,relayCounters:{...relayCounters},relayEvents:[...relayEvents],
      events:firefoxEvents};
    try{await navigator.clipboard.writeText(JSON.stringify(safe,null,2));say('수동 출발 진단 복사 완료');}
    catch(err){say('진단 복사 실패: '+String(err?.message||err));}
  };

  // The physical Firefox touch gesture can leave the iframe before the game sees its release.
  // A transparent *parent document* relay uses the user's trusted gesture over the visible
  // controls and forwards the same down/up action using the game's existing AUTO-compatible
  // PointerEvent path. This never decides *when* to release: the user must physically lift.
  const FIREFOX_RELAY_KEY='dopamine-manual:firefox-input-relay-v1';
  let relayEnabled=firefoxAndroid,relayLastLayout=0,relaySequence=0;
  try{const stored=localStorage.getItem(FIREFOX_RELAY_KEY);if(stored!==null)relayEnabled=stored==='on';}catch(_){}
  const relayHeld={brake:null,boost:null},relayCounters={down:0,up:0,cancel:0,missing:0},relayEvents=[];
  const relayToggle=document.createElement('button');
  const relayLayers={};
  q('#du-advanced .grid').append(relayToggle);
  function relayLabel(){relayToggle.textContent='🖐 Firefox 수동 릴레이: '+(relayEnabled?'ON':'OFF');}
  relayLabel();
  function relayLog(kind,group,extra={}){
    relayEvents.push({atMs:round(now(),1),kind,group,phase:phase(),...extra});
    if(relayEvents.length>40)relayEvents.shift();
  }
  function relayAllowed(){
    return firefoxAndroid&&relayEnabled&&!disposed&&!getA().running&&!getA().chainEnabled&&
      !/^(interrupted|aborted|canceled|cancelled|failed|stopped|quit|finished|finish|complete|completed|result|results|ended|end|done)$/.test(phase());
  }
  function relayGameInput(group,down){
    const target=doc?.querySelector(group==='brake'?'.cursor-interaction':'.boost-key');
    const win=doc?.defaultView;
    if(!target||!win?.PointerEvent)return false;
    try{
      target.dispatchEvent(new win.PointerEvent(down?'pointerdown':'pointerup',{
        bubbles:true,cancelable:true,pointerId:1,pointerType:'touch',
        isPrimary:true,button:0,buttons:down?1:0
      }));
      return true;
    }catch(e){relayLog('dispatch-error',group,{detail:String(e?.message||e).slice(0,90)});return false;}
  }
  function relayRecord(group,down,e){
    recordManualControl({group,down,at:now(),pointerType:e.pointerType||'touch'});
  }
  function relayDown(group,e){
    if(!e.isTrusted||!relayAllowed()||relayHeld[group])return;
    const id=Number.isFinite(e.pointerId)?e.pointerId:null;
    const touchId=e.changedTouches?.[0]?.identifier??null;
    const held={id,touchId,at:now(),sequence:++relaySequence};
    if(!relayGameInput(group,true)){relayCounters.missing++;return;}
    relayHeld[group]=held;relayCounters.down++;
    relayLog('trusted-relay-down',group,{type:e.type,pointerId:id,touchId,sequence:held.sequence});
    relayRecord(group,true,e);
    if(id!==null&&e.currentTarget?.setPointerCapture){
      try{e.currentTarget.setPointerCapture(id);relayLog('relay-capture-requested',group,{pointerId:id});}
      catch(err){relayLog('relay-capture-error',group,{detail:String(err?.message||err).slice(0,75)});}
    }
  }
  function relayUp(group,e){
    if(!e.isTrusted||!relayHeld[group])return;
    const held=relayHeld[group];
    if(Number.isFinite(e.pointerId)&&held.id!==null&&held.id!==e.pointerId)return;
    if(e.changedTouches?.length&&held.touchId!==null&&
       !Array.from(e.changedTouches).some(t=>t.identifier===held.touchId))return;
    if(e.type==='pointercancel'||e.type==='touchcancel'){
      relayCounters.cancel++;relayLog('trusted-relay-cancel',group,{type:e.type});return;
    }
    relayHeld[group]=null;
    const success=relayGameInput(group,false);
    relayCounters.up++;
    relayLog('trusted-relay-up',group,{type:e.type,success,elapsedMs:round(now()-held.at)});
    if(success)relayRecord(group,false,e);
  }
  function relayReset(reason){
    for(const group of ['brake','boost']){
      if(relayHeld[group]){
        // Only release an existing synthetic held state on teardown or game transition,
        // never synthesize a user-selected release timing during normal countdown/racing.
        relayGameInput(group,false);
        relayLog('relay-reset',group,{reason});
        relayHeld[group]=null;
      }
    }
  }
  function relayCreateLayer(group){
    const element=document.createElement('div');
    element.style.cssText='position:fixed;display:none;z-index:2147483645;pointer-events:auto;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;background:transparent;box-sizing:border-box;';
    element.setAttribute('aria-label',group==='brake'?'수동 브레이크 입력 릴레이':'수동 부스터 입력 릴레이');
    const events=['pointerdown','pointerup','pointercancel','touchstart','touchend','touchcancel','mousedown','mouseup','click'];
    for(const type of events){
      element.addEventListener(type,e=>{
        if(!e.isTrusted)return;
        e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
        if(type==='pointerdown'||type==='touchstart')relayDown(group,e);
        else if(type==='pointerup'||type==='touchend'||type==='pointercancel'||type==='touchcancel')relayUp(group,e);
      },{capture:true,passive:false});
    }
    document.body.appendChild(element);
    relayLayers[group]=element;
  }
  relayCreateLayer('brake');relayCreateLayer('boost');
  function relayGlobalRelease(e){
    if(!e.isTrusted)return;
    if(!/^(pointerup|pointercancel|touchend|touchcancel)$/.test(e.type))return;
    // Only the held pointer/touch is released; ignored for unrelated touches.
    for(const group of ['brake','boost'])relayUp(group,e);
  }
  for(const type of ['pointerup','pointercancel','touchend','touchcancel']){
    window.addEventListener(type,relayGlobalRelease,true);
    document.addEventListener(type,relayGlobalRelease,true);
  }
  function relayPosition(at){
    if(at-relayLastLayout<90)return;
    relayLastLayout=at;
    const allowed=relayAllowed(),frame=document.querySelector('iframe[title="타임어택"]');
    const screen=frame?.getBoundingClientRect(),src=doc?.documentElement;
    const sx=screen&&src?.clientWidth?screen.width/src.clientWidth:0;
    const sy=screen&&src?.clientHeight?screen.height/src.clientHeight:0;
    for(const group of ['brake','boost']){
      const layer=relayLayers[group],target=doc?.querySelector(group==='brake'?'.cursor-interaction':'.boost-key');
      const rect=target?.getBoundingClientRect?.();
      if(!allowed||!screen||!rect||!sx||!sy||rect.width<20||rect.height<20||
         screen.width<=0||screen.height<=0){
        layer.style.display='none';continue;
      }
      const left=screen.left+rect.left*sx,top=screen.top+rect.top*sy,width=rect.width*sx,height=rect.height*sy;
      if(width<28||height<24||left<-width||top<-height||left>innerWidth||top>innerHeight){
        layer.style.display='none';continue;
      }
      layer.style.display='block';
      layer.style.left=left+'px';layer.style.top=top+'px';layer.style.width=width+'px';layer.style.height=height+'px';
    }
  }
  relayToggle.onclick=()=>{
    relayEnabled=!relayEnabled;
    try{localStorage.setItem(FIREFOX_RELAY_KEY,relayEnabled?'on':'off');}catch(_){}
    relayReset('user-toggle');relayPosition(0);relayLabel();
    say('Firefox 수동 입력 릴레이 '+(relayEnabled?'켜짐':'꺼짐'));
  };
  function relayDestroy(){
    relayReset('module-destroy');
    for(const type of ['pointerup','pointercancel','touchend','touchcancel']){
      window.removeEventListener(type,relayGlobalRelease,true);
      document.removeEventListener(type,relayGlobalRelease,true);
    }
    relayToggle.remove();
    for(const el of Object.values(relayLayers))el.remove();
  }
  function status(message){lastStatus=message;statusNode.textContent='✋ 수동 기록 · '+message+(lastError?' / '+lastError:'');}
  function now(){return performance.now();}
  function round(n,d=3){return Number.isFinite(n)?Number(n.toFixed(d)):null;}
  function visible(el){return !!el&&el.isConnected&&el.getClientRects().length>0;}
  function text(el){return String(el?.innerText||el?.textContent||'').replace(/\s+/g,' ').trim();}
  function phase(){return String(trackRoot?.dataset.phase||'').toLowerCase();}
  function kst(iso){const n=Date.parse(iso);return Number.isFinite(n)?new Date(n+9*3600000).toISOString().replace('Z','+09:00'):null;}
  function game(){try{return document.querySelector('iframe[title="타임어택"]')?.contentDocument||null;}catch(_){return null;}}
  function course(){
    let id='unknown-course',name=getA().courseName||'미확인';
    try{const t=[...(doc?.querySelectorAll('script')||[])].map(x=>x.textContent||'').join('\n');id=t.match(/"id"\s*:\s*"([^"]+)"/)?.[1]||id;name=t.match(/"name"\s*:\s*"([^"]+)"/)?.[1]||name;}catch(_){}
    return {id,name};
  }
  function vehicle(){
    const s=autoUi()?.querySelector('#vehicle-info')?.textContent||'';
    const get=re=>s.match(re)?.[1]||null;
    const stars=Number(get(/별:\s*(\d+)/));
    const top=Number(get(/표시 최고속력:\s*(\d+)/));
    return {name:get(/차량:\s*([^\n]+)/),grade:get(/등급:\s*(SSR|SR|S|R)/),
      stars:stars>0?stars:null,tire:get(/타이어:\s*(hard|medium|soft)/i),
      displayTopSpeedKmh:top>0?top:null,source:'AUTO-readonly-display',confidence:s.includes('인식: verified-dom')?'verified-dom':'partial'};
  }
  function readSpeed(){
    const els=[...(doc?.querySelectorAll('[data-speed],[aria-label],[class*="speed"],[id*="speed"]')||[])].slice(0,100);
    for(const el of els){if(!visible(el))continue;const raw=el.getAttribute('data-speed')||el.getAttribute('aria-label')||text(el);
      if(/최고속|최대속|top.?speed/i.test(raw))continue;
      const m=raw.match(/(?:현재\s*속도|속도|speed)?\s*[:：]?\s*(\d{1,3}(?:\.\d+)?)\s*km\s*\/\s*h/i);
      if(m)return Number(m[1]);}
    return null;
  }
  // Read the live game HUD using the same read-only DOM patterns as the verified AUTO engine.
  // The earlier manual recorder omitted generic div/b/p elements and missed mid-race lap time.
  function parseGameHudSeconds(raw){
    const t=String(raw??'').trim();
    if(!t||t.length>95||/최고\s*(?:기록|속력|속도)|랭킹|순위|best\s*lap/i.test(t))return null;
    const m=t.match(/(?:^|[^\d])(?:(\d{1,2}):([0-5]\d)\.(\d{1,3})|(\d{1,3})\.(\d{1,3}))\s*(?:초|seconds?|sec\b|s\b)?/i);
    if(!m)return null;
    const sec=m[1]!==undefined?Number(m[1])*60+Number(m[2])+Number('0.'+m[3]):Number(m[4])+Number('0.'+m[5]);
    return sec>=0&&sec<900&&Number.isFinite(sec)?Math.round(sec*1000)/1000:null;
  }
  function parseLabeledGameHudSeconds(raw){
    const t=String(raw??'').replace(/\s+/g,' ').trim();
    if(!t||t.length>160||/랭킹|순위|기록실|fastest\s*lap|best\s*lap/i.test(t))return null;
    const m=t.match(/(?:랩\s*타임|lap\s*time)\s*[:：]?\s*((?:\d{1,2}:)?\d{1,3}\.\d{1,3})\s*(?:초|s\b)?/i);
    return m?parseGameHudSeconds(m[1]):null;
  }
  function readClockObservation(){
    const r=trackRoot;if(!r)return null;
    const direct=[...r.querySelectorAll('[data-lap-time],[data-race-time],[id*="lap-time"],[class*="lap-time"],[class*="lapTime"],[id*="lapTimer"],[class*="lapTimer"],[class*="race-timer"]')].slice(0,50);
    for(const el of direct){
      if(!visible(el))continue;
      const attr=el.getAttribute('data-lap-time')??el.getAttribute('data-race-time');
      if(attr!==null){const seconds=parseGameHudSeconds(attr);if(seconds!==null)return {seconds,source:'game-hud-clock-attribute'};}
      const t=text(el),labeled=parseLabeledGameHudSeconds(t);
      if(labeled!==null)return {seconds:labeled,source:'game-hud-labeled-clock'};
      if(/^(?:(?:\d{1,2}:)?\d{1,3}\.\d{1,3})\s*(?:초|s)?$/i.test(t)){
        const seconds=parseGameHudSeconds(t);
        if(seconds!==null)return {seconds,source:'game-hud-dedicated-clock'};
      }
    }
    // Search active race root only. Exclude the outer-page FASTEST LAP ranking.
    // Include div/b/p to find the actual lap-time HUD label present during a run.
    for(const el of [...r.querySelectorAll('span,div,small,strong,b,p')].slice(0,500)){
      if(!visible(el))continue;
      const t=text(el);
      if(t.length>160||!/랩\s*타임|lap\s*time/i.test(t))continue;
      const seconds=parseLabeledGameHudSeconds(t);
      if(seconds!==null)return {seconds,source:'game-hud-labeled-clock'};
    }
    return null;
  }
  function readClock(){return readClockObservation()?.seconds??null;}
  function captureClock(at,force=false){
    const observed=readClockObservation();
    if(!observed||!session)return observed;
    const elapsed=round(at-session.startedAt,2);
    if(elapsed===null||elapsed<0)return null;
    // Reject a decreasing value (e.g. a ranking/time from a replacement HUD element).
    if(session.lastClock!==null&&observed.seconds+0.05<session.lastClock)return null;
    session.lastClock=observed.seconds;
    session.lastClockAtMs=elapsed;
    session.lastClockSource=observed.source;
    session.clockReadCount=(session.clockReadCount||0)+1;
    const prev=session.clockSamples.at(-1);
    if(!prev||elapsed-prev.timeMs>=450||force){
      if(!prev||elapsed-prev.timeMs>25||observed.seconds!==prev.seconds){
        session.clockSamples.push({timeMs:elapsed,seconds:observed.seconds,source:observed.source});
        if(session.clockSamples.length>220)session.clockSamples.shift();
      }
    }
    return observed;
  }
  function readResultClock(){
    for(const el of [...(trackRoot?.querySelectorAll('[class*="result"],[id*="result"],[class*="finish"]')||[])].slice(0,60)){
      if(!visible(el))continue;const raw=text(el);if(raw.length>500)continue;
      const m=raw.match(/(?:최종\s*(?:랩\s*타임|기록|시간)|공식\s*(?:기록|시간)|final\s*(?:lap\s*time|time))\s*[:：]?\s*((?:\d{1,2}:)?\d{1,3}\.\d{1,3})/i);
      if(m){const a=m[1].match(/^(?:(\d+):)?(\d+)\.(\d{1,3})$/);if(a)return Number(a[1]||0)*60+Number(a[2])+Number('0.'+a[3]);}
    }
    return null;
  }
  function classify(r,g,b){if(Math.max(r,g,b)<95)return null;let best=null,d=Infinity;
    for(const [type,rgb] of Object.entries(COLOR)){const diff=Math.hypot(r-rgb[0],g-rgb[1],b-rgb[2]);if(diff<d){d=diff;best=type;}}
    return d<=48?best:null;
  }
  function scan(at){
    lastCanvasRead=at;
    const canvas=doc?.querySelector('canvas[aria-label="타임어택 주행 트랙"]');
    if(!canvas||canvas.width<=320||canvas.height<=80)return;
    const top=80,bottom=Math.min(420,canvas.height),x=320;
    let data;try{data=canvas.getContext('2d')?.getImageData(x,top,1,bottom-top)?.data;}catch(_){return;}
    if(!data)return;
    const found=[],bands=[];let band=null;
    function flush(){if(band&&band.count>=4)bands.push({type:band.type,y:(band.start+band.end)/2});}
    for(let i=0;i<bottom-top;i++){const p=i*4,type=classify(data[p],data[p+1],data[p+2]),y=top+i;
      if(type&&band&&band.type===type&&y-band.end<=2){band.end=y;band.count++;}
      else{flush();band=type?{type,start:y,end:y,count:1}:null;}}
    flush();
    for(const type of Object.keys(COLOR)){
      const targets=bands.filter(b=>b.type===type);
      if(!targets.length)continue;
      const reference=type.startsWith('brake')?315:315;
      const best=targets.sort((a,b)=>Math.abs(a.y-reference)-Math.abs(b.y-reference))[0];
      const prior=lastPosition[type],dt=prior?at-prior.at:0;
      const dy=prior?best.y-prior.y:0;
      const speed=dt>4&&dt<150&&dy>=0&&dy<80?dy/dt:null;
      const point={at:round(at,2),y:round(best.y,2),speedPxMs:round(speed,5),frameMs:round(frameAvg,2)};
      lastPosition[type]=point;trace[type].push(point);if(trace[type].length>12)trace[type].shift();
      found.push(point);
    }
    lastCanvasRead=at;
    return found;
  }
  function feedbackKind(raw){
    if(/^진입\s+/i.test(raw)&&/\s*\/\s*탈출\s+/i.test(raw)){
      const m=raw.match(/^진입\s+(PERFECT|GREAT|GOOD|BAD|MISS)(?:\s*·\s*(빠름|늦음)\s*([\d.]+)\s*m)?\s*\/\s*탈출\s+(PERFECT|GREAT|GOOD|BAD|MISS)(?:\s*·\s*(빠름|늦음)\s*([\d.]+)\s*m)?(?:\s*·\s*(\d+)\s*km\/h)?/i);
      return {kind:'segment',entry:m?.[1]?.toLowerCase()||null,exit:m?.[4]?.toLowerCase()||null,
        speedKmh:m?.[7]?Number(m[7]):null,entryDirection:m?.[2]||null,exitDirection:m?.[5]||null,raw};
    }
    let type=null;
    if(/브레이크\s*진입/.test(raw))type='brakeOn';else if(/브레이크\s*해제/.test(raw))type='brakeOff';
    else if(/부스터\s*ON|BOOST\s*ON/i.test(raw))type='boostOn';else if(/부스터\s*OFF|BOOST\s*OFF/i.test(raw))type='boostOff';
    if(!type)return null;
    const g=raw.match(/PERFECT|GREAT|GOOD|BAD|MISS|퍼펙트|그레이트|굿|배드|미스/i)?.[0]?.toLowerCase();
    const local={퍼펙트:'perfect',그레이트:'great',굿:'good',배드:'bad',미스:'miss'};
    if(!g)return null;const dir=/빠름|EARLY/i.test(raw)?'early':/늦음|LATE/i.test(raw)?'late':null;
    return {kind:'event',type,grade:local[g]||g,direction:dir,distanceM:Number(raw.match(/(?:빠름|늦음|EARLY|LATE)\s*([\d.]+)\s*m/i)?.[1])||null,raw};
  }
  function processFeedback(raw){
    if(!session||!raw)return;
    const parsed=feedbackKind(raw),at=now();
    if(/휠\s*락|wheel\s*lock/i.test(raw))session.wheelLockObservations.push({timeMs:round(at-session.startedAt),raw:raw.slice(0,220)});
    if(!parsed)return;
    const elapsed=round(at-session.startedAt,2);
    if(parsed.kind==='segment'){
      const prev=session.segmentResults.at(-1)?.timeMs||0;
      const hud=captureClock(at,true);
      const cachedAgeMs=elapsed-(session.lastClockAtMs??-Infinity);
      const cachedUsable=!hud&&session.lastClock!==null&&cachedAgeMs>=0&&cachedAgeMs<=350;
      const gameHud=hud?.seconds??(cachedUsable?session.lastClock:null);
      const previousHud=session.segmentResults.at(-1)?.gameHudSec??0;
      session.segmentResults.push({...parsed,timeMs:elapsed,elapsedSec:round(elapsed/1000),splitSec:round((elapsed-prev)/1000),
        gameHudSec:gameHud,gameHudSplitSec:gameHud!==null&&gameHud>=previousHud?round(gameHud-previousHud):null,
        hudSource:hud?.source??(cachedUsable?'recent-'+session.lastClockSource:null),
        hudSampleAgeMs:hud?0:cachedUsable?round(cachedAgeMs):null,
        timingSource:hud?'game-hud-at-feedback-observation':cachedUsable?'game-hud-recent-sample-at-feedback':'browser-feedback-observation-not-official-game-split'});
      return;
    }
    const candidates=session.history.filter(h=>h.type===parsed.type&&!h.feedbackGrade&&at-h.monotonicAt>=0&&at-h.monotonicAt<=1800);
    const record=candidates.length?candidates.at(-1):null;
    if(record){record.feedbackGrade=parsed.grade;record.feedbackDirection=parsed.direction;record.feedbackDistanceM=parsed.distanceM;record.feedback=raw;record.feedbackObservedMs=elapsed;}
    session.feedbackLog.push({...parsed,timeMs:elapsed,matched:!!record,eventSequence:record?.sequence||null});
  }
  function observeFeedback(){
    const next=trackRoot?.querySelector('.feedback');
    if(next===fbElement)return;
    fbObserver?.disconnect();fbElement=next;lastFeedback='';feedbackCleared=true;
    if(!next)return;
    fbObserver=new MutationObserver(()=>{
      if(!session||getA().running)return;
      const value=fbElement?.textContent?.trim()||'';
      if(!value){feedbackCleared=true;return;}
      if(value!==lastFeedback||feedbackCleared){lastFeedback=value;feedbackCleared=false;processFeedback(value);}
    });
    fbObserver.observe(next,{subtree:true,characterData:true,childList:true});
  }
  function begin(at,source){
    const c=course(),v=vehicle();
    const field=(id,def)=>{const n=Number(autoUi()?.querySelector('#'+id)?.value);return Number.isFinite(n)&&n>0?n:def;};
    const tol=field('tolerance',8),referenceLines={brake:field('brakeY',315)-tol,boost:field('boostY',315)-tol};
    const t=new Date().toISOString();
    session={runId:'manual-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8),
      time:t,timeKst:kst(t),runSource:'MANUAL',mode:'manual',version:'manual-recorder-'+VERSION,
      recorderVersion:VERSION,courseId:c.id,courseName:c.name,vehicle:v,
      startedAt:at,startedAtWall:Date.now(),startSource:source,referenceLines,
      phaseAtStart:phase(),history:[],controlActions:pending.splice(0),feedbackLog:[],segmentResults:[],
      speedSamples:[],clockSamples:[],wheelLockObservations:[],inputSequence:0,finishObservedAt:null,
      saveRequested:false,saveState:'recording',lastClock:null,lastClockAtMs:null,lastClockSource:null,clockReadCount:0};
    for(const action of session.controlActions){action.role='preparation';action.relativeMs=round(action.at-session.startedAt,2);delete action.at;}
    pressState={brake:false,boost:false};redSeen=false;frameAvg=16.67;lastFrame=at;lastCheckpoint=0;lastClockPoll=0;lastSpeed=null;lastSpeedAt=0;
    lastPosition={};for(const key of Object.keys(trace))trace[key]=[];
    status('기록 중 · '+v.tire+' / '+c.name);
    observeFeedback();
  }
  function eventFor(e){
    const target=e.target?.closest?.('.cursor-interaction,.boost-key');
    if(!target)return null;
    const group=target.matches('.boost-key')?'boost':'brake';
    const down=/^(pointerdown|mousedown|touchstart)$/.test(e.type);
    const up=/^(pointerup|mouseup|touchend|pointercancel|touchcancel)$/.test(e.type);
    if(!down&&!up)return null;
    return {group,down,at:now(),pointerType:e.pointerType||(e.type.startsWith('touch')?'touch':'mouse')};
  }
  function onControl(e){
    firefoxObserve(e);
    if(!e.isTrusted||getA().running||getA().chainEnabled)return;
    const item=eventFor(e);if(!item)return;
    if(e.type.startsWith('pointer'))lastPointerTime=item.at;
    else if(item.at-lastPointerTime<320)return; // do not double-count synthetic mouse/touch events
    recordManualControl(item);
  }
  function recordManualControl(item){
    if(getA().running||getA().chainEnabled)return;
    if(pressState[item.group]===item.down)return;
    pressState[item.group]=item.down;
    const type=item.group==='brake'?(item.down?'brakeOn':'brakeOff'):(item.down?'boostOn':'boostOff');
    if(!session){
      if(phase()==='ready'){pending.push({type,at:item.at,pointerType:item.pointerType});if(pending.length>12)pending.shift();}
      return;
    }
    if(session.finishObservedAt!==null)return;
    const point=lastPosition[type],age=point?item.at-point.at:Infinity;
    const line=session.referenceLines[item.group];
    const trustedPoint=age>=0&&age<=70?point:null;
    const speed=trustedPoint?.speedPxMs||null;
    const estimatedY=trustedPoint?(trustedPoint.y+(speed>0?speed*age:0)):null;
    const dist=estimatedY===null?null:line-estimatedY;
    const currentSpeed=lastSpeed,elapsed=round(item.at-session.startedAt,2);
    const previousSame=session.history.slice().reverse().find(h=>h.type===(item.down?item.group==='brake'?'brakeOff':'boostOff':item.group==='brake'?'brakeOn':'boostOn'));
    const record={sequence:++session.inputSequence,eventKey:type+':'+session.inputSequence,type,event:names[type],
      time:round(item.at,2),monotonicAt:item.at,timeSinceStartMs:elapsed,pointerType:item.pointerType,
      markerY:trustedPoint?.y??null,estimatedMarkerYAtInput:round(estimatedY,3),markerSpeedPxMs:speed,markerAgeMs:trustedPoint?round(age,2):null,
      referenceLineY:line,referenceLineSource:'AUTO-calibration-only-not-game-judgement',markerTimingMethod:'prior-sampled-frame',
      distanceToReferencePx:dist===null?null:round(dist,3),
      estimatedTimeToReferenceMs:dist!==null&&speed>0?round(dist/speed,2):null,
      speedKmh:currentSpeed,gameHudSampleAtInputSec:session.lastClock,averageFrameMs:round(frameAvg,2),
      heldDurationMs:!item.down&&previousSame?round(item.at-previousSame.monotonicAt,2):null,
      frameTrace:{before:trace[type].slice(-8),after:[]},
      feedbackGrade:null,feedbackDirection:null,feedbackDistanceM:null,feedback:null,feedbackObservedMs:null};
    session.history.push(record);
    session.controlActions.push({type,relativeMs:elapsed,pointerType:item.pointerType,role:'racing'});
  }
  function checkpoint(at){
    if(!session||at-lastCheckpoint<1700)return;
    lastCheckpoint=at;
    try{
      const snapshot={...session,history:session.history.map(h=>({...h,frameTrace:undefined})),speedSamples:session.speedSamples.slice(-20),
        clockSamples:session.clockSamples.slice(-20)};
      localStorage.setItem(CHECKPOINT,JSON.stringify(snapshot));
    }catch(e){lastError='임시 저장 실패';}
  }
  function elapsedSections(s,end,lap){
    function stats(a,b){
      const data=s.speedSamples.filter(x=>x.timeMs>=a&&x.timeMs<=b&&Number.isFinite(x.kmh)).map(x=>x.kmh);
      const actions=s.history.filter(x=>x.timeSinceStartMs>=a&&x.timeSinceStartMs<=b);
      return {avgSpeedKmh:data.length?round(data.reduce((n,v)=>n+v,0)/data.length,2):null,
        maxSpeedKmh:data.length?Math.max(...data):null,speedSampleCount:data.length,
        brakeOnCount:actions.filter(x=>x.type==='brakeOn').length,
        brakeOffCount:actions.filter(x=>x.type==='brakeOff').length,
        boostOnCount:actions.filter(x=>x.type==='boostOn').length,
        boostOffCount:actions.filter(x=>x.type==='boostOff').length};
    }
    const marks=s.segmentResults.map((x,i)=>({name:'판정 구간 '+(i+1),timeMs:x.timeMs,gameHudSec:x.gameHudSec}));
    const split=[];let before=0;
    for(const m of marks){split.push({name:m.name,fromMs:round(before),toMs:round(m.timeMs),durationSec:round((m.timeMs-before)/1000),
      source:'feedback-observation',...stats(before,m.timeMs)});before=m.timeMs;}
    if(Number.isFinite(end)&&end>before)split.push({name:'마지막 구간',fromMs:round(before),toMs:round(end),durationSec:round((end-before)/1000),
      source:'feedback-to-finish-observation',...stats(before,end)});
    const gameHud=[],gameMarkers=[{name:'start',gameHudSec:0},...marks.filter(x=>Number.isFinite(x.gameHudSec))];
    for(let i=1;i<gameMarkers.length;i++){const a=gameMarkers[i-1],b=gameMarkers[i];
      if(b.gameHudSec>=a.gameHudSec)gameHud.push({name:b.name,fromSec:round(a.gameHudSec),toSec:round(b.gameHudSec),
        durationSec:round(b.gameHudSec-a.gameHudSec),source:'hud-at-feedback-not-official-split'});}
    const last=gameMarkers.at(-1);
    if(Number.isFinite(lap)&&lap>last.gameHudSec)gameHud.push({name:'마지막 구간',fromSec:round(last.gameHudSec),toSec:round(lap),
      durationSec:round(lap-last.gameHudSec),source:'hud-at-finish-may-include-penalty'});
    const brakes=s.history.filter(x=>x.type==='brakeOn'),byBrake=[],boundaries=[{timeSinceStartMs:0},...brakes];
    if(Number.isFinite(end))boundaries.push({timeSinceStartMs:end});
    for(let i=1;i<boundaries.length;i++){
      const a=boundaries[i-1].timeSinceStartMs,b=boundaries[i].timeSinceStartMs;
      if(b>a)byBrake.push({name:'브레이크 기준 '+i+'구간',fromMs:round(a),toMs:round(b),durationSec:round((b-a)/1000),
        source:'brake-on-to-next-brake-on-proxy',...stats(a,b)});
    }
    return {fromFeedback:split,fromGameHud:gameHud,fromBrake:byBrake,officialSplitTimesAvailable:false};
  }
  async function finalize(reason,finished){
    const s=session;if(!s||s.saveRequested)return;
    s.saveRequested=true;
    fbObserver?.disconnect();fbObserver=null;fbElement=null;
    const at=now(),end=s.finishObservedAt??at;
    // Refine the original event-time estimate from bracketing frame samples after all inputs are processed.
    for(const h of s.history){
      const before=h.frameTrace?.before?.at(-1),after=h.frameTrace?.after?.find(x=>x.at>h.time);
      if(!before||!after)continue;
      const span=after.at-before.at,dy=after.y-before.y;
      if(!(span>0&&span<=110&&dy>=0&&dy<=45&&h.time>=before.at&&h.time<=after.at))continue;
      const interpolated=before.y+dy*(h.time-before.at)/span;
      h.interpolatedMarkerYAtInput=round(interpolated,3);
      h.interpolatedDistanceToReferencePx=round(h.referenceLineY-interpolated,3);
      h.markerTimingMethod='bounded-bracketing-frames-interpolation';
    }
    const finalResult=finished?readResultClock():null;
    const finishHud=finished?readClockObservation():null;
    const lastHudAgeMs=(end-s.startedAt)-(s.lastClockAtMs??-Infinity);
    const recentHud=finished&&s.lastClock!==null&&lastHudAgeMs>=0&&lastHudAgeMs<=1500?s.lastClock:null;
    const lap=finished?(finalResult??finishHud?.seconds??recentHud):null;
    const grades={perfect:0,great:0,good:0,bad:0,miss:0};
    for(const x of s.feedbackLog)if(x.kind==='event'&&Object.hasOwn(grades,x.grade))grades[x.grade]++;
    const result={runId:s.runId,runSource:'MANUAL',mode:'manual',version:s.version,recorderVersion:s.recorderVersion,
      time:s.time,timeKst:s.timeKst,timeZone:'Asia/Seoul',
      courseId:s.courseId,courseName:s.courseName,vehicle:s.vehicle,
      complete:!!finished,reason,events:s.history.length,grades,
      history:s.history.map(({monotonicAt,...record})=>record),controlActions:s.controlActions,
      feedbackLog:s.feedbackLog,segmentResults:s.segmentResults,
      timingSections:elapsedSections(s,round(end-s.startedAt,2),lap),
      gameTiming:{recordedLapTimeSec:lap,recordedLapTimeSource:finalResult!==null?'game-explicit-result':finishHud!==null?'game-hud-at-finish':recentHud!==null?'recent-game-hud-sample-near-finish':null,
        recordedLapTimeStatus:finalResult!==null?'explicit-final-result':lap!==null?'hud-finish-observed-not-officially-verified':'not-detected',
        hudClockTrace:s.clockSamples,clockCapture:{readCount:s.clockReadCount||0,sampleCount:s.clockSamples.length,
          feedbackWithHud:s.segmentResults.filter(x=>Number.isFinite(x.gameHudSec)).length,feedbackTotal:s.segmentResults.length,
          lastSource:s.lastClockSource,liveTimerAdvanced:s.clockSamples.some(x=>x.seconds>0)&&s.clockSamples.some(x=>x.seconds>0&&x.seconds<(lap??Infinity))}},
      observedRaceDurationMs:round(end-s.startedAt),raceDurationSource:'client-observed-start-to-finish',
      speedSamples:s.speedSamples,wheelLockObservations:s.wheelLockObservations,
      completionEvidence:{phase:phase(),matchedInputs:s.history.filter(x=>x.feedbackGrade).length,
        ungradedInputs:s.history.filter(x=>!x.feedbackGrade).length,
        unmatchedFeedback:s.feedbackLog.filter(x=>x.kind==='event'&&!x.matched).length},
      measurementNotes:{clientSplits:'Monotonic performance clock at visible feedback or manual brake on. Not official splits.',
        controls:'Trusted capture-phase DOM pointer/mouse/touch events. No canvas/HUD reads in event handler; event time is captured then marker position estimated from cached or bracketing frames.',
        markerLine:'Reference line from AUTO calibration; not proof of true game judgement threshold.',
        autoTraining:'observation-only; manual samples do not adjust AUTO timing'}};
    lastSaved=result;session=null;pending=[];status('원본 보관 중 · '+result.runId);
    try{
      if(!window.__duRunArchive?.put)throw Error('AUTO IndexedDB 보관소 연결 실패');
      await window.__duRunArchive.put(result);
      try{localStorage.removeItem(CHECKPOINT);}catch(_){}
      lastError='';status('저장됨 · '+(finished?'완주':'미완주')+' · '+(lap===null?'랩타임 미확인':lap+'초'));
      cloudUploader.retry(); // existing authenticated upload path, server ACK still required
    }catch(e){
      window.__duUnsavedManualRun=result;
      lastError='원본 보관 실패: '+String(e?.message||e).slice(0,85);
      status('⚠ 기록 백업 필요');
    }
  }
  function countRed(){
    const lights=[...(doc?.querySelectorAll('.lights i')||[])];
    if(lights.length!==5)return -1;
    let count=0;
    for(const el of lights){
      const raw=doc.defaultView.getComputedStyle(el).backgroundColor;
      const rgb=raw.match(/\d+/g)?.map(Number);
      if(rgb&&rgb[0]>110&&rgb[0]>rgb[1]*1.35&&rgb[0]>rgb[2]*1.35)count++;
    }
    return count;
  }
  function attach(next){
    if(doc===next)return;
    if(doc)for(const ev of ['pointerdown','pointerup','pointercancel','mousedown','mouseup','touchstart','touchend','touchcancel'])
      doc.removeEventListener(ev,onControl,true);
    if(doc?.defaultView)for(const ev of firefoxReleaseTypes)doc.defaultView.removeEventListener(ev,firefoxFrameRelease,true);
    fbObserver?.disconnect();fbObserver=null;fbElement=null;
    firefoxReset('iframe-replaced');
    firefoxPrepareSurface();
    doc=next;trackRoot=doc?.querySelector('#pedallap')||null;
    if(doc)for(const ev of ['pointerdown','pointerup','pointercancel','mousedown','mouseup','touchstart','touchend','touchcancel'])
      doc.addEventListener(ev,onControl,{capture:true,passive:true});
    if(firefoxAndroid&&doc?.defaultView)for(const ev of firefoxReleaseTypes)doc.defaultView.addEventListener(ev,firefoxFrameRelease,true);
    firefoxPrepareSurface();
    previousPhase='';redSeen=false;lastFrame=0;lastPosition={};pending=[];lastFirefoxLightPoll=0;
    if(!session)status(doc?'주행 준비 · 자동 관찰':'타임어택 화면 대기');
  }
  let disposed=false,raf=null,slowTimer=null;
  function tick(at){
    if(disposed)return;
    const a=getA();
    if(a.running||a.chainEnabled){
      relayReset('auto-running');
      relayPosition(at);
      if(session&&!session.saveRequested)finalize('AUTO-took-control',false);
      pending=[];redSeen=false;
      slowTimer=setTimeout(()=>{if(!disposed)raf=requestAnimationFrame(tick);},250);
      return;
    }
    raf=requestAnimationFrame(tick);
    const next=game();if(next!==doc){relayReset('iframe-change');attach(next);}
    if(!doc)return;
    if(!trackRoot?.isConnected){trackRoot=doc.querySelector('#pedallap');if(!trackRoot)return;}
    const p=phase();
    relayPosition(at);
    if(firefoxAndroid){
      firefoxPrepareSurface();
      if(firefoxHeld&&at-lastFirefoxLightPoll>=15){lastFirefoxLightPoll=at;firefoxObserveLights();}
      if(/^(interrupted|aborted|canceled|cancelled|failed|stopped|quit)$/.test(p)&&firefoxHeld)
        firefoxReset('game-interrupted');
    }
    if(!session){
      if(p==='ready'&&at-lastLightPoll>=35){
        lastLightPoll=at;
        const red=countRed();if(red===5){redSeen=true;if(firefoxHeld)firefoxSawFive=true;}
        if(redSeen&&red===0&&pending.some(x=>x.type==='brakeOn'))begin(at,'start-lights-release-observed');
      }else if(ACTIVE.test(p)&&previousPhase!==p)begin(at,'game-active-phase-observed');
    }
    if(session&&!session.saveRequested){
      if(lastFrame){const dt=at-lastFrame;if(dt>0&&dt<100)frameAvg=frameAvg*.85+dt*.15;}
      lastFrame=at;
      if(at-lastCanvasRead>=32){
        scan(at);
        for(const record of session.history.slice(-5)){
          if(!record.frameTrace||at-record.time>260||record.frameTrace.after.length>=8)continue;
          const pt=lastPosition[record.type];
          if(pt&&pt.at>record.time)record.frameTrace.after.push({...pt});
        }
      }
      if(at-lastSpeedAt>=110){
        const v=readSpeed();lastSpeedAt=at;
        if(Number.isFinite(v)&&v>=0&&v<=450){lastSpeed=v;session.speedSamples.push({timeMs:round(at-session.startedAt),kmh:v});if(session.speedSamples.length>1400)session.speedSamples.shift();}
      }
      if(at-lastClockPoll>=170){
        lastClockPoll=at;
        captureClock(at);
      }
      observeFeedback();checkpoint(at);
      if(FINISH.test(p)){
        if(session.finishObservedAt===null)session.finishObservedAt=at;
        if(at-session.finishObservedAt>=900)finalize('complete',true);
      }else if(STOPPED.test(p)||(p==='ready'&&previousPhase!=='ready'&&session.finishObservedAt===null)){
        finalize('interrupted',false);
      }else if(session.finishObservedAt!==null&&p==='ready')finalize('complete',true);
    }
    previousPhase=p;
  }
  async function report(){
    try{
      const saved=await allSavedRuns(),manual=saved.filter(r=>r.runSource==='MANUAL');
      const completed=manual.filter(r=>r.complete),totalEvents=completed.reduce((n,r)=>n+(r.events||0),0);
      const perfect=completed.reduce((n,r)=>n+(r.history||[]).filter(h=>h.feedbackGrade==='perfect').length,0);
      const allPerfect=completed.filter(r=>r.events>0&&(r.history||[]).length===r.events&&(r.history||[]).every(h=>h.feedbackGrade==='perfect')&&r.completionEvidence?.unmatchedFeedback===0).length;
      const lap=completed.map(r=>r.gameTiming?.recordedLapTimeSec).filter(x=>Number.isFinite(x)&&x>0);
      const latest=lastSaved||manual.at(-1);
      const lines=['✋ MANUAL 정밀 분석 · 기록기 v'+VERSION,
        '저장 '+manual.length+'판 / 완주 '+completed.length+'판',
        '입력별 PERFECT '+(totalEvents?round(perfect/totalEvents*100,2)+'%':'미측정')+' ('+perfect+'/'+totalEvents+')',
        '올퍼펙트 '+(completed.length?round(allPerfect/completed.length*100,2)+'%':'미측정')+' ('+allPerfect+'/'+completed.length+')',
        '게임 랩타임 '+lap.length+'건 · 최단 '+(lap.length?Math.min(...lap).toFixed(3)+'초':'미확인'),''];
      if(latest){
        const comparable=manual.filter(x=>x.runId!==latest.runId&&x.complete&&x.courseName===latest.courseName&&
          x.vehicle?.name===latest.vehicle?.name&&x.vehicle?.grade===latest.vehicle?.grade&&
          x.vehicle?.stars===latest.vehicle?.stars&&x.vehicle?.tire===latest.vehicle?.tire);
        const prev=comparable.at(-1),prevLap=prev?.gameTiming?.recordedLapTimeSec,lapNow=latest.gameTiming?.recordedLapTimeSec;
        if(prev&&Number.isFinite(prevLap)&&Number.isFinite(lapNow))
          lines.push('직전 동일 조건 대비 '+(round(lapNow-prevLap)>0?'+':'')+round(lapNow-prevLap)+'초 (비교 표본 1판)', '');
        lines.push('최근: '+latest.timeKst+' · '+latest.courseName,'차량 '+(latest.vehicle?.name||'미확인')+' / '+(latest.vehicle?.tire||'타이어 미확인'),
          '기록 '+(latest.gameTiming?.recordedLapTimeSec??'미확인')+'초 / 입력 '+latest.events+'개','',
          '구간 소요시간 (판정 메시지 관측 기준, 공식 스플릿 아님)');
        for(const sec of latest.timingSections?.fromFeedback||[])lines.push('  '+sec.name+': '+sec.durationSec+'초 / 누적 '+round(sec.toMs/1000)+'초');
        const captured=(latest.segmentResults||[]).filter(x=>Number.isFinite(x.gameHudSec)).length;
        lines.push('','게임 HUD 중간시간 관측 '+captured+'/'+(latest.segmentResults?.length||0)+'개 판정 구간',
          '게임 HUD로 관측한 구간시간 (공식 스플릿 아님)');
        for(const [i,sec] of (latest.timingSections?.fromGameHud||[]).entries()){
          const comparableSec=prev?.timingSections?.fromGameHud?.[i];
          const delta=comparableSec?.name===sec.name?round(sec.durationSec-comparableSec.durationSec):null;
          lines.push('  '+sec.name+': '+sec.durationSec+'초 / 누적 '+sec.toSec+'초'+(delta!==null?' / 직전 '+(delta>0?'+':'')+delta+'초':'') );
        }
        if(!captured)lines.push('  진행 중 HUD 중간시간 미검출 · 판정 관측시간 구간은 별도로 보존');
        lines.push('','브레이크 기준 구간');
        for(const sec of latest.timingSections?.fromBrake||[])lines.push('  '+sec.name+': '+sec.durationSec+'초 / 평균속도 '+(sec.avgSpeedKmh??'미측정')+'km/h / 최대속도 '+(sec.maxSpeedKmh??'미측정')+'km/h');
        lines.push('','입력 타이밍 / 판정');
        for(const h of latest.history||[])lines.push('  #'+h.sequence+' '+names[h.type]+' @'+round(h.timeSinceStartMs/1000)+'초 · '+(h.feedbackGrade||'미판정')+
          (h.feedbackDirection?' '+h.feedbackDirection+(h.feedbackDistanceM!==null?' '+h.feedbackDistanceM+'m':''):'')+
          (h.heldDurationMs!==null?' · 유지 '+h.heldDurationMs+'ms':'')+
          (h.interpolatedDistanceToReferencePx!==null?' · 보간 기준선 '+h.interpolatedDistanceToReferencePx+'px':
            h.distanceToReferencePx!==null?' · 기준선 '+h.distanceToReferencePx+'px':''));
        lines.push('','※ 기준선 거리는 AUTO 설정선 대비 관측값이며 실제 게임 판정선의 정밀 오차를 뜻하지 않습니다.');
      }
      q('#du-report-body').textContent=lines.join('\n');
      view='report';render();position();
    }catch(e){say('수동 분석 조회 실패: '+String(e?.message||e));}
  }
  analysisBtn.onclick=report;
  exportBtn.onclick=async()=>{
    try{const runs=(await allSavedRuns()).filter(r=>r.runSource==='MANUAL');
      if(window.__duUnsavedManualRun&&!runs.some(x=>x.runId===window.__duUnsavedManualRun.runId))runs.push(window.__duUnsavedManualRun);
      downloadRunBackup(runs);say('수동 주행 '+runs.length+'건 JSON 백업');}
    catch(e){say('수동 백업 실패: '+String(e?.message||e));}
  };
  function recoveredCheckpoint(){
    try{
      const raw=localStorage.getItem(CHECKPOINT);if(!raw)return;
      const old=JSON.parse(raw);if(!old?.runId||old.runSource!=='MANUAL')return;
      const result={runId:old.runId,runSource:'MANUAL',mode:'manual',version:old.version,
        time:old.time,timeKst:old.timeKst,timeZone:'Asia/Seoul',courseId:old.courseId,courseName:old.courseName,
        vehicle:old.vehicle,complete:false,reason:'abandoned-checkpoint',
        events:old.history?.length||0,grades:{},history:old.history||[],controlActions:old.controlActions||[],
        feedbackLog:old.feedbackLog||[],segmentResults:old.segmentResults||[],
        speedSamples:old.speedSamples||[],gameTiming:{recordedLapTimeSec:null},completionEvidence:{recoveredCheckpoint:true}};
      Promise.resolve(window.__duRunArchive?.all?.()).then(async existing=>{
        if(!Array.isArray(existing))throw Error('기존 원본 검증 불가');
        if(!existing.some(x=>x.runId===result.runId))await window.__duRunArchive.put(result);
        if(localStorage.getItem(CHECKPOINT)===raw)localStorage.removeItem(CHECKPOINT);
        cloudUploader.retry();
      })
        .catch(()=>{window.__duUnsavedManualRun=result;});
    }catch(e){console.warn('[Manual Telemetry] checkpoint recovery skipped:',String(e));}
  }
  recoveredCheckpoint();
  raf=requestAnimationFrame(tick);
  return {version:VERSION,state:()=>({status:lastStatus,error:lastError,active:!!session,lastSavedRunId:lastSaved?.runId||null,firefoxStartAssist:firefoxAssist,firefoxStartRecoveries:firefoxRecoveryCount}),
    destroy:()=>{relayDestroy();disposed=true;firefoxReset('destroy');firefoxAssist=false;firefoxPrepareSurface();firefoxToggle.remove();firefoxDiagnostic.remove();
      if(firefoxAndroid)for(const ev of firefoxReleaseTypes){document.removeEventListener(ev,firefoxOuterRelease,true);window.removeEventListener(ev,firefoxOuterRelease,true);}
      if(doc?.defaultView)for(const ev of firefoxReleaseTypes)doc.defaultView.removeEventListener(ev,firefoxFrameRelease,true);if(raf!==null)cancelAnimationFrame(raf);if(slowTimer!==null)clearTimeout(slowTimer);if(doc)for(const ev of ['pointerdown','pointerup','pointercancel','mousedown','mouseup','touchstart','touchend','touchcancel'])doc.removeEventListener(ev,onControl,true);
      fbObserver?.disconnect();statusNode.remove();analysisBtn.remove();exportBtn.remove();}};
})();

window.__dopamineUnifiedControl={active:true,destroy:()=>{clearInterval(timer);manualTelemetry.destroy();cloudUploader.destroy();box.remove();window.__dopamineUnifiedControl=null;}};
render();position();

})();
