// ==UserScript==
// @name         도파민레이스 AUTO
// @namespace    dopamine-race
// @version      3.3.11
// @description  Release 3.0 / v3.3.5 주행 예측 유지 / 연속 주행 / 설정창 안전 전환
// @updateURL    https://raw.githubusercontent.com/tnsdudhaha-ops/dopamine-race-auto/main/dopamine-race-auto.user.js
// @downloadURL  https://raw.githubusercontent.com/tnsdudhaha-ops/dopamine-race-auto/main/dopamine-race-auto.user.js
// @match        https://luck-game-hjh.jihwan1010.chatgpt.site/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==
(() => {
'use strict';
const VERSION='3.3.11', RELEASE='Release 3.0', INSTANCE='__dopamineAutoActive';
try {window[INSTANCE]?.destroy?.();} catch(_) {}
const DEFAULTS={brakeY:315,boostY:315,brakeOffset:0,boostOffset:0,predictionMs:0,scanX:320,scanTop:80,scanBottom:420,tolerance:8,minBandPixels:4,colorTolerance:48,matchDistance:65,boostZones:0};
const COLORS={brakeOn:[255,205,98],brakeOff:[122,235,198],boostOn:[255,89,107],boostOff:[255,157,155]};
const LABELS={brakeOn:'브레이크 ON',brakeOff:'브레이크 OFF',boostOn:'BOOST ON',boostOff:'BOOST OFF'};
const ENGINE={frameFactor:.35,maxAdaptiveMs:8,maxPredictionPx:5,maxFrameMs:80,maxSpeed:1.5,feedbackWindowMs:1200,maxHistory:400,highSpeedStart:.15,highSpeedFull:.23,maxHighSpeedAdvancePx:1.25,frameLookaheadFactor:.30,accelerationMinSamples:4,accelerationMaxAbs:.006,accelerationStableThreshold:.002,accelerationSmoothing:.25,accelerationMaxPx:.45,repeatRequired:2,correctionStep:.5,maxCorrection:3};
const SETTINGS_PREFIX='dopamine-auto-v32:',POSITION_KEY='dopamine-auto:position-v328',LEARNING_PREFIX='dopamine-auto-v335:learning:',PROFILE_KEY='dopamine-auto-v335:profile';
const ANALYSIS_KEY='dopamine-auto-v336:runs', MAX_RUNS=120, MAX_SAMPLES=4000;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), round=(v,n=3)=>Number((Number(v)||0).toFixed(n)), nowMs=()=>performance.now();
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
    const n=Number(m[1]);if(!Number.isInteger(n)||n<0||n>5)return null;
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
  const accel=analysisAccel.map(x=>x.accelKmhPerSec).filter(Number.isFinite).sort((a,b)=>a-b);
  const positive=accel.filter(x=>x>0);
  const median=a=>a.length?a[Math.floor(a.length/2)]:null;
  const result={runId,version:VERSION,courseId,courseName,vehicle:profileAtStart,vehicleKey:vehicleKey(profileAtStart),manualProfile:profile||null,
    reason,complete,completionEvidence:{allEvents,allSegments,phase:root()?.dataset.phase||null},time:new Date().toISOString(),
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
      if(!finishSeenAt){finishSeenAt=now;finishReason='complete';}
      // 결과 메시지가 DOM에 반영될 시간을 확보한 뒤 확정.
      if(now-finishSeenAt>=1000){stop(false,finishReason);if(chainEnabled){chainPendingReturn=true;chainDeadline=Date.now()+18000;chainNextAt=Date.now()+650;chainSay('완주 저장 · 출발선 복귀 대기');}else setMessage('주행 기록 자동 저장 완료');return;}
    }else{finishSeenAt=0;finishReason=null;}
  }
  raf=requestAnimationFrame(drive);
}
function stop(show=true,reason=null){const wasRunning=running;running=false;if(startTimer!==null){clearInterval(startTimer);startTimer=null;}if(raf!==null){cancelAnimationFrame(raf);raf=null;}brake(false);if(boostHeld){send('.boost-key',false);boostHeld=false;}feedbackObserver?.disconnect();feedbackObserver=null;feedbackElement=null;started=false;armed=false;tracks=[];if(wasRunning&&history.length)saveRun(reason||'stopped');if(show)setMessage('자동 플레이 중지');}
function start(){stop(false);detectCourse();const doc=game();if(!doc){setMessage('타임어택 화면 없음');return;}if(root()?.dataset.phase!=='ready'){setMessage('게임 재시작 후 실행하세요');return;}refreshVehicle();profileAtStart=structuredCloneSafe(detected);running=true;started=false;armed=false;runId=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9);tracks=[];nextTrackId=1;eventSequence=0;lastFrameTime=0;averageFrameMs=16.67;boostOnCount=0;boostOffCount=0;boostExpected='boostOn';history.length=0;feedbackLog.length=0;segmentResults.length=0;analysisSamples=[];analysisAccel=[];analysisEvents=[];analysisLastTime=0;analysisLastSpeed=null;analysisLastSpeedTime=0;analysisMaxSpeed=null;runFinalized=false;finishSeenAt=0;finishReason=null;telemetryRejects=0;for(const k of Object.keys(stats))stats[k]=0;for(const k of Object.keys(universalStats))universalStats[k]=0;lastFeedback='-';lastDetected='-';lastFeedbackText='';feedbackEmpty=true;connectFeedbackObserver();brake(true);setMessage('출발 신호 대기 중');const lights=[...doc.querySelectorAll('.lights i')];startTimer=setInterval(()=>{if(!running)return;const active=lights.filter(el=>{const rgb=doc.defaultView.getComputedStyle(el).backgroundColor.match(/\d+/g)?.map(Number);return rgb&&rgb[0]>110&&rgb[0]>rgb[1]*1.35&&rgb[0]>rgb[2]*1.35;}).length;if(active===5)armed=true;if(armed&&active===0){clearInterval(startTimer);startTimer=null;brake(false);started=true;setMessage('자동 출발 성공');}},10);raf=requestAnimationFrame(drive);/* Keep panel state independent from driving. */}
function structuredCloneSafe(o){return JSON.parse(JSON.stringify(o||{}));}
const ui=document.createElement('div');ui.id='dopamine-auto-v336-ui';ui.style.cssText='position:fixed;left:0;top:0;width:0;height:0;z-index:2147483647;font:12px system-ui,sans-serif;color:white;pointer-events:none';
ui.innerHTML=`<style>#dopamine-auto-v336-ui *{box-sizing:border-box}#dopamine-auto-v336-ui button{color:white;border:0;font-weight:700;cursor:pointer;font-family:inherit}#dopamine-auto-v336-ui .panel{display:none;position:fixed;width:248px;max-width:calc(100vw - 16px);background:#142034;border:1px solid #64748b;border-radius:12px 12px 0 12px;box-shadow:0 5px 25px #000a;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;touch-action:pan-y;pointer-events:auto;padding:10px}#dopamine-auto-v336-ui .mini{position:fixed;width:94px;height:42px;display:flex;align-items:center;justify-content:center;background:#17283d;border:1px solid #64748b;border-radius:24px;box-shadow:0 3px 15px #0008;user-select:none;touch-action:none;pointer-events:auto;padding:0;white-space:nowrap}#dopamine-auto-v336-ui .head-title{font-size:12px;font-weight:800;margin-bottom:6px}#dopamine-auto-v336-ui .course{color:#93c5fd;font-size:10px;margin:5px 0;overflow-wrap:anywhere;white-space:pre-wrap}#dopamine-auto-v336-ui .actions{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:8px 0}#dopamine-auto-v336-ui .actions button{padding:9px 5px;border-radius:6px}#dopamine-auto-v336-ui .start{background:#15803d}#dopamine-auto-v336-ui .stop{background:#b91c1c}#dopamine-auto-v336-ui .stats{font-size:10px;line-height:1.5;color:#dbeafe;white-space:pre-wrap;overflow-wrap:anywhere}#dopamine-auto-v336-ui details{margin-top:7px;border-top:1px solid #475569;padding-top:7px}#dopamine-auto-v336-ui summary{color:#93c5fd;font-weight:700;cursor:pointer;padding:4px 0}#dopamine-auto-v336-ui label{display:block;margin:7px 0 3px;color:#cbd5e1;font-size:10px}#dopamine-auto-v336-ui input{display:block;width:100%;padding:7px;background:#1e293b;color:white;border:1px solid #64748b;border-radius:5px;font-size:12px}#dopamine-auto-v336-ui .subbutton{width:100%;margin-top:7px;padding:9px;border-radius:6px;background:#2563eb}#dopamine-auto-v336-ui .reset{background:#475569}#dopamine-auto-v336-ui .hint{font-size:10px;color:#fcd34d;line-height:1.4;margin:5px 0}</style><div class="panel" id="auto-panel"><div class="head-title">🚗 AUTO v3.3.10 · 주행 중 UI 안전</div><div class="course" id="course-name">코스 분석 대기</div><div class="actions"><button class="start" id="start-btn">▶ 1판 시작</button><button class="stop" id="stop-btn">■ 전체 중지</button></div><button class="subbutton" id="chain-btn" style="background:#0f766e">🔁 잔여 타이어 모두 자동 주행</button><div class="stats" id="chain-status" style="margin-top:5px"></div><div class="stats" id="status">대기 중</div><details><summary>🚙 차량·타이어 분석</summary><div class="stats" id="vehicle-info"></div><p class="hint">자동 인식은 화면 DOM 확인이 필요합니다. 미확인 항목은 추정하지 않습니다.</p><button class="subbutton" id="detect-btn">🔍 선택 정보 다시 읽기</button><button class="subbutton" id="analysis-copy">📊 누적 분석 JSON 복사</button><button class="subbutton" id="analysis-download">💾 누적 분석 JSON 저장</button></details><details id="settings-details"><summary>⚙ 상세 설정</summary><label>기존 수동 프로필 (학습 보정 키)</label><input id="vehicleProfile" type="text" placeholder="비우면 기존 학습 보정 비활성"><label>브레이크 판정선 Y</label><input id="brakeY" type="number"><label>부스터 판정선 Y</label><input id="boostY" type="number"><label>브레이크 보정 px</label><input id="brakeOffset" type="number"><label>부스터 보정 px</label><input id="boostOffset" type="number"><label>예측 시간 ms</label><input id="predictionMs" type="number"><label>부스터 구간 수 (0=자동)</label><input id="boostZones" type="number"><label>색상 허용 오차</label><input id="colorTolerance" type="number"><label>판정 허용 오차 px</label><input id="tolerance" type="number"><button class="subbutton" id="save-btn">설정 저장</button><button class="subbutton reset" id="reset-btn">기본 설정 복원</button></details><button class="subbutton" id="copy-btn">📋 현재 입력 기록 복사</button></div><button class="mini" id="auto-mini">🚗 AUTO</button>`;
document.body.appendChild(ui);const $=s=>ui.querySelector(s),mini=$('#auto-mini'),panel=$('#auto-panel'),details=$('#settings-details'),PANEL_W=248,BUTTON_W=94,BUTTON_H=42,MARGIN=8;let expanded=false,buttonX=0,buttonY=0,drag=null,suppressClick=false;
function viewport(){return {width:document.documentElement.clientWidth||window.innerWidth,height:document.documentElement.clientHeight||window.innerHeight};}
function panelWidth(){return Math.max(1,Math.min(PANEL_W,viewport().width-MARGIN*2));}
function panelHeightLimit(){return Math.max(0,viewport().height-BUTTON_H-MARGIN*2);}
function measuredPanelHeight(){if(!expanded)return 0;panel.style.display='block';panel.style.width=panelWidth()+'px';panel.style.maxHeight=panelHeightLimit()+'px';return panel.getBoundingClientRect().height;}
function bounds(){const vp=viewport();return {minX:MARGIN,maxX:Math.max(MARGIN,vp.width-BUTTON_W-MARGIN),minY:MARGIN,maxY:Math.max(MARGIN,vp.height-BUTTON_H-MARGIN)};}
function placeUI(){const b=bounds();buttonX=clamp(buttonX,b.minX,b.maxX);buttonY=clamp(buttonY,b.minY,b.maxY);mini.style.left=buttonX+'px';mini.style.top=buttonY+'px';if(!expanded)return;const vp=viewport(),w=panelWidth(),h=measuredPanelHeight();panel.style.left=clamp(buttonX+BUTTON_W-w,MARGIN,Math.max(MARGIN,vp.width-w-MARGIN))+'px';panel.style.top=(buttonY>=h+MARGIN?buttonY-h:clamp(buttonY+BUTTON_H,MARGIN,Math.max(MARGIN,vp.height-h-MARGIN)))+'px';panel.style.right='auto';panel.style.bottom='auto';}
function expandPanel(){expanded=true;panel.style.display='block';placeUI();render();}
function collapsePanel(){expanded=false;panel.style.display='none';placeUI();render();}
function savePosition(){try{localStorage.setItem(POSITION_KEY,JSON.stringify({x:buttonX,y:buttonY}));}catch(_){}}
function restorePosition(){const vp=viewport();buttonX=vp.width-BUTTON_W-12;buttonY=vp.height-BUTTON_H-18;try{const s=JSON.parse(localStorage.getItem(POSITION_KEY)||'null');if(Number.isFinite(s?.x)&&Number.isFinite(s?.y)){buttonX=s.x;buttonY=s.y;}}catch(_){}placeUI();}
// UI interactions are isolated from page-level game handlers. Never stop/restart the driving engine on panel toggle.
for(const type of ['pointerdown','pointerup','pointermove','pointercancel','mousedown','mouseup','click','dblclick','touchstart','touchmove','touchend','touchcancel']){ui.addEventListener(type,e=>{e.stopPropagation();},{passive:true});}
mini.addEventListener('pointerdown',e=>{drag={id:e.pointerId,startX:e.clientX,startY:e.clientY,originX:buttonX,originY:buttonY,moved:false};try{mini.setPointerCapture(e.pointerId);}catch(_){}});
mini.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.startX,dy=e.clientY-drag.startY;if(Math.abs(dx)+Math.abs(dy)>7)drag.moved=true;if(!drag.moved)return;buttonX=drag.originX+dx;buttonY=drag.originY+dy;placeUI();});
mini.addEventListener('pointerup',e=>{if(!drag||drag.id!==e.pointerId)return;suppressClick=drag.moved;if(drag.moved)savePosition();drag=null;});mini.addEventListener('pointercancel',()=>{drag=null;});mini.addEventListener('click',e=>{e.preventDefault();if(suppressClick){suppressClick=false;return;}expanded?collapsePanel():expandPanel();});details.addEventListener('toggle',()=>{if(expanded)requestAnimationFrame(placeUI);});
const fields=['brakeY','boostY','brakeOffset','boostOffset','predictionMs','boostZones','colorTolerance','tolerance'];function updateInputs(){for(const f of fields){const i=$('#'+f);if(i)i.value=cfg[f];}const p=$('#vehicleProfile');if(p)p.value=profile;}
for(const f of fields){$('#'+f).addEventListener('change',()=>{const v=Number($('#'+f).value);if(Number.isFinite(v))cfg[f]=v;else $('#'+f).value=cfg[f];});}
$('#vehicleProfile').addEventListener('change',e=>{if(running){e.target.value=profile;setMessage('주행 중 프로필 변경 불가');return;}setProfile(e.target.value);setMessage('수동 프로필 변경 완료');});
$('#start-btn').onclick=()=>{if(running||chainEnabled)return;setProfile($('#vehicleProfile').value);start();};$('#chain-btn').onclick=()=>{setProfile($('#vehicleProfile').value);startChain();};$('#stop-btn').onclick=()=>{if(chainEnabled)stopChain('사용자가 연속 주행 중지');else stop();};$('#save-btn').onclick=()=>{if(running){setMessage('주행 중 설정 변경 불가');return;}setProfile($('#vehicleProfile').value);saveSettings();};$('#reset-btn').onclick=()=>{if(running)return;cfg={...DEFAULTS};updateInputs();saveSettings();};$('#detect-btn').onclick=()=>{refreshVehicle();setMessage('화면 차량 정보 다시 읽기 완료');};
async function copyText(t){try{await navigator.clipboard.writeText(t);return true;}catch(_){try{const el=document.createElement('textarea');el.value=t;el.style.cssText='position:fixed;left:0;top:0;opacity:0';document.body.appendChild(el);el.focus();el.select();const ok=document.execCommand('copy');el.remove();return ok;}catch(_){return false;}}}
function currentExport(){return {version:VERSION,releaseBase:RELEASE,courseId,courseName,vehicleProfile:profile||null,vehicle:profileAtStart||detected,settings:{...cfg},engine:{frameFactor:ENGINE.frameFactor,maxAdaptiveMs:ENGINE.maxAdaptiveMs,maxPredictionPx:ENGINE.maxPredictionPx,averageFrameMs:round(averageFrameMs,3),highSpeedStart:ENGINE.highSpeedStart,highSpeedFull:ENGINE.highSpeedFull,maxHighSpeedAdvancePx:ENGINE.maxHighSpeedAdvancePx,frameLookaheadFactor:ENGINE.frameLookaheadFactor,accelerationMaxPx:ENGINE.accelerationMaxPx},universalStats:{...universalStats,averageHighSpeedAdvancePx:universalStats.highSpeedEvents?round(universalStats.totalAdvancePx/universalStats.highSpeedEvents,4):0},learning:{correction:{...correction},evidence:{...evidence},stats:{...stats}},boostOnCount,boostOffCount,history,feedbackLog,segmentResults,analysis:{measuredMaxSpeedKmh:analysisMaxSpeed,markerMaxSpeedPxMs:universalStats.maximumSpeed,speedSamples:analysisSamples,accelerationSamples:analysisAccel,eventTelemetry:analysisEvents}};}
$('#copy-btn').onclick=async()=>setMessage(await copyText(JSON.stringify(currentExport(),null,2))?'입력 기록 복사 완료':'복사 실패');
$('#analysis-copy').onclick=async()=>setMessage(await copyText(JSON.stringify(readSavedRuns(),null,2))?'누적 분석 기록 복사 완료':'복사 실패');
$('#analysis-download').onclick=()=>{const blob=new Blob([JSON.stringify(readSavedRuns(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='dopamine-v337-analysis.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);setMessage(readSavedRuns().length?'누적 분석 파일 저장 요청':'저장된 분석 기록이 없습니다. 주행 후 다시 시도하세요');};
function render(){const cs=$('#chain-status');if(cs)cs.textContent='연속: '+(chainEnabled?'작동':'꺼짐')+' / '+chainState+' / 이번 실행 '+chainRuns+'판'+(chainCounts?'\n타이어 잔여 H:'+chainCounts.hard+' M:'+chainCounts.medium+' S:'+chainCounts.soft:'');const c=$('#course-name'),s=$('#status'),v=$('#vehicle-info');if(c)c.textContent=courseName+' ('+courseId+')\n프로필: '+(profile||'자동(기존 학습 없음)');if(v)v.textContent='인식: '+profileStatus+'\n차량: '+(detected.name||'미확인')+'\n등급: '+(detected.grade||'미확인')+' / 별: '+(detected.stars??'미확인')+'\n타이어: '+(detected.tire||'미확인')+'\n표시 최고속력: '+(detected.displayTopSpeedKmh??'미확인')+' km/h\n누적 주행: '+savedRunCount+'회';if(s)s.textContent=lastMessage+'\nBOOST ON: '+boostOnCount+' / OFF: '+boostOffCount+'\n다음: '+boostExpected+'\n마지막 감지: '+lastDetected+'\n판정: '+lastFeedback+'\nPERFECT: '+stats.perfect+' / GREAT: '+stats.great+'\n고속 보정 입력: '+universalStats.highSpeedEvents+'\n가속도 보정 입력: '+universalStats.accelerationUsed+'\n프레임: '+round(averageFrameMs,1)+'ms\n학습 보정: '+stats.adjusted+'회\n실측 최고속도: '+(analysisMaxSpeed===null?'미확인':analysisMaxSpeed+' km/h');mini.textContent=expanded?'✕ AUTO':running?'🟢 AUTO':'🚗 AUTO';}
function setMessage(m){lastMessage=m;render();}
function onResize(){placeUI();}function onPageHide(){if(chainEnabled)stopChain('페이지 이동으로 중지');else stop(false);}function destroy(){if(destroyed)return;destroyed=true;if(chainEnabled)stopChain('스크립트 교체로 중지');else stop(false);window.removeEventListener('resize',onResize);window.removeEventListener('pagehide',onPageHide);ui.remove();if(window[INSTANCE]?.destroy===destroy)delete window[INSTANCE];}
window.addEventListener('resize',onResize);window.addEventListener('pagehide',onPageHide);window[INSTANCE]={destroy};loadProfile();updateInputs();restorePosition();detectCourse();refreshVehicle();collapsePanel();render();
})();