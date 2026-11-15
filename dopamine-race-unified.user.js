// ==UserScript==
// @name         도파민 레이스 통합 컨트롤
// @namespace    dopamine-race-unified
// @version      1.0.1
// @description  AUTO Release 3.0 v3.3.20 + 차량 분석기 Release 1.0 / 기존 주행 계산 보존
// @match        https://luck-game-hjh.jihwan1010.chatgpt.site/*
// @updateURL    https://raw.githubusercontent.com/tnsdudhaha-ops/dopamine-race-auto/main/dopamine-race-unified.user.js
// @downloadURL  https://raw.githubusercontent.com/tnsdudhaha-ops/dopamine-race-auto/main/dopamine-race-unified.user.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function(){
'use strict';
if(window.__dopamineUnifiedControl?.active)return;
window.__duMode=true;
// ==UserScript==
// @name         도파민레이스 AUTO
// @namespace    dopamine-race
// @version      3.3.20
// @description  Release 3.0 / v3.3.5 주행 예측 유지 / 연속 주행 / 설정창 안전 전환
// @updateURL    https://raw.githubusercontent.com/tnsdudhaha-ops/dopamine-race-auto/main/dopamine-race-auto.user.js
// @downloadURL  https://raw.githubusercontent.com/tnsdudhaha-ops/dopamine-race-auto/main/dopamine-race-auto.user.js
// @match        https://luck-game-hjh.jihwan1010.chatgpt.site/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==
(() => {
'use strict';
const VERSION='3.3.20', RELEASE='Release 3.0', INSTANCE='__dopamineAutoActive';
try {window[INSTANCE]?.destroy?.();} catch(_) {}
const DEFAULTS={brakeY:315,boostY:315,brakeOffset:0,boostOffset:0,predictionMs:0,scanX:320,scanTop:80,scanBottom:420,tolerance:8,minBandPixels:4,colorTolerance:48,matchDistance:65,boostZones:0};
const COLORS={brakeOn:[255,205,98],brakeOff:[122,235,198],boostOn:[255,89,107],boostOff:[255,157,155]};
const LABELS={brakeOn:'브레이크 ON',brakeOff:'브레이크 OFF',boostOn:'BOOST ON',boostOff:'BOOST OFF'};
const ENGINE={frameFactor:.35,maxAdaptiveMs:8,maxPredictionPx:5,maxFrameMs:80,maxSpeed:1.5,feedbackWindowMs:1200,maxHistory:400,highSpeedStart:.15,highSpeedFull:.23,maxHighSpeedAdvancePx:1.25,frameLookaheadFactor:.30,accelerationMinSamples:4,accelerationMaxAbs:.006,accelerationStableThreshold:.002,accelerationSmoothing:.25,accelerationMaxPx:.45,repeatRequired:2,correctionStep:.5,maxCorrection:3};
const SETTINGS_PREFIX='dopamine-auto-v32:',POSITION_KEY='dopamine-auto:position-v328',LEARNING_PREFIX='dopamine-auto-v335:learning:',PROFILE_KEY='dopamine-auto-v335:profile';
const ANALYSIS_KEY='dopamine-auto-v336:runs', MAX_RUNS=120, MAX_SAMPLES=4000;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), round=(v,n=3)=>Number((Number(v)||0).toFixed(n)), nowMs=()=>performance.now();
let raceStartedAtMs=null,raceFinishedAtMs=null;
let cfg={...DEFAULTS},courseId='default',courseName='기본 코스',profile='',running=false,started=false,armed=false,destroyed=false,brakeHeld=false,boostHeld=false,boostExpected='boostOn',boostOnCount=0,boostOffCount=0,eventSequence=0,nextTrackId=1,tracks=[],lastFrameTime=0,averageFrameMs=16.67,raf=null,startTimer=null,feedbackObserver=null,feedbackElement=null,lastFeedbackText='',feedbackEmpty=true,lastMessage='대기 중',lastDetected='-',lastFeedback='-',runId='',profileAtStart=null,analysisLastTime=0,analysisLastSpeed=null,analysisLastSpeedTime=0,analysisMaxSpeed=null,analysisSamples=[],analysisAccel=[],analysisEvents=[],profileStatus='미확인';
const history=[],feedbackLog=[],segmentResults=[],correction={},evidence={};
const stats={perfect:0,great:0,good:0,miss:0,unmatched:0,adjusted:0,segmentResults:0};
const universalStats={highSpeedEvents:0,highSpeedPredictionUsed:0,accelerationUsed:0,accelerationRejected:0,accelerationSamples:0,fallbackCount:0,maximumSpeed:0,maximumAdvancePx:0,totalAdvancePx:0};
function game(){try{return document.querySelector('iframe[title="타임어택"]')?.contentDocument||null;}catch(_){return null;}}
function root(){return game()?.querySelector('#pedallap')||null;}
function send(selector,down){const doc=game(),el=doc?.querySelector(selector);if(!el)return false;try{const w=doc.defaultView;el.dispatchEvent(new w.PointerEvent(down?'pointerdown':'pointerup',{bubbles:true,cancelable:true,pointerId:1,pointerType:'touch',isPrimary:true,button:0,buttons:down?1:0}));return true;}catch(_){return false;}}
function brake(down){if(brakeHeld===down)return true;if(!send('.cursor-interaction',down))return false;brakeHeld=down;return true;}
function boost(down){if(boostHeld===down)return true;if(!send('.boost-key',down))return false;boostHeld=down;if(down)boostOnCount++;else boostOffCount++;return true;}
function settingsKey(){return SETTINGS_PREFIX+courseId;}
function learningKey(){return profile?LEARNING_PREFIX+encodeURIComponent(courseId)+':'+encodeURIComponent(profile):null;}
function clearObject(o){for(const k of Object.keys(o))delete o[k];}
function loadSettings(){cfg={...DEFAULTS};try{const s=JSON.parse(localStorage.getItem(settingsKey())||'null');if(s)for(const k of Object.keys(DEFAULTS))if(Number.isFinite(s[k]))cfg[k]=s[k];}catch(_){}updateInputs();}
function saveSettings(){try{localStorage.setItem(settingsKey(),JSON.stringify(cfg));setMessage('설정 저장 완료');}catch(_){setMessage('설정 저장 실패');}}
function loadProfile(){try{profile=(localStorage.getItem(PROFILE_KEY)||'').trim();}catch(_){profile='';}}
function setProfile(v){profile=String(v||'').trim().slice(0,80);try{localStorage.setItem(PROFILE_KEY,profile);}catch(_){}loadLearning();render();}
function loadLearning(){clearObject(correction);clearObject(evidence);const key=learningKey();if(!key)return;try{const s=JSON.parse(localStorage.getItem(key)||'null');for(const [k,v] of Object.entries(s?.correction||{}))if(/^(brakeOn|brakeOff|boostOn|boostOff):\d+$/.test(k)&&Number.isFinite(v))correction[k]=clamp(v,-ENGINE.maxCorrection,ENGINE.maxCorrection);for(const [k,v] of Object.entries(s?.evidence||{}))if(/^(brakeOn|brakeOff|boostOn|boostOff):\d+$/.test(k)&&v&&typeof v==='object')evidence[k]={direction:v.direction||null,count:Number(v.count)||0,lastRun:v.lastRun||null};}catch(_){}}
function saveLearning(){const key=learningKey();if(!key)return;try{localStorage.setItem(key,JSON.stringify({version:VERSION,profile,courseId,correction,evidence}));}catch(_){}}
function detectCourse(){const doc=game();if(!doc)return;const source=[...doc.querySelectorAll('script')].map(s=>s.textContent||'').join('\n');const id=source.match(/"id"\s*:\s*"([^"]+)"/)?.[1]||'unknown-course',name=source.match(/"name"\s*:\s*"([^"]+)"/)?.[1]||'알 수 없는 코스';if(id!==courseId){courseId=id;courseName=name;loadSettings();loadLearning();}else courseName=name;render();}
// DOM 탐색: 화면 텍스트만 사용. 게임 내부 객체·비공개 상태를 추측하거나 조작하지 않음.
function visible(el){if(!el||!el.isConnected)return false;const w=el.ownerDocument.defaultView;const s=w?.getComputedStyle(el);return s&&s.display!=='none'&&s.visibility!=='hidden'&&el.getClientRects().length>0;}
function textOf(el){return String(el?.innerText||el?.textContent||'').replace(/\s+/g,' ').trim();}
function candidateDocs(){return [game(),document].filter(Boolean);}
function detectVehicle(){
  const found={name:null,grade:null,stars:null,displayTopSpeedKmh:null,tire:null,source:null,confidence:'unknown',raw:null};
  for(const doc of candidateDocs()){
    const els=[...doc.querySelectorAll('button,[role="option"],[role="combobox"],select,option,[aria-selected],.selected,.active,[class*="vehicle"],[class*="car"],[class*="tire"]')].filter(visible).slice(0,800);
    const selected=els.filter(el=>el.matches('[aria-selected="true"],[aria-pressed="true"],option:checked,.selected,.active,[data-selected="true"]'));
    const sources=[...selected,...els.filter(el=>/\b(?:R|S|SR|SSR)\b|최고속|km\/h|★|☆/.test(textOf(el)))];
    for(const el of sources){
      const t=textOf(el).slice(0,250);if(!t)continue;
      const speed=t.match(/(?:최고\s*속(?:도|력)?\s*[:：]?\s*)?(\d{3})\s*km\s*\/\s*h/i);
      const grade=t.match(/(?:^|\s|\[)(SSR|SR|S|R)(?=\s|\]|$)/);
      const starIcons=el.querySelectorAll('[aria-label*="별"],[class*="star"],svg[data-lucide="star"]');
      const starRun=t.match(/★{1,5}/)?.[0];
      const starNum=t.match(/(?:★\s*[x×]?\s*|별\s*)([1-5])(?:\s*개|\s*성)?/);
      const stars=Number(starNum?.[1])||(starRun?.length||null)||(starIcons.length>=1&&starIcons.length<=5?starIcons.length:null);
      const name=t.match(/(?:대우|현대|제네시스|볼보|기아|르노|쉐보레|BMW|벤츠|아우디|포르쉐|테슬라|쌍용|KG모빌리티)\s*[가-힣A-Za-z0-9 -]{1,28}/)?.[0]?.replace(/\s*★.*$/,'').trim()||null;
      const score=Number(Boolean(name))+Number(Boolean(grade))+Number(Boolean(stars))+Number(Boolean(speed));
      const prev=Number(Boolean(found.name))+Number(Boolean(found.grade))+Number(Boolean(found.stars))+Number(Boolean(found.displayTopSpeedKmh));
      if(score>prev){found.name=name;found.grade=grade?.[1]||null;found.stars=stars||null;found.displayTopSpeedKmh=speed?Number(speed[1]):null;found.source='visible-dom';found.raw=t;}
    }
    const tireEls=els.filter(el=>/^(하드|미디엄|미디움|소프트|HARD|MEDIUM|SOFT|H|M|S)(?:\s|$)/i.test(textOf(el)));
    const active=tireEls.filter(el=>el.matches('[aria-selected="true"],[aria-pressed="true"],.selected,.active,[data-selected="true"]')||el.getAttribute('data-state')==='active');
    if(active.length===1){const t=textOf(active[0]);found.tire=/하드|HARD|^H(?:\s|$)/i.test(t)?'hard':/미디엄|미디움|MEDIUM|^M(?:\s|$)/i.test(t)?'medium':/소프트|SOFT|^S(?:\s|$)/i.test(t)?'soft':null;}
  }
  found.confidence=found.name&&found.grade&&found.stars&&found.tire?'verified-dom':'partial';
  // 선택 상태를 확증하지 못하면 타이어를 임의 지정하지 않는다.
  return found;
}
// v3.3.9: 연속 주행 오케스트레이터. 기존 predict()/입력 타이밍은 변경하지 않는다.
const tireNames={hard:/하드|\bHARD\b/i,medium:/미디엄|미디움|\bMEDIUM\b/i,soft:/소프트|\bSOFT\b/i};
let chainEnabled=false,chainState='대기',chainTimer=null,chainDeadline=0,chainNextAt=0,chainRuns=0,chainPendingReturn=false,chainTire=null,chainCounts=null;
function chainSay(m){chainState=m;setMessage('연속 주행: '+m);}
function gameButtons(){const doc=game();return doc?[...doc.querySelectorAll('button,[role="button"]')].filter(visible):[];}
function readTireCounts(){
  const buttons=gameButtons(),out={};
  for(const [key,re] of Object.entries(tireNames)){
    const found=buttons.map(el=>({el,text:textOf(el)})).filter(x=>re.test(x.text)&&/\d\s*(?:개|회|\/\s*5)/.test(x.text));
    const exact=found.filter(x=>x.text.length<85);
    if(exact.length!==1)return null;
    const t=exact[0].text;
    const m=t.match(/(?:하드|미디엄|미디움|소프트|HARD|MEDIUM|SOFT)[\s\S]{0,35}?(\d)\s*(?:개|회|\/\s*5)/i)||t.match(/(?:^|\s)(\d)\s*(?:개|회)(?:\s|$)/);
    if(!m)return null;
    const n=Number(m[1]);if(!Number.isInteger(n)||n<0||n>99)return null;
    out[key]={count:n,el:exact[0].el};
  }
  if(new Set(Object.values(out).map(x=>x.el)).size!==3)return null;
  return out;
}
function findReturnButton(){return gameButtons().find(el=>/출발선으로/.test(textOf(el))&&!el.disabled&&el.getAttribute('aria-disabled')!=='true')||null;}
function clickGameButton(el){if(!el||!el.isConnected||el.disabled||el.getAttribute('aria-disabled')==='true')return false;try{el.click();return true;}catch(_){return false;}}
function stopChain(message='연속 주행 중지',stopDrive=true){chainEnabled=false;chainPendingReturn=false;chainTire=null;chainDeadline=0;chainNextAt=0;if(chainTimer!==null){clearInterval(chainTimer);chainTimer=null;}if(stopDrive&&running)stop(false,'stopped');chainSay(message);}
function chainTick(){
  if(!chainEnabled||destroyed)return;
  const t=Date.now();if(t<chainNextAt)return;
  if(running){chainDeadline=0;return;}
  const doc=game(),r=root();if(!doc||!r){stopChain('타임어택 화면을 찾지 못해 중지',false);return;}
  const phase=String(r.dataset.phase||'').toLowerCase();
  const ret=findReturnButton();
  if(ret){
    if(chainPendingReturn&&chainDeadline&&t>chainDeadline){stopChain('출발선 복귀 시간 초과',false);return;}
    if(!chainPendingReturn){chainPendingReturn=true;chainDeadline=t+12000;}
    if(!clickGameButton(ret)){stopChain('출발선으로 버튼 클릭 실패',false);return;}
    chainSay('출발선 복귀 중');chainNextAt=t+1200;return;
  }
  if(phase!=='ready'){
    if(!chainDeadline)chainDeadline=t+18000;
    if(t>chainDeadline)stopChain('준비 화면 전환 시간 초과 (자동 중지)',false);
    return;
  }
  chainPendingReturn=false;chainDeadline=0;
  const counts=readTireCounts();
  if(!counts){stopChain('타이어 잔여 수량을 정확히 인식하지 못함 (자동 중지)',false);return;}
  chainCounts={hard:counts.hard.count,medium:counts.medium.count,soft:counts.soft.count};
  const remaining=Object.values(chainCounts).reduce((a,b)=>a+b,0);
  if(!remaining){stopChain('모든 타이어 소진 · 총 '+chainRuns+'판 자동 완료',false);return;}
  // 현재 선택된 타이어를 우선 사용하여 불필요한 전환을 피한다. 선택 확인 실패 시 보수적으로 중지.
  const selected=detectVehicle().tire;
  const target=selected&&counts[selected]?.count>0?selected:['hard','medium','soft'].find(k=>counts[k].count>0);
  if(!target){stopChain('사용 가능한 타이어 없음',false);return;}
  if(chainTire===target&&selected!==target){stopChain('타이어 선택 상태 확인 실패',false);return;}
  if(selected!==target){
    if(!clickGameButton(counts[target].el)){stopChain('타이어 선택 실패',false);return;}
    chainTire=target;chainSay('타이어 변경 확인 중: '+target);chainNextAt=t+700;
    // 다음 tick에서 실제 선택 상태를 다시 확인한 후 시작한다.
    return;
  }
  chainTire=target;
  chainSay('타이어 '+target+' · 남은 '+remaining+'판 · 브레이크 준비');
  start();
  if(!running){stopChain('브레이크 준비 시작 실패',false);return;}
  chainRuns++;chainNextAt=t+800;
}
function startChain(){
  if(chainEnabled||running){setMessage('이미 주행 중입니다. 중지 후 연속 시작하세요');return;}
  if(!game()||!root()){setMessage('타임어택 화면을 찾지 못했습니다');return;}
  chainEnabled=true;chainRuns=0;chainDeadline=0;chainNextAt=0;chainPendingReturn=false;
  chainTimer=setInterval(chainTick,350);chainSay('화면 확인 및 자동 준비 중');chainTick();collapsePanel();
}
let detected={};
let savedRunCount=readSavedRuns().length;
let runFinalized=false,finishSeenAt=0,finishReason=null,telemetryRejects=0;
function refreshVehicle(){if(running)return;detected=detectVehicle();profileStatus=detected.confidence;render();}
function refreshLobbyInfo(){
  if(destroyed||running)return;
  const doc=game(),r=root();
  if(!doc||!r){if(chainCounts!==null){chainCounts=null;render();}return;}
  const counts=readTireCounts();
  const next=counts?{hard:counts.hard.count,medium:counts.medium.count,soft:counts.soft.count}:null;
  const changed=JSON.stringify(next)!==JSON.stringify(chainCounts);
  if(changed)chainCounts=next;
  const vehicle=detectVehicle();
  const vehicleChanged=JSON.stringify(vehicle)!==JSON.stringify(detected);
  if(vehicleChanged){detected=vehicle;profileStatus=vehicle.confidence;}
  if(changed||vehicleChanged)render();
}

function vehicleKey(v){return [v?.name||'unknown',v?.grade||'unknown',v?.stars||'unknown',v?.tire||'unknown',courseId].join('|');}
// 게임 화면에서 확인되는 속도계만 사용. 정적인 최고속력 설명 문구는 제외.
function readLiveSpeed(){const doc=game();if(!doc)return null;const nodes=[...doc.querySelectorAll('[aria-label],[data-speed],[class*="speed"],[id*="speed"]')].slice(0,120);for(const el of nodes){if(!visible(el))continue;const attr=el.getAttribute('data-speed');const label=el.getAttribute('aria-label')||'';const txt=textOf(el);if(/최고속|최대속|top.?speed/i.test(label+' '+txt))continue;const m=(attr||label||txt).match(/(?:현재\s*속도|속도|speed)?\s*[:：]?\s*(\d{1,3}(?:\.\d+)?)\s*km\s*\/\s*h/i);if(m)return Number(m[1]);}return null;}
function recordTelemetry(now){
  if(!started||now-analysisLastTime<90)return;
  analysisLastTime=now;
  const kmh=readLiveSpeed();
  if(kmh===null||!Number.isFinite(kmh)||kmh<0||kmh>450)return;
  analysisMaxSpeed=Math.max(analysisMaxSpeed||0,kmh);
  if(analysisLastSpeed!==null){
    const dt=(now-analysisLastSpeedTime)/1000;
    if(dt>=.08&&dt<=1.5){
      const delta=kmh-analysisLastSpeed, a=delta/dt;
      // 구간 종료 후 HUD가 결과 속도로 순간 전환되는 샘플과 가속도 이상치는 배제.
      // 실측 가속도는 별도 관찰 자료이며 주행 입력 예측에 사용하지 않는다.
      if(Math.abs(delta)<=18&&a>=-180&&a<=90){
        analysisAccel.push({t:round(now,1),kmh:round(kmh,2),accelKmhPerSec:round(a,3)});
        if(analysisAccel.length>MAX_SAMPLES)analysisAccel.shift();
      }else telemetryRejects++;
    }
  }
  analysisLastSpeed=kmh;analysisLastSpeedTime=now;
  analysisSamples.push({t:round(now,1),kmh});
  if(analysisSamples.length>MAX_SAMPLES)analysisSamples.shift();
}
function readSavedRuns(){try{const a=JSON.parse(localStorage.getItem(ANALYSIS_KEY)||'[]');return Array.isArray(a)?a:[];}catch(_){return [];}}
function saveRun(reason){
  if(!runId||!history.length||runFinalized)return;
  const runs=readSavedRuns();
  if(runs.some(r=>r.runId===runId)){runFinalized=true;return;}
  const grades=history.reduce((a,r)=>(r.feedbackGrade&&(a[r.feedbackGrade]=(a[r.feedbackGrade]||0)+1),a),{});
  const allEvents=history.length>0&&history.every(x=>x.feedbackGrade!==null);
  const allSegments=segmentResults.length>0;
  // 이벤트·구간 수는 코스마다 달라진다. 입력 완료만으로 완주를 추정하지 않는다.
  const phase=String(root()?.dataset.phase||'').toLowerCase();
  const explicitFinish=/^(finished|finish|complete|completed|result|results|ended|end|done)$/.test(phase);
  const complete=reason==='complete'||explicitFinish;
  // Start: actual start-light release. Finish: first observed result phase, not delayed save time.
  const observedRaceDurationMs=complete&&Number.isFinite(raceStartedAtMs)&&Number.isFinite(raceFinishedAtMs)&&raceFinishedAtMs>=raceStartedAtMs?Math.round(raceFinishedAtMs-raceStartedAtMs):null;
  const accel=analysisAccel.map(x=>x.accelKmhPerSec).filter(Number.isFinite).sort((a,b)=>a-b);
  const positive=accel.filter(x=>x>0);
  const median=a=>a.length?a[Math.floor(a.length/2)]:null;
  const result={runId,version:VERSION,courseId,courseName,vehicle:profileAtStart,vehicleKey:vehicleKey(profileAtStart),manualProfile:profile||null,
    reason,complete,observedRaceDurationMs,observedRaceDurationSec:observedRaceDurationMs===null?null:round(observedRaceDurationMs/1000,3),raceDurationSource:observedRaceDurationMs===null?null:'client-start-light-to-first-finish-phase',completionEvidence:{allEvents,allSegments,phase:root()?.dataset.phase||null},time:new Date().toISOString(),
    events:history.length,grades,displayTopSpeedKmh:profileAtStart?.displayTopSpeedKmh??null,
    measuredMaxSpeedKmh:analysisMaxSpeed,meanAccelerationKmhPerSec:accel.length?round(accel.reduce((s,x)=>s+x,0)/accel.length,4):null,
    medianPositiveAccelerationKmhPerSec:median(positive),maxAccelerationKmhPerSec:accel.length?accel[accel.length-1]:null,
    rejectedAccelerationSamples:telemetryRejects,maxMarkerSpeedPxMs:universalStats.maximumSpeed,
    segmentSpeedsKmh:segmentResults.map(s=>s.speedKmh).filter(x=>x!==null),
    history:history.map(x=>({...x})),feedbackLog:feedbackLog.map(x=>({...x})),segmentResults:segmentResults.map(x=>({...x})),
    speedSamples:analysisSamples.slice(),accelerationSamples:analysisAccel.slice()};
  runs.push(result);
  try{localStorage.setItem(ANALYSIS_KEY,JSON.stringify(runs.slice(-MAX_RUNS)));runFinalized=true;savedRunCount=Math.min(runs.length,MAX_RUNS);}
  catch(_){setMessage('분석 저장 공간 부족: 분석 기록을 복사하여 백업하세요');}
}
function classify(r,g,b){if(Math.max(r,g,b)<95)return null;let bestType=null,bestDistance=Infinity;for(const [type,c] of Object.entries(COLORS)){const d=Math.hypot(r-c[0],g-c[1],b-c[2]);if(d<bestDistance){bestDistance=d;bestType=type;}}return bestDistance<=cfg.colorTolerance?bestType:null;}
function scanBands(){const canvas=game()?.querySelector('canvas[aria-label="타임어택 주행 트랙"]');if(!canvas)return [];const x=Math.round(cfg.scanX),top=clamp(Math.floor(cfg.scanTop),0,canvas.height),bottom=clamp(Math.ceil(cfg.scanBottom),0,canvas.height);if(x<0||x>=canvas.width||bottom<=top)return [];let pixels;try{pixels=canvas.getContext('2d').getImageData(x,top,1,bottom-top).data;}catch(_){return [];}const bands=[];let current=null;function finish(){if(current&&current.count>=cfg.minBandPixels)bands.push({type:current.type,y:(current.start+current.end)/2});}for(let i=0;i<bottom-top;i++){const p=i*4,y=top+i,type=classify(pixels[p],pixels[p+1],pixels[p+2]);if(type&&current&&current.type===type&&y-current.end<=2){current.end=y;current.count++;}else{finish();current=type?{type,start:y,end:y,count:1}:null;}}finish();return bands;}
function updateFrameTiming(now){if(lastFrameTime){const dt=now-lastFrameTime;if(dt>0&&dt<=ENGINE.maxFrameMs)averageFrameMs=averageFrameMs*.85+dt*.15;}lastFrameTime=now;}
function updateAcceleration(track,speed,dt){if(dt<4||dt>60||!Number.isFinite(speed))return;const previous=track.previousInstantSpeed;track.previousInstantSpeed=speed;if(!Number.isFinite(previous))return;const raw=(speed-previous)/dt;if(!Number.isFinite(raw)||Math.abs(raw)>ENGINE.accelerationMaxAbs){track.accelerationStable=false;universalStats.accelerationRejected++;return;}track.acceleration=track.acceleration*(1-ENGINE.accelerationSmoothing)+raw*ENGINE.accelerationSmoothing;track.accelerationSamples++;universalStats.accelerationSamples++;track.accelerationStable=Math.abs(raw-track.acceleration)<=ENGINE.accelerationStableThreshold;}
// v3.3.5 predict(): 숫자·조건·보정식 그대로 유지.
function predict(track){const speed=Math.max(0,track.speed);const adaptiveMs=clamp(averageFrameMs*ENGINE.frameFactor,0,ENGINE.maxAdaptiveMs);const leadMs=Math.max(0,adaptiveMs+cfg.predictionMs);const basePredictionPx=clamp(speed*leadMs,0,ENGINE.maxPredictionPx);const speedRatio=clamp((speed-ENGINE.highSpeedStart)/(ENGINE.highSpeedFull-ENGINE.highSpeedStart),0,1);const frameAdvancePx=clamp(speed*averageFrameMs*ENGINE.frameLookaheadFactor*speedRatio,0,ENGINE.maxHighSpeedAdvancePx);let accelerationPx=0,accelerationUsed=false;if(track.accelerationSamples>=ENGINE.accelerationMinSamples&&track.accelerationStable&&speedRatio>0){const extra=.5*track.acceleration*leadMs*leadMs;accelerationPx=clamp(extra*speedRatio,-ENGINE.accelerationMaxPx,ENGINE.accelerationMaxPx);accelerationUsed=Math.abs(accelerationPx)>=.02;}const highSpeedAdvancePx=frameAdvancePx;const predictionPx=clamp(basePredictionPx+highSpeedAdvancePx+accelerationPx,0,ENGINE.maxPredictionPx+ENGINE.maxHighSpeedAdvancePx+ENGINE.accelerationMaxPx);const highSpeedUsed=highSpeedAdvancePx>.01;return {speed,leadMs,basePredictionPx,frameAdvancePx,highSpeedAdvancePx,accelerationPx,accelerationUsed,highSpeedUsed,predictionPx,predictionMode:highSpeedUsed?'high-speed-lookahead':'release-2.0'};}
function executeEvent(track,predictedY,prediction,eventKey,target){const type=track.type;let success=false;if(type==='brakeOn'&&!brakeHeld)success=brake(true);else if(type==='brakeOff'&&brakeHeld)success=brake(false);else if(type==='boostOn'&&boostExpected==='boostOn'&&!boostHeld&&(cfg.boostZones===0||boostOnCount<cfg.boostZones)){success=boost(true);if(success)boostExpected='boostOff';}else if(type==='boostOff'&&boostExpected==='boostOff'&&boostHeld){success=boost(false);if(success)boostExpected='boostOn';}if(!success)return false;const time=nowMs(),previous=history[history.length-1];eventSequence++;const record={sequence:eventSequence,eventKey,type,event:LABELS[type],y:round(track.y,2),predictedY:round(predictedY,3),targetY:target,triggerLineY:target-cfg.tolerance,speed:round(track.speed,5),acceleration:round(track.acceleration,7),accelerationSamples:track.accelerationSamples,accelerationStable:track.accelerationStable,predictionMode:prediction.predictionMode,basePredictionPx:round(prediction.basePredictionPx,4),frameAdvancePx:round(prediction.frameAdvancePx,4),highSpeedAdvancePx:round(prediction.highSpeedAdvancePx,4),accelerationPredictionPx:round(prediction.accelerationPx,4),accelerationUsed:prediction.accelerationUsed,highSpeedUsed:prediction.highSpeedUsed,adaptiveLeadMs:round(prediction.leadMs,3),adaptivePredictionPx:round(prediction.predictionPx,4),averageFrameMs:round(averageFrameMs,3),distanceToTriggerPx:round(target-cfg.tolerance-track.y,4),estimatedFrameTravelPx:round(track.speed*averageFrameMs,4),time:Math.round(time),previousEvent:previous?.type||null,previousGapMs:previous?Math.round(time-previous.time):null,appliedCorrection:correction[eventKey]||0,feedbackGrade:null,feedbackDirection:null,feedbackDistanceM:null,feedback:null,feedbackTime:null};history.push(record);if(history.length>ENGINE.maxHistory)history.shift();if(prediction.highSpeedUsed){universalStats.highSpeedEvents++;universalStats.highSpeedPredictionUsed++;universalStats.totalAdvancePx+=prediction.highSpeedAdvancePx;universalStats.maximumAdvancePx=Math.max(universalStats.maximumAdvancePx,prediction.highSpeedAdvancePx);}else universalStats.fallbackCount++;if(prediction.accelerationUsed)universalStats.accelerationUsed++;analysisEvents.push({time:round(time,1),sequence:eventSequence,type,markerSpeedPxMs:round(track.speed,5),markerAccelerationPxMs2:round(track.acceleration,7),liveSpeedKmh:analysisLastSpeed});setMessage(LABELS[type]+' 실행');return true;}
function updateTracks(bands,now){const used=new Set(),sorted=[...bands].sort((a,b)=>b.y-a.y);for(const band of sorted){let best=null,distance=Infinity;for(const track of tracks){if(used.has(track.id)||track.type!==band.type)continue;const delta=band.y-track.y;if(delta>=-8&&delta<cfg.matchDistance&&Math.abs(delta)<distance){best=track;distance=Math.abs(delta);}}if(!best){best={id:nextTrackId++,type:band.type,y:band.y,lastTime:now,speed:0,previousInstantSpeed:null,acceleration:0,accelerationSamples:0,accelerationStable:false,triggered:false,missing:0};tracks.push(best);}else{const dt=now-best.lastTime,dy=band.y-best.y;if(dt>0&&dt<200){const speed=dy/dt;if(speed>=-.2&&speed<ENGINE.maxSpeed){best.speed=best.speed===0?speed:best.speed*.45+speed*.55;updateAcceleration(best,speed,dt);universalStats.maximumSpeed=Math.max(universalStats.maximumSpeed,best.speed);}}best.y=band.y;best.lastTime=now;best.missing=0;}used.add(best.id);const isBoost=best.type.startsWith('boost'),target=isBoost?cfg.boostY:cfg.brakeY,offset=isBoost?cfg.boostOffset:cfg.brakeOffset,eventKey=best.type+':'+(eventSequence+1),prediction=predict(best),predictedY=best.y+prediction.predictionPx+offset+(correction[eventKey]||0);lastDetected=LABELS[best.type]+' Y='+round(best.y,1);if(!best.triggered&&predictedY>=target-cfg.tolerance){if(executeEvent(best,predictedY,prediction,eventKey,target))best.triggered=true;}}for(const track of tracks)if(!used.has(track.id))track.missing++;tracks=tracks.filter(track=>track.missing<=12);render();}
function parseFeedback(text){const raw=String(text||'').trim();if(!raw)return null;if(/^진입\s+/i.test(raw)&&/\s*\/\s*탈출\s+/i.test(raw)){const m=raw.match(/^진입\s+(PERFECT|GREAT|GOOD|MISS)(?:\s*·\s*(빠름|늦음)\s*([\d.]+)\s*m)?\s*\/\s*탈출\s+(PERFECT|GREAT|GOOD|MISS)(?:\s*·\s*(빠름|늦음)\s*([\d.]+)\s*m)?(?:\s*·\s*(\d+)\s*km\/h)?/i);return {kind:'segment',raw,entry:m?.[1]?.toLowerCase()||null,exit:m?.[4]?.toLowerCase()||null,entryDirection:m?.[2]||null,entryDistanceM:m?.[3]?Number(m[3]):null,exitDirection:m?.[5]||null,exitDistanceM:m?.[6]?Number(m[6]):null,speedKmh:m?.[7]?Number(m[7]):null};}let eventType=null;if(/브레이크\s*진입/.test(raw))eventType='brakeOn';else if(/브레이크\s*해제/.test(raw))eventType='brakeOff';else if(/부스터\s*ON|BOOST\s*ON/i.test(raw))eventType='boostOn';else if(/부스터\s*OFF|BOOST\s*OFF/i.test(raw))eventType='boostOff';if(!eventType)return null;const gr=raw.match(/PERFECT|GREAT|GOOD|MISS|퍼펙트|그레이트|굿|미스/i)?.[0]?.toLowerCase(),grades={퍼펙트:'perfect',그레이트:'great',굿:'good',미스:'miss'},grade=grades[gr]||gr;if(!grade)return null;const direction=/빠름|EARLY/i.test(raw)?'early':/늦음|LATE/i.test(raw)?'late':null,dist=raw.match(/(?:빠름|늦음|EARLY|LATE)\s*([\d.]+)\s*m/i);return {kind:'event',raw,eventType,grade,direction,distanceM:dist?Number(dist[1]):null};}
function findMatchingRecord(parsed,now){const c=history.filter(r=>r.feedbackGrade===null&&r.type===parsed.eventType&&now>=r.time&&now-r.time<=ENGINE.feedbackWindowMs);return c.length===1?c[0]:null;}
function applyLearning(record,parsed){if(!profile)return;const key=record.eventKey;if(parsed.grade==='perfect'){if(evidence[key]){delete evidence[key];saveLearning();}return;}if(parsed.grade!=='great'||!parsed.direction)return;const old=evidence[key],item=old&&old.direction===parsed.direction?old:{direction:parsed.direction,count:0,lastRun:null};if(item.lastRun===runId)return;item.count++;item.lastRun=runId;evidence[key]=item;record.learningEvidenceCount=item.count;if(item.count>=ENGINE.repeatRequired){const before=correction[key]||0,delta=parsed.direction==='late'?ENGINE.correctionStep:-ENGINE.correctionStep,after=clamp(before+delta,-ENGINE.maxCorrection,ENGINE.maxCorrection);correction[key]=after;record.correctionBefore=before;record.correctionAfter=after;item.count=0;if(after!==before)stats.adjusted++;}saveLearning();}
function processFeedback(text){const parsed=parseFeedback(text);if(!parsed)return;const now=nowMs();lastFeedback=parsed.raw;if(parsed.kind==='segment'){segmentResults.push({time:Math.round(now),...parsed});stats.segmentResults++;if(segmentResults.length>ENGINE.maxHistory)segmentResults.shift();render();return;}const record=findMatchingRecord(parsed,now);feedbackLog.push({time:Math.round(now),...parsed,matched:Boolean(record),eventSequence:record?.sequence||null});if(feedbackLog.length>ENGINE.maxHistory)feedbackLog.shift();if(!record){stats.unmatched++;render();return;}record.feedbackGrade=parsed.grade;record.feedbackDirection=parsed.direction;record.feedbackDistanceM=parsed.distanceM;record.feedback=parsed.raw;record.feedbackTime=Math.round(now);if(Object.prototype.hasOwnProperty.call(stats,parsed.grade))stats[parsed.grade]++;applyLearning(record,parsed);render();}
function connectFeedbackObserver(){const element=root()?.querySelector('.feedback');if(!element||element===feedbackElement)return;feedbackObserver?.disconnect();feedbackElement=element;lastFeedbackText='';feedbackEmpty=true;feedbackObserver=new MutationObserver(()=>{if(!running)return;const text=element.textContent?.trim()||'';if(!text){feedbackEmpty=true;return;}if(text!==lastFeedbackText||feedbackEmpty){lastFeedbackText=text;feedbackEmpty=false;processFeedback(text);}});feedbackObserver.observe(element,{childList:true,characterData:true,subtree:true});}
function drive(now){
  if(!running)return;
  updateFrameTiming(now);
  if(started){
    updateTracks(scanBands(),now);connectFeedbackObserver();recordTelemetry(now);
    const phase=String(root()?.dataset.phase||'').toLowerCase();
    const explicitFinish=/^(finished|finish|complete|completed|result|results|ended|end|done)$/.test(phase);
    if(explicitFinish){
      if(!finishSeenAt){finishSeenAt=now;raceFinishedAtMs=now;finishReason='complete';}
      // 결과 메시지가 DOM에 반영될 시간을 확보한 뒤 확정.
      if(now-finishSeenAt>=1000){stop(false,finishReason);if(chainEnabled){chainPendingReturn=true;chainDeadline=Date.now()+18000;chainNextAt=Date.now()+650;chainSay('완주 저장 · 출발선 복귀 대기');}else setMessage('주행 기록 자동 저장 완료');return;}
    }else{finishSeenAt=0;finishReason=null;}
  }
  raf=requestAnimationFrame(drive);
}
function stop(show=true,reason=null){const wasRunning=running;running=false;if(startTimer!==null){clearInterval(startTimer);startTimer=null;}if(raf!==null){cancelAnimationFrame(raf);raf=null;}brake(false);if(boostHeld){send('.boost-key',false);boostHeld=false;}feedbackObserver?.disconnect();feedbackObserver=null;feedbackElement=null;started=false;armed=false;tracks=[];if(wasRunning&&history.length)saveRun(reason||'stopped');if(show)setMessage('자동 플레이 중지');}
function start(){stop(false);detectCourse();const doc=game();if(!doc){setMessage('타임어택 화면 없음');return;}if(root()?.dataset.phase!=='ready'){setMessage('게임 재시작 후 실행하세요');return;}refreshVehicle();profileAtStart=structuredCloneSafe(detected);running=true;started=false;armed=false;runId=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9);tracks=[];nextTrackId=1;eventSequence=0;lastFrameTime=0;averageFrameMs=16.67;boostOnCount=0;boostOffCount=0;boostExpected='boostOn';history.length=0;feedbackLog.length=0;segmentResults.length=0;analysisSamples=[];analysisAccel=[];analysisEvents=[];analysisLastTime=0;analysisLastSpeed=null;analysisLastSpeedTime=0;analysisMaxSpeed=null;runFinalized=false;finishSeenAt=0;finishReason=null;raceStartedAtMs=null;raceFinishedAtMs=null;telemetryRejects=0;for(const k of Object.keys(stats))stats[k]=0;for(const k of Object.keys(universalStats))universalStats[k]=0;lastFeedback='-';lastDetected='-';lastFeedbackText='';feedbackEmpty=true;connectFeedbackObserver();brake(true);setMessage('출발 신호 대기 중');const lights=[...doc.querySelectorAll('.lights i')];startTimer=setInterval(()=>{if(!running)return;const active=lights.filter(el=>{const rgb=doc.defaultView.getComputedStyle(el).backgroundColor.match(/\d+/g)?.map(Number);return rgb&&rgb[0]>110&&rgb[0]>rgb[1]*1.35&&rgb[0]>rgb[2]*1.35;}).length;if(active===5)armed=true;if(armed&&active===0){clearInterval(startTimer);startTimer=null;brake(false);raceStartedAtMs=performance.now();started=true;setMessage('자동 출발 성공');}},10);raf=requestAnimationFrame(drive);/* Keep panel state independent from driving. */}
function structuredCloneSafe(o){return JSON.parse(JSON.stringify(o||{}));}
const ui=document.createElement('div');ui.id='dopamine-auto-v336-ui';ui.style.cssText='position:fixed;left:0;top:0;width:0;height:0;z-index:2147483647;font:12px system-ui,sans-serif;color:white;pointer-events:none';
ui.innerHTML=`<style>#dopamine-auto-v336-ui *{box-sizing:border-box}#dopamine-auto-v336-ui button{color:white;border:0;font-weight:700;cursor:pointer;font-family:inherit}#dopamine-auto-v336-ui .panel{display:none;position:fixed;width:248px;max-width:calc(100vw - 16px);background:#142034;border:1px solid #64748b;border-radius:12px 12px 0 12px;box-shadow:0 5px 25px #000a;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;touch-action:pan-y;pointer-events:auto;padding:10px}#dopamine-auto-v336-ui .mini{position:fixed;width:94px;height:42px;display:flex;align-items:center;justify-content:center;background:#17283d;border:1px solid #64748b;border-radius:24px;box-shadow:0 3px 15px #0008;user-select:none;touch-action:none;pointer-events:auto;padding:0;white-space:nowrap}#dopamine-auto-v336-ui .head-title{font-size:12px;font-weight:800;margin-bottom:6px}#dopamine-auto-v336-ui .course{color:#93c5fd;font-size:10px;margin:5px 0;overflow-wrap:anywhere;white-space:pre-wrap}#dopamine-auto-v336-ui .actions{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:8px 0}#dopamine-auto-v336-ui .actions button{padding:9px 5px;border-radius:6px}#dopamine-auto-v336-ui .start{background:#15803d}#dopamine-auto-v336-ui .stop{background:#b91c1c}#dopamine-auto-v336-ui .stats{font-size:10px;line-height:1.5;color:#dbeafe;white-space:pre-wrap;overflow-wrap:anywhere}#dopamine-auto-v336-ui details{margin-top:7px;border-top:1px solid #475569;padding-top:7px}#dopamine-auto-v336-ui summary{color:#93c5fd;font-weight:700;cursor:pointer;padding:4px 0}#dopamine-auto-v336-ui label{display:block;margin:7px 0 3px;color:#cbd5e1;font-size:10px}#dopamine-auto-v336-ui input{display:block;width:100%;padding:7px;background:#1e293b;color:white;border:1px solid #64748b;border-radius:5px;font-size:12px}#dopamine-auto-v336-ui .subbutton{width:100%;margin-top:7px;padding:9px;border-radius:6px;background:#2563eb}#dopamine-auto-v336-ui .reset{background:#475569}#dopamine-auto-v336-ui .hint{font-size:10px;color:#fcd34d;line-height:1.4;margin:5px 0}#dopamine-auto-v336-ui .auto-head{display:flex;justify-content:space-between;align-items:center;gap:5px;margin-bottom:10px;font-size:12px}#dopamine-auto-v336-ui .auto-head button{background:#334155;border-radius:7px;padding:6px 10px;font-size:17px}#dopamine-auto-v336-ui .auto-line{display:flex;align-items:center;justify-content:space-between;gap:6px;margin:8px 0;font-size:11px}#dopamine-auto-v336-ui .auto-line>span:first-child{color:#94a3b8}#dopamine-auto-v336-ui #manage-area{margin-top:10px;border-top:1px solid #475569;padding-top:8px}#dopamine-auto-v336-ui #cloud-config-slot button{position:static!important;width:100%;margin-top:7px;padding:9px;background:#164e63;border:1px solid #67e8f9;border-radius:6px}#dopamine-auto-v336-ui .panel{width:248px}#dopamine-auto-v336-ui .tabs{display:flex;gap:5px;margin:5px 0 10px}#dopamine-auto-v336-ui .tabs button{flex:1;background:#334155;border-radius:7px;padding:9px 3px;font-size:11px}#dopamine-auto-v336-ui .tabs button.active{background:#2563eb}#dopamine-auto-v336-ui .analysis-box{font-size:11px;line-height:1.65;white-space:pre-wrap;overflow-wrap:anywhere;color:#dbeafe}</style><div class="panel" id="auto-panel"><div class="auto-head"><strong>🚗 DOPAMINE AUTO <span style="font-size:10px;color:#94a3b8">v${VERSION}</span></strong><button id="manage-btn" aria-label="관리 메뉴 열기" title="관리 메뉴">⚙</button></div><div class="tabs"><button id="tab-auto" class="active">🏎️ AUTO</button><button id="tab-analysis">📊 차량 분석</button></div><div id="auto-tab"><div class="auto-line"><span>상태</span><strong id="simple-state">대기 중</strong></div><div class="auto-line"><span>잔여 타이어</span><strong id="simple-tires">확인 전</strong></div><div class="actions"><button class="start" id="start-btn">▶ 1판 시작</button><button class="stop" id="stop-btn">■ 중지</button></div><button class="subbutton" id="chain-btn" style="background:#0f766e">🔁 잔여 타이어 모두 주행</button><div class="auto-line" style="margin-top:8px"><span>☁ Google Sheets</span><span id="cloud-state">로더에서 확인</span></div><div id="manage-area" style="display:none"><div class="course" id="course-name">코스 분석 대기</div><div class="stats" id="chain-status"></div><div class="stats" id="status">대기 중</div><div class="stats" id="vehicle-info"></div><p class="hint">자동 인식은 화면 DOM 확인이 필요합니다.</p><button class="subbutton" id="detect-btn">🔍 차량·타이어 다시 읽기</button><button class="subbutton" id="analysis-copy">📊 누적 분석 JSON 복사</button><button class="subbutton" id="analysis-download">💾 누적 분석 JSON 저장</button><button class="subbutton" id="copy-btn">📋 현재 입력 기록 복사</button><div id="cloud-config-slot"></div><details id="settings-details"><summary>⚙ 고급 설정</summary><label>기존 수동 프로필 (학습 보정 키)</label><input id="vehicleProfile" type="text" placeholder="비우면 기존 학습 보정 비활성"><label>브레이크 판정선 Y</label><input id="brakeY" type="number"><label>부스터 판정선 Y</label><input id="boostY" type="number"><label>브레이크 보정 px</label><input id="brakeOffset" type="number"><label>부스터 보정 px</label><input id="boostOffset" type="number"><label>예측 시간 ms</label><input id="predictionMs" type="number"><label>부스터 구간 수 (0=자동)</label><input id="boostZones" type="number"><label>색상 허용 오차</label><input id="colorTolerance" type="number"><label>판정 허용 오차 px</label><input id="tolerance" type="number"><button class="subbutton" id="save-btn">설정 저장</button><button class="subbutton reset" id="reset-btn">기본 설정 복원</button></details></div></div><div id="analysis-tab" style="display:none"><div class="analysis-box" id="analysis-summary">기록 분석 대기</div><button class="subbutton" id="analysis-refresh">🔄 분석 새로고침</button><button class="subbutton" id="analysis-copy2">📋 누적 기록 복사</button></div></div><button class="mini" id="auto-mini">🚗 AUTO</button>`;
document.body.appendChild(ui);const $=s=>ui.querySelector(s),mini=$('#auto-mini'),panel=$('#auto-panel'),details=$('#settings-details'),PANEL_W=248,BUTTON_W=94,BUTTON_H=42,MARGIN=8;let expanded=false,buttonX=0,buttonY=0,drag=null,suppressClick=false;
function viewport(){return {width:document.documentElement.clientWidth||window.innerWidth,height:document.documentElement.clientHeight||window.innerHeight};}
function panelWidth(){return Math.max(1,Math.min(PANEL_W,viewport().width-MARGIN*2));}
function panelHeightLimit(){return Math.max(0,viewport().height-BUTTON_H-MARGIN*2);}
function measuredPanelHeight(){if(!expanded)return 0;panel.style.display='block';panel.style.width=panelWidth()+'px';panel.style.maxHeight=panelHeightLimit()+'px';return panel.getBoundingClientRect().height;}
function bounds(){const vp=viewport();return {minX:MARGIN,maxX:Math.max(MARGIN,vp.width-BUTTON_W-MARGIN),minY:MARGIN,maxY:Math.max(MARGIN,vp.height-BUTTON_H-2)};}
function placeUI(){const b=bounds();if(expanded){const w=panelWidth(),h=measuredPanelHeight();buttonX=clamp(buttonX,Math.max(b.minX,w-BUTTON_W+MARGIN),b.maxX);buttonY=clamp(buttonY,Math.max(b.minY,h+MARGIN),b.maxY);panel.style.left=(buttonX+BUTTON_W-w)+'px';panel.style.top=(buttonY-h)+'px';panel.style.right='auto';panel.style.bottom='auto';}else{buttonX=clamp(buttonX,b.minX,b.maxX);buttonY=clamp(buttonY,b.minY,b.maxY);}mini.style.left=buttonX+'px';mini.style.top=buttonY+'px';}
function expandPanel(){expanded=true;panel.style.display='block';placeUI();render();}
function collapsePanel(){expanded=false;panel.style.display='none';placeUI();render();}
function savePosition(){try{localStorage.setItem(POSITION_KEY,JSON.stringify({x:buttonX,y:buttonY}));}catch(_){}}
function restorePosition(){const vp=viewport();buttonX=vp.width-BUTTON_W-12;buttonY=vp.height-BUTTON_H-18;try{const s=JSON.parse(localStorage.getItem(POSITION_KEY)||'null');if(Number.isFinite(s?.x)&&Number.isFinite(s?.y)){buttonX=s.x;buttonY=s.y;}}catch(_){}placeUI();}
// UI interactions are isolated from page-level game handlers. Never stop/restart the driving engine on panel toggle.
for(const type of ['pointerdown','pointerup','pointermove','pointercancel','mousedown','mouseup','click','dblclick','touchstart','touchmove','touchend','touchcancel']){ui.addEventListener(type,e=>{e.stopPropagation();},{passive:true});}
// Dragging the panel header moves the same anchor as the floating AUTO button.
const panelHandle=$('.auto-head');
panelHandle.style.touchAction='none';
panelHandle.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;drag={id:e.pointerId,startX:e.clientX,startY:e.clientY,originX:buttonX,originY:buttonY,moved:false,panel:true};try{panelHandle.setPointerCapture(e.pointerId);}catch(_){}});
panelHandle.addEventListener('pointermove',e=>{if(!drag||!drag.panel||drag.id!==e.pointerId)return;const dx=e.clientX-drag.startX,dy=e.clientY-drag.startY;if(Math.abs(dx)+Math.abs(dy)>7)drag.moved=true;if(!drag.moved)return;buttonX=drag.originX+dx;buttonY=drag.originY+dy;placeUI();drag.originX=buttonX;drag.originY=buttonY;drag.startX=e.clientX;drag.startY=e.clientY;drag.originX=buttonX;drag.originY=buttonY;drag.startX=e.clientX;drag.startY=e.clientY;});
panelHandle.addEventListener('pointerup',e=>{if(!drag||!drag.panel||drag.id!==e.pointerId)return;if(drag.moved)savePosition();drag=null;});
panelHandle.addEventListener('pointercancel',()=>{if(drag?.panel)drag=null;});
mini.addEventListener('pointerdown',e=>{drag={id:e.pointerId,startX:e.clientX,startY:e.clientY,originX:buttonX,originY:buttonY,moved:false};try{mini.setPointerCapture(e.pointerId);}catch(_){}});
mini.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.startX,dy=e.clientY-drag.startY;if(Math.abs(dx)+Math.abs(dy)>7)drag.moved=true;if(!drag.moved)return;buttonX=drag.originX+dx;buttonY=drag.originY+dy;placeUI();});
mini.addEventListener('pointerup',e=>{if(!drag||drag.id!==e.pointerId)return;suppressClick=drag.moved;if(drag.moved)savePosition();drag=null;});mini.addEventListener('pointercancel',()=>{drag=null;});mini.addEventListener('click',e=>{e.preventDefault();if(suppressClick){suppressClick=false;return;}expanded?collapsePanel():expandPanel();});details.addEventListener('toggle',()=>{if(expanded)requestAnimationFrame(placeUI);});$('#manage-btn').addEventListener('click',()=>{const area=$('#manage-area');area.style.display=area.style.display==='none'?'block':'none';requestAnimationFrame(placeUI);});
let activeTab='auto';function showTab(tab){activeTab=tab;$('#auto-tab').style.display=tab==='auto'?'block':'none';$('#analysis-tab').style.display=tab==='analysis'?'block':'none';$('#tab-auto').classList.toggle('active',tab==='auto');$('#tab-analysis').classList.toggle('active',tab==='analysis');if(tab==='analysis')renderAnalysis();requestAnimationFrame(placeUI);}
function renderAnalysis(){const runs=readSavedRuns(),completed=runs.filter(r=>r.complete),groups=new Map();for(const r of completed){const v=r.vehicle||{},key=[r.courseName||r.courseId||'미확인',v.name||'미확인',v.grade||'?',v.stars??'?',v.tire||'?'].join(' / ');if(!groups.has(key))groups.set(key,{n:0,p:0,g:0,events:0,times:[]});const x=groups.get(key);x.n++;x.p+=r.grades?.perfect||0;x.g+=r.grades?.great||0;x.events+=r.events||0;if(Number.isFinite(r.observedRaceDurationMs)&&r.observedRaceDurationMs>0)x.times.push(r.observedRaceDurationMs);}const lines=['완주 '+completed.length+'판 / 저장 '+runs.length+'판','측정 기준: 출발 신호 → 완주 감지',''];for(const [key,x] of groups){const pct=x.events?(100*x.p/x.events).toFixed(2):'-';const best=x.times.length?(Math.min(...x.times)/1000).toFixed(3)+'초':'미측정';const avg=x.times.length?(x.times.reduce((a,b)=>a+b,0)/x.times.length/1000).toFixed(3)+'초':'미측정';lines.push(key,'  '+x.n+'판 · PERFECT '+pct+'%','  최단 '+best+' / 평균 '+avg,'');}if(!groups.size)lines.push('아직 완주 기록이 없습니다.');$('#analysis-summary').textContent=lines.join('\n');}
$('#tab-auto').addEventListener('click',()=>showTab('auto'));$('#tab-analysis').addEventListener('click',()=>showTab('analysis'));$('#analysis-refresh').addEventListener('click',renderAnalysis);$('#analysis-copy2').addEventListener('click',()=>$('#analysis-copy').click());
const fields=['brakeY','boostY','brakeOffset','boostOffset','predictionMs','boostZones','colorTolerance','tolerance'];function updateInputs(){for(const f of fields){const i=$('#'+f);if(i)i.value=cfg[f];}const p=$('#vehicleProfile');if(p)p.value=profile;}
for(const f of fields){$('#'+f).addEventListener('change',()=>{const v=Number($('#'+f).value);if(Number.isFinite(v))cfg[f]=v;else $('#'+f).value=cfg[f];});}
$('#vehicleProfile').addEventListener('change',e=>{if(running){e.target.value=profile;setMessage('주행 중 프로필 변경 불가');return;}setProfile(e.target.value);setMessage('수동 프로필 변경 완료');});
$('#start-btn').onclick=()=>{if(running||chainEnabled)return;setProfile($('#vehicleProfile').value);start();};$('#chain-btn').onclick=()=>{setProfile($('#vehicleProfile').value);startChain();};$('#stop-btn').onclick=()=>{if(chainEnabled)stopChain('사용자가 연속 주행 중지');else stop();};$('#save-btn').onclick=()=>{if(running){setMessage('주행 중 설정 변경 불가');return;}setProfile($('#vehicleProfile').value);saveSettings();};$('#reset-btn').onclick=()=>{if(running)return;cfg={...DEFAULTS};updateInputs();saveSettings();};$('#detect-btn').onclick=()=>{refreshVehicle();setMessage('화면 차량 정보 다시 읽기 완료');};
async function copyText(t){try{await navigator.clipboard.writeText(t);return true;}catch(_){try{const el=document.createElement('textarea');el.value=t;el.style.cssText='position:fixed;left:0;top:0;opacity:0';document.body.appendChild(el);el.focus();el.select();const ok=document.execCommand('copy');el.remove();return ok;}catch(_){return false;}}}
function currentExport(){return {version:VERSION,releaseBase:RELEASE,courseId,courseName,vehicleProfile:profile||null,vehicle:profileAtStart||detected,settings:{...cfg},engine:{frameFactor:ENGINE.frameFactor,maxAdaptiveMs:ENGINE.maxAdaptiveMs,maxPredictionPx:ENGINE.maxPredictionPx,averageFrameMs:round(averageFrameMs,3),highSpeedStart:ENGINE.highSpeedStart,highSpeedFull:ENGINE.highSpeedFull,maxHighSpeedAdvancePx:ENGINE.maxHighSpeedAdvancePx,frameLookaheadFactor:ENGINE.frameLookaheadFactor,accelerationMaxPx:ENGINE.accelerationMaxPx},universalStats:{...universalStats,averageHighSpeedAdvancePx:universalStats.highSpeedEvents?round(universalStats.totalAdvancePx/universalStats.highSpeedEvents,4):0},learning:{correction:{...correction},evidence:{...evidence},stats:{...stats}},boostOnCount,boostOffCount,history,feedbackLog,segmentResults,analysis:{measuredMaxSpeedKmh:analysisMaxSpeed,markerMaxSpeedPxMs:universalStats.maximumSpeed,speedSamples:analysisSamples,accelerationSamples:analysisAccel,eventTelemetry:analysisEvents}};}
$('#copy-btn').onclick=async()=>setMessage(await copyText(JSON.stringify(currentExport(),null,2))?'입력 기록 복사 완료':'복사 실패');
$('#analysis-copy').onclick=async()=>setMessage(await copyText(JSON.stringify(readSavedRuns(),null,2))?'누적 분석 기록 복사 완료':'복사 실패');
$('#analysis-download').onclick=()=>{const blob=new Blob([JSON.stringify(readSavedRuns(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='dopamine-v337-analysis.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);setMessage(readSavedRuns().length?'누적 분석 파일 저장 요청':'저장된 분석 기록이 없습니다. 주행 후 다시 시도하세요');};
function render(){const cs=$('#chain-status');if(cs)cs.textContent='연속: '+(chainEnabled?'작동':'꺼짐')+' / '+chainState+' / 이번 실행 '+chainRuns+'판'+(chainCounts?'\n타이어 잔여 H:'+chainCounts.hard+' M:'+chainCounts.medium+' S:'+chainCounts.soft:'');const c=$('#course-name'),s=$('#status'),v=$('#vehicle-info');if(c)c.textContent=courseName+' ('+courseId+')\n프로필: '+(profile||'자동(기존 학습 없음)');if(v)v.textContent='인식: '+profileStatus+'\n차량: '+(detected.name||'미확인')+'\n등급: '+(detected.grade||'미확인')+' / 별: '+(detected.stars??'미확인')+'\n타이어: '+(detected.tire||'미확인')+'\n표시 최고속력: '+(detected.displayTopSpeedKmh??'미확인')+' km/h\n누적 주행: '+savedRunCount+'회';if(s)s.textContent=lastMessage+'\nBOOST ON: '+boostOnCount+' / OFF: '+boostOffCount+'\n다음: '+boostExpected+'\n마지막 감지: '+lastDetected+'\n판정: '+lastFeedback+'\nPERFECT: '+stats.perfect+' / GREAT: '+stats.great+'\n고속 보정 입력: '+universalStats.highSpeedEvents+'\n가속도 보정 입력: '+universalStats.accelerationUsed+'\n프레임: '+round(averageFrameMs,1)+'ms\n학습 보정: '+stats.adjusted+'회\n실측 최고속도: '+(analysisMaxSpeed===null?'미확인':analysisMaxSpeed+' km/h');const simpleState=$('#simple-state'),simpleTires=$('#simple-tires');if(simpleState)simpleState.textContent=running?'🟢 주행 중':chainEnabled?'🔁 연속 주행':'대기 중';if(simpleTires)simpleTires.textContent=chainCounts?'H '+chainCounts.hard+' · M '+chainCounts.medium+' · S '+chainCounts.soft:'확인 전';mini.textContent=expanded?'✕ AUTO':running?'🟢 AUTO':'🚗 AUTO';}
function setMessage(m){lastMessage=m;render();}
function onResize(){placeUI();}function onPageHide(){if(chainEnabled)stopChain('페이지 이동으로 중지');else stop(false);}function destroy(){if(destroyed)return;destroyed=true;clearInterval(lobbyInfoTimer);if(chainEnabled)stopChain('스크립트 교체로 중지');else stop(false);window.removeEventListener('resize',onResize);window.removeEventListener('pagehide',onPageHide);ui.remove();if(window[INSTANCE]?.destroy===destroy)delete window[INSTANCE];}
const lobbyInfoTimer=setInterval(refreshLobbyInfo,1500);
window.addEventListener('resize',onResize);window.addEventListener('pagehide',onPageHide);window[INSTANCE]={destroy};window.__duAuto={state:()=>({running,chainEnabled,chainRuns,chainState,chainCounts,lastMessage,courseName,stats:{...stats}})};loadProfile();updateInputs();restorePosition();detectCourse();refreshVehicle();refreshLobbyInfo();collapsePanel();render();
})();
// Dopamine Fleet Tracker runtime — Vehicle Analyzer Release 1.0 (bootstrap compatibility marker)
(function () {
  'use strict';
  const VERSION = '1.0';
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
  let collapsed = true;
  const root = document.createElement('div');
  root.id = 'dft-root';
  const shadow = root.attachShadow({mode:'open'});
  const clean = s => String(s || '').replace(/\s+/g,' ').trim();
  const who = s => ALIASES[clean(s)] || clean(s);
  const date = () => new Date().toISOString();
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
    if (collecting) return;
    const p = activeGaragePanel();
    const actual = ownerOverride || currentGarageOwner();
    if (!p) { if (!silent) note('차고 팝업을 찾지 못했습니다.'); return; }
    if (!actual) { if (!silent) note('현재 차고 소유주를 확인하지 못했습니다. 이전 선택값으로 저장하지 않습니다.'); return; }
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
        if (!silent) note('스크롤 끝까지 확인하지 못해 저장하지 않았습니다. 수집 '+cars.length+'종');
        return;
      }
      if (!cars.length) {if (!silent) note('차량 카드 0건 인식. 화면 구조 확인이 필요합니다.');return;}
      if (expected!==null && total!==expected) {if (!silent) note('수량 불일치: 게임 '+expected+'대 / 추적 '+total+'대. 기존 기록 보호를 위해 저장하지 않았습니다.');return;}
      const prev = db.garages[actual]?.vehicles || [];
      const changes = differences(prev,cars);
      if (prev.length && !changes.length) {if (!silent) note(actual+' 차고 변경 없음 ('+cars.length+'종 / '+total+'대)');return true;}
      const at = date();
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
      if (!silent) note('차고 수집 오류: '+String(e.message || e));
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
      if(p&&p.getClientRects().length&&(currentGarageOwner()===owner||/보유\s*차량/.test(p.innerText||'')))return p;
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
    return {schema:'dopamine-race-garages-ai-v1',generatedAt,
      source:'도파민레이스 차량 추적기',trackerVersion:VERSION,
      participants:USERS.map(user=>{
        const g=db.garages[user];
        const vehicles=(g?.vehicles||[]).map(v=>({
          grade:v.grade,model:v.model,maxStars:Number(v.stars),
          quantity:Number(v.qty),starBreakdown:Array.isArray(v.breakdown)?v.breakdown:[]
        }));
        return {user,updatedAt:g?.updatedAt||null,modelCount:vehicles.length,
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
  async function uploadAiGarageJson(payload,token){
    const headers={'Accept':'application/vnd.github+json','Authorization':'Bearer '+token,
      'X-GitHub-Api-Version':'2022-11-28'};
    const current=await fetch(GH_FILE_API,{headers,cache:'no-store'});
    if(current.status!==200&&current.status!==404)
      throw new Error('기존 파일 조회 HTTP '+current.status+(current.status===401?' (토큰 인증 실패)':''));
    const sha=current.status===200?(await current.json()).sha:null;
    const body={message:'Update latest garages '+payload.generatedAt,
      content:base64Utf8(JSON.stringify(payload,null,2)),branch:'main'};
    if(sha)body.sha=sha;
    const response=await fetch(GH_FILE_API,{method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(!response.ok){
      const detail=await response.json().catch(()=>({}));
      throw new Error('업로드 HTTP '+response.status+(detail.message?' · '+detail.message:''));
    }
    return true;
  }
  async function publishAiGarageJson(){
    const payload=aiGaragePayload();
    let token=localStorage.getItem(GH_TOKEN_KEY)||'';
    if(!token){
      const entered=window.prompt('GitHub Fine-grained PAT를 입력하세요 (저장소 Contents 읽기/쓰기 권한). 토큰은 이 브라우저에만 저장되며 GitHub 코드/JSON에는 포함되지 않습니다.');
      if(!entered){
        downloadAiGarageJson(payload);
        note('GitHub 토큰 미등록 · JSON 파일로 대신 저장했습니다. 다음 갱신 때 다시 입력할 수 있습니다.');
        return;
      }
      token=entered.trim();
      if(!token){note('토큰이 비어 있어 업로드하지 않았습니다.');return;}
      localStorage.setItem(GH_TOKEN_KEY,token);
    }
    note('6/6명 수집 완료 · GitHub 업로드 중…');
    try{
      await uploadAiGarageJson(payload,token);
      note('GitHub 자동 업로드 성공 · data/latest-garages.json · 이제 ChatGPT에 "차고 갱신했어"라고 말씀하세요.');
    }catch(e){
      downloadAiGarageJson(payload);
      if(/401|403/.test(String(e.message||e))){
        localStorage.removeItem(GH_TOKEN_KEY);
        note('GitHub 인증/권한 오류: '+String(e.message||e)+' · 토큰 저장을 해제했습니다. JSON은 백업 다운로드했습니다.');
      }else note('GitHub 업로드 실패: '+String(e.message||e)+' · JSON은 백업 다운로드했습니다.');
    }
  }
  async function refreshAllGarages() {
    if(fleetRefreshing||collecting)return;
    const initial=participantRows();
    if(initial.length!==6||initial.some(x=>!x.owner)||new Set(initial.map(x=>x.owner)).size!==6){
      note('참가자 인식 '+initial.filter(x=>x.owner).length+'/'+initial.length+'명 ('+initial.map(x=>x.owner||'?').join(', ')+'). 상점 → 참가자 현황을 확인하세요.');
      return;
    }
    fleetRefreshing=true;
    const results=[];
    let successes=0;
    try{
      for(let i=0;i<initial.length;i++){
        const {owner}=initial[i];
        note('전체 차고 갱신 '+(i+1)+'/6: '+owner+' 차고 여는 중');
        const row=participantRows().find(x=>x.owner===owner);
        if(!row||!row.button.isConnected){results.push(owner+' 행 없음');continue;}
        row.button.click();
        const p=await waitForGarage(owner);
        if(!p){results.push(owner+' 열기 실패');continue;}
        await pause(250);
        const ok=await captureGarage(true,owner);
        const garage=db.garages[owner];
        const qty=(garage?.vehicles||[]).reduce((n,v)=>n+(Number(v.qty)||0),0);
        const expected=expectedTotal(p);
        if(ok)successes++;
        results.push(owner+(ok?' '+garage.vehicles.length+'종/'+qty+'대 (게임 '+(expected===null?'미확인':expected)+'대)':' 저장 실패 (게임 '+(expected===null?'미확인':expected)+'대)'));
        if(!closeGarage(p)){note(owner+' 차고 닫기 실패. 자동 갱신 중단');break;}
        await pause(350);
      }
      if(successes===6){
        await publishAiGarageJson();
      }else{
        note('전체 차고 갱신: '+successes+'/6명 성공 · JSON 자동 생성 보류. '+results.join(' / '));
      }
    }catch(e){note('전체 갱신 오류: '+String(e.message||e));}
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
      '<div class="wrap"><button id="fleet" '+(busy?'disabled':'')+'>🚗 차량 분석기 1.0 · '+(busy?'갱신 중…':'차량 갱신')+'</button>'+
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
  window.__duFleet={refresh:refreshAllGarages,exportJson,captureTrades,state:()=>({busy:fleetRefreshing||collecting,message,users:Object.keys(db.garages||{}).length})};
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

const autoRoot=document.getElementById('dopamine-auto-v336-ui');
if(autoRoot)autoRoot.style.setProperty('display','none','important');
const box=document.createElement('div');box.id='du-integrated';
box.innerHTML='<style>'+
'#du-integrated *{box-sizing:border-box}#du-integrated{font:12px/1.45 system-ui,sans-serif;color:#e9f3ff}'+
'#du-integrated .panel{width:256px;max-width:calc(100vw - 16px);background:#152337;border:1px solid #667b91;border-radius:12px;padding:9px;box-shadow:0 7px 28px #0009;max-height:calc(100vh - 16px);overflow-y:auto}'+
'#du-integrated button{border:0;border-radius:6px;color:white;background:#38536e;padding:8px 5px;font:700 11px system-ui,sans-serif;cursor:pointer}'+
'#du-integrated button:disabled{opacity:.45;cursor:not-allowed}#du-integrated .head{display:flex;justify-content:space-between;align-items:center;gap:5px;touch-action:none;margin-bottom:8px;cursor:move}'+
'#du-integrated .grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}#du-integrated .primary{min-height:47px;font-size:12px;background:#235d72}#du-integrated #du-auto{background:#166b44}'+
'#du-integrated .section{margin-top:8px;padding-top:8px;border-top:1px solid #405266}#du-integrated .status{font-size:10px;color:#bfd2e5;white-space:pre-wrap;max-height:76px;overflow:auto;margin-top:7px;overflow-wrap:anywhere}'+
'#du-integrated .report{background:#0e1b2b;border-radius:5px;padding:6px;max-height:170px;overflow:auto;white-space:pre-wrap;font-size:10px}'+
'#du-integrated label{display:block;font-size:10px;margin-top:5px}#du-integrated input{width:100%;padding:5px;background:#102034;border:1px solid #6c839d;border-radius:5px;color:#fff}'+
'#du-integrated .settings{max-height:210px;overflow:auto}#du-integrated .mini{display:none;border:1px solid #71869c;background:#192e45;border-radius:22px;padding:10px 14px}'+
'</style>'+
'<div class="panel"><div class="head"><strong>🏎️ 도파민 레이스 <small style="color:#b3c8db">통합 v1.0.1</small></strong><div><button id="du-tools">⚙</button> <button id="du-min">−</button></div></div>'+
'<div class="grid"><button class="primary" id="du-auto">▶ AUTO 주행</button><button class="primary" id="du-garage">🚗 차고 갱신</button></div>'+
'<div class="status" id="du-status">초기화 중…</div>'+
'<div class="section" id="du-race" hidden><div class="grid"><button id="du-one">▶ 1판 시작</button><button id="du-chain">🔁 타이어 모두</button><button id="du-stop" style="background:#a5313e">■ 중지</button><button id="du-analyze">📊 주행 분석</button></div><div class="status" id="du-race-status"></div></div>'+
'<div class="section" id="du-advanced" hidden><div class="grid"><button id="du-log">📋 입력 기록 복사</button><button id="du-copy-analysis">📋 누적 분석 복사</button><button id="du-json">💾 누적 JSON 저장</button><button id="du-detect">🔍 차량 다시 읽기</button><button id="du-defaults">↩ 설정 초기화</button><button id="du-export">📥 차고 백업</button><button id="du-trades">🧾 거래 기록 수집</button></div><div class="settings" id="du-settings"></div><button style="width:100%;margin-top:6px" id="du-save">⚙ AUTO 설정 저장</button></div>'+
'<div class="section" id="du-report" hidden><div class="report" id="du-report-body"></div><button style="width:100%;margin-top:6px" id="du-report-close">분석 닫기</button></div></div>'+
'<button class="mini" id="du-expand">🏎️ 도파민 레이스</button>';
document.body.appendChild(box);
const q=s=>box.querySelector(s),autoUi=()=>document.getElementById('dopamine-auto-v336-ui');
const press=id=>{const e=autoUi()?.querySelector('#'+id);if(!e)return false;e.click();return true;};
const getA=()=>window.__duAuto?.state?.()||{}, getF=()=>window.__duFleet?.state?.()||{};
const fieldNames=[['brakeY','브레이크 판정선 Y'],['boostY','부스터 판정선 Y'],['brakeOffset','브레이크 보정 px'],['boostOffset','부스터 보정 px'],['predictionMs','예측 시간 ms'],['boostZones','부스터 구간 수'],['colorTolerance','색상 허용 오차'],['tolerance','판정 허용 오차']];
let view='none',minimized=false,notice='',drag=null,moved=false;
function settings(){const list=q('#du-settings');list.replaceChildren();const pl=document.createElement('label'),pi=document.createElement('input');pl.textContent='학습 프로필 (선택)';pi.type='text';pi.dataset.profile='yes';pi.value=autoUi()?.querySelector('#vehicleProfile')?.value??'';pl.appendChild(pi);list.appendChild(pl);for(const [id,title] of fieldNames){const label=document.createElement('label'),input=document.createElement('input');label.textContent=title;input.type='number';input.dataset.field=id;input.value=autoUi()?.querySelector('#'+id)?.value??'';label.appendChild(input);list.appendChild(label);}}
function analysis(){press('analysis-refresh');q('#du-report-body').textContent=autoUi()?.querySelector('#analysis-summary')?.textContent||'저장된 주행 기록이 없습니다.';}
function toggle(name){view=view===name?'none':name;if(view==='tools')settings();if(view==='report')analysis();render();position();}
function say(m){notice=m;render();}
function relocate(){const dialogs=[...document.querySelectorAll('dialog[open]')].filter(d=>d.getClientRects().length&&d.matches(':modal'));const target=dialogs[dialogs.length-1]||document.body;if(box.parentElement!==target)target.appendChild(box);}
function render(){
const a=getA(),f=getF(),active=!!(a.running||a.chainEnabled),busy=!!f.busy;
q('#du-auto').textContent=active?'🟢 AUTO 작동 중':'▶ AUTO 주행';
q('#du-garage').textContent=busy?'🚗 갱신 중…':'🚗 차고 갱신';
q('#du-garage').disabled=active||busy;
q('#du-one').disabled=active||busy;q('#du-chain').disabled=active||busy;q('#du-stop').disabled=!active;
q('#du-race').hidden=view!=='race';q('#du-advanced').hidden=view!=='tools';q('#du-report').hidden=view!=='report';
q('#du-race-status').textContent='코스: '+(a.courseName||'미확인')+'\n연속: '+(a.chainEnabled?a.chainState+' / '+a.chainRuns+'판':'대기')+'\nPERFECT '+(a.stats?.perfect||0)+' / GREAT '+(a.stats?.great||0);
q('#du-status').textContent=(notice?notice+'\n':'')+(active?'AUTO 주행 중':'AUTO 대기')+(a.chainCounts?'\n타이어 H'+a.chainCounts.hard+' M'+a.chainCounts.medium+' S'+a.chainCounts.soft:'')+'\n'+(f.message||'차고 분석 대기');
relocate();
}
q('#du-auto').onclick=()=>toggle('race');
q('#du-tools').onclick=()=>toggle('tools');
q('#du-one').onclick=()=>{if(getF().busy)return say('차고 갱신 중에는 주행할 수 없습니다.');press('start-btn');notice='';render();};
q('#du-chain').onclick=()=>{if(getF().busy)return say('차고 갱신 중에는 주행할 수 없습니다.');press('chain-btn');notice='';render();};
q('#du-stop').onclick=()=>{press('stop-btn');say('중지 버튼 전달 완료');};
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
function minimize(v){minimized=v;q('.panel').style.display=v?'none':'block';q('#du-expand').style.display=v?'block':'none';position();}
q('#du-min').onclick=()=>minimize(true);q('#du-expand').onclick=()=>{if(moved){moved=false;return;}minimize(false);};
const posKey='dopamine-unified-position-v1';let x=Math.max(8,innerWidth-270),y=Math.max(8,innerHeight-160);
try{const p=JSON.parse(localStorage.getItem(posKey)||'null');if(Number.isFinite(p?.x)&&Number.isFinite(p?.y)){x=p.x;y=p.y;}}catch(_){}
function position(){const w=(minimized?q('#du-expand'):q('.panel')).offsetWidth||260,h=(minimized?q('#du-expand'):q('.panel')).offsetHeight||140;x=Math.max(8,Math.min(x,Math.max(8,innerWidth-w-8)));y=Math.max(8,Math.min(y,Math.max(8,innerHeight-h-8)));box.style.cssText='position:fixed;left:'+x+'px;top:'+y+'px;z-index:2147483647;pointer-events:auto;max-width:calc(100vw - 16px);';}
for(const ev of ['pointerdown','pointermove','pointerup','pointercancel','click','mousedown','mouseup','touchstart','touchend'])box.addEventListener(ev,e=>e.stopPropagation(),{passive:true});
for(const h of [q('.head'),q('#du-expand')]){
h.addEventListener('pointerdown',e=>{if(h===q('.head')&&e.target.closest('button'))return;drag={id:e.pointerId,cx:e.clientX,cy:e.clientY,x,y};moved=false;h.setPointerCapture?.(e.pointerId);});
h.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;let dx=e.clientX-drag.cx,dy=e.clientY-drag.cy;if(Math.abs(dx)+Math.abs(dy)>5)moved=true;if(!moved)return;x=drag.x+dx;y=drag.y+dy;position();});
h.addEventListener('pointerup',e=>{if(!drag||e.pointerId!==drag.id)return;if(moved)try{localStorage.setItem(posKey,JSON.stringify({x,y}));}catch(_){}drag=null;});
h.addEventListener('pointercancel',()=>{drag=null;});
}
window.addEventListener('resize',position);
const timer=setInterval(()=>{render();position();},750);
window.__dopamineUnifiedControl={active:true,destroy:()=>{clearInterval(timer);box.remove();window.__dopamineUnifiedControl=null;}};
render();position();

})();
