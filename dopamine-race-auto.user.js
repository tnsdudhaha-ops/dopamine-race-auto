// ==UserScript==
// @name         도파민레이스 AUTO
// @namespace    dopamine-race
// @version      3.3.42
// @description  Release 3.0 / 예측식 동결 / 주행기록 용량초과 대비·이중 보관 및 전송 진단
// @updateURL    https://raw.githubusercontent.com/tnsdudhaha-ops/dopamine-race-auto/main/dopamine-race-auto.user.js
// @downloadURL  https://raw.githubusercontent.com/tnsdudhaha-ops/dopamine-race-auto/main/dopamine-race-auto.user.js
// @match        https://luck-game-hjh.jihwan1010.chatgpt.site/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==
(() => {
'use strict';
// Avoid duplicate driving engines when the stable unified GitHub loader is active.
if(window.__duMode&&!window.__duUnifiedLoadingAuto)return;
const VERSION='3.3.42', RELEASE='Release 3.0', INSTANCE='__dopamineAutoActive';
try {window[INSTANCE]?.destroy?.();} catch(_) {}
const DEFAULTS={brakeY:315,boostY:315,brakeOffset:0,boostOffset:0,predictionMs:0,scanX:320,scanTop:80,scanBottom:420,tolerance:8,minBandPixels:4,colorTolerance:48,matchDistance:65,boostZones:0};
const COLORS={brakeOn:[255,205,98],brakeOff:[122,235,198],boostOn:[255,89,107],boostOff:[255,157,155]};
const LABELS={brakeOn:'브레이크 ON',brakeOff:'브레이크 OFF',boostOn:'BOOST ON',boostOff:'BOOST OFF'};
const ENGINE={frameFactor:.35,maxAdaptiveMs:8,maxPredictionPx:5,maxFrameMs:80,maxSpeed:1.5,feedbackWindowMs:1200,maxHistory:400,highSpeedStart:.15,highSpeedFull:.23,maxHighSpeedAdvancePx:1.25,frameLookaheadFactor:.30,accelerationMinSamples:4,accelerationMaxAbs:.006,accelerationStableThreshold:.002,accelerationSmoothing:.25,accelerationMaxPx:.45,repeatRequired:2,correctionStep:.5,maxCorrection:3};
const DETECTION_GUARD={lateSpawnSlackPx:8,trackGapMs:80,rafGapMs:80,maxAlerts:80};
// Guarded missing-scan prediction, separate from the frozen Release 3.0 predict().
const COAST_GUARD={minObservations:8,minSpeed:.04,maxSpeed:.36,minTrace:4,maxRecentGapMs:55,maxPriorGapMs:50,maxAgeMs:70,nearTriggerPx:20,maxPredictedOvershootPx:4.5,maxSpeedSpread:.07,maxTrackSpeedDiscrepancy:.065};

const SPARSE_BOOST_GUARD={
  minObservations:4,minTrace:4,minSpeed:.12,maxSpeed:.32,
  minLongGapMs:58,maxRecentGapMs:180,maxSpeedSpread:.027,
  maxTrackSpeedDiscrepancy:.033,maxAgeMs:125,maxMissingFrames:7,
  nearTriggerPx:22,anticipationPx:1.5,maxPredictedOvershootPx:2.5
};
// Do not release by a fixed timer: require consecutive, physically visible BOOST OFF
// marker positions immediately before a brief near-line sampling gap.
const NEAR_BOOST_GAP_GUARD={minTrace:3,minSpeed:.14,maxSpeed:.33,maxRecentGapMs:32,maxAgeMs:55,
  maxMissingFrames:3,nearTriggerPx:17,maxSpeedSpread:.038,maxTrackedSpeedDifference:.045,maxPredictedOvershootPx:2.5};
// Primary center scan remains authoritative. A fallback requires both auxiliary columns.
const SIDE_BOOST_SCAN={offsetPx:12,maxYDifferencePx:3.5,scanIntervalMs:33};
let lastSideBoostScanAt=0;
// Missing BOOST markers: bounded cross-column search, not a timer or guessed input.
// Center observations retain priority; the same-side consensus must be unambiguous.
const WIDE_BOOST_SCAN={offsets:[-96,-72,-48,-24,24,48,72,96],nearPx:96,centerNearPx:28,maxPastPx:3,maxYDifferencePx:4,scanIntervalMs:15,minSpeed:.035,maxSpeed:.36,maxObservationGapMs:70};
let lastWideBoostScanAt=-Infinity,lastWideBoostEvidence=null;
// Sparse BOOST OFF tracks can move past the input line between valid scans.
// Use strictly consistent velocity samples and a bounded time horizon, not a global lead.
function evaluateSparseBoostCoast(track,now){
  if(track.type!=='boostOff'||track.triggered||track.suppressed
    ||track.observationCount<SPARSE_BOOST_GUARD.minObservations
    ||track.missing>SPARSE_BOOST_GUARD.maxMissingFrames)return null;
  const age=now-track.lastTime;
  if(!(age>0&&age<=SPARSE_BOOST_GUARD.maxAgeMs)
    ||!(track.speed>=SPARSE_BOOST_GUARD.minSpeed&&track.speed<=SPARSE_BOOST_GUARD.maxSpeed))return null;
  const frames=track.traceWindow?.slice(-SPARSE_BOOST_GUARD.minTrace)||[];
  if(frames.length!==SPARSE_BOOST_GUARD.minTrace)return null;
  const speeds=[];let sparseGaps=0;
  for(let i=1;i<frames.length;i++){
    const dt=frames[i].t-frames[i-1].t,dy=frames[i].y-frames[i-1].y;
    if(!(dt>0&&dt<=SPARSE_BOOST_GUARD.maxRecentGapMs&&dy>0))return null;
    if(dt>=SPARSE_BOOST_GUARD.minLongGapMs)sparseGaps++;
    speeds.push(dy/dt);
  }
  if(!sparseGaps||Math.max(...speeds)-Math.min(...speeds)>SPARSE_BOOST_GUARD.maxSpeedSpread)return null;
  const ordered=[...speeds].sort((a,b)=>a-b),median=ordered[1];
  if(Math.abs(track.speed-median)>SPARSE_BOOST_GUARD.maxTrackSpeedDiscrepancy)return null;
  const target=cfg.boostY,triggerLine=target-cfg.tolerance;
  if(track.y>=triggerLine||triggerLine-track.y>SPARSE_BOOST_GUARD.nearTriggerPx)return null;
  const eventKey='boostOff:'+(eventSequence+1),prediction=predict(track);
  const autoLead=autoLeadPreview(eventKey,track.speed);
  const estimatedY=track.y+track.speed*age;
  const predictedY=estimatedY+prediction.predictionPx+cfg.boostOffset
    +(correction[eventKey]||0)+autoLead.px;
  const overshoot=predictedY-triggerLine;
  if(!Number.isFinite(estimatedY)||!Number.isFinite(predictedY)||!Number.isFinite(overshoot))return null;
  if(overshoot< -SPARSE_BOOST_GUARD.anticipationPx
    ||overshoot>SPARSE_BOOST_GUARD.maxPredictedOvershootPx)return null;
  return {eventKey,prediction,autoLead,target,predictedY,meta:{
    source:'sparse-boost-coast',gapMs:round(age,2),
    estimatedMarkerY:round(estimatedY,2),
    observedMarkerY:round(track.y,2),
    medianRecentSpeed:round(median,5),
    sparseObservationGaps:sparseGaps,
    anticipationPx:SPARSE_BOOST_GUARD.anticipationPx,
    predictedOvershootPx:round(overshoot,3)
  }};
}
function trySparseBoostCoast(track,now){
  const candidate=evaluateSparseBoostCoast(track,now);
  if(!candidate)return false;
  const success=executeEvent(track,candidate.predictedY,candidate.prediction,
    candidate.eventKey,candidate.target,candidate.autoLead,candidate.meta);
  if(!success)return false;
  track.triggered=true;
  detectionHealth.sparseBoostTriggers++;
  recordDetectionAlert('sparse-boost-coast-trigger',track,now,{eventKey:candidate.eventKey,...candidate.meta});
  return true;
}
// Short visual-gap fallback. This never changes the frozen predict() equation.
function evaluateNearBoostOffGap(track,now){
  const g=NEAR_BOOST_GAP_GUARD;
  if(!boostHeld||boostExpected!=='boostOff'||track.type!=='boostOff'||track.triggered||track.suppressed
    ||track.observationCount<g.minTrace||track.missing>g.maxMissingFrames)return null;
  const age=now-track.lastTime;
  if(!(age>0&&age<=g.maxAgeMs))return null;
  const frames=track.traceWindow?.slice(-g.minTrace)||[];
  if(frames.length!==g.minTrace)return null;
  const speeds=[];
  for(let i=1;i<frames.length;i++){
    const dt=frames[i].t-frames[i-1].t,dy=frames[i].y-frames[i-1].y;
    if(!(dt>0&&dt<=g.maxRecentGapMs&&dy>0))return null;
    speeds.push(dy/dt);
  }
  const min=Math.min(...speeds),max=Math.max(...speeds),median=(speeds[0]+speeds[1])/2;
  if(!(min>=g.minSpeed&&max<=g.maxSpeed)||max-min>g.maxSpeedSpread
    ||!(track.speed>=g.minSpeed&&track.speed<=g.maxSpeed)
    ||Math.abs(track.speed-median)>g.maxTrackedSpeedDifference)return null;
  const target=cfg.boostY,triggerLine=target-cfg.tolerance;
  if(track.y>=triggerLine||track.firstSeenY>=triggerLine||triggerLine-track.y>g.nearTriggerPx)return null;
  const eventKey='boostOff:'+(eventSequence+1),prediction=predict(track),autoLead=autoLeadPreview(eventKey,track.speed);
  const estimatedY=track.y+median*age;
  const predictedY=estimatedY+prediction.predictionPx+cfg.boostOffset+(correction[eventKey]||0)+autoLead.px;
  const overshoot=predictedY-triggerLine;
  if(!Number.isFinite(predictedY)||overshoot<0||overshoot>g.maxPredictedOvershootPx)return null;
  return {eventKey,prediction,autoLead,target,predictedY,meta:{
    source:'near-boost-off-visible-gap',gapMs:round(age,2),estimatedMarkerY:round(estimatedY,2),
    observedMarkerY:round(track.y,2),medianRecentSpeed:round(median,5),
    observations:track.observationCount,predictedOvershootPx:round(overshoot,3)}};
}
function tryNearBoostOffGap(track,now){
  const c=evaluateNearBoostOffGap(track,now);if(!c)return false;
  if(!executeEvent(track,c.predictedY,c.prediction,c.eventKey,c.target,c.autoLead,c.meta))return false;
  track.triggered=true;detectionHealth.nearBoostGapTriggers++;
  recordDetectionAlert('near-boost-off-visible-gap-trigger',track,now,{eventKey:c.eventKey,...c.meta});
  return true;
}
const AUTO_TUNE={minSamples:3,minRuns:3,minDirectional:3,directionalFraction:.75,maxPx:2.2,frameFraction:.5,speedTolerancePxMs:.018,speedToleranceFraction:.08,directionalSpeedTolerancePxMs:.015,qualityFrames:4,qualityGapMs:55,coastMaxGapMs:51,coastMaxOvershootPx:3.55,perfectSafetyMarginPx:.5};
const SETTINGS_PREFIX='dopamine-auto-v32:',POSITION_KEY='dopamine-auto:position-v328',LEARNING_PREFIX='dopamine-auto-v335:learning:',PROFILE_KEY='dopamine-auto-v335:profile';
const ANALYSIS_KEY='dopamine-auto-v336:runs', MAX_RUNS=120, MAX_SAMPLES=4000;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), round=(v,n=3)=>Number((Number(v)||0).toFixed(n)), nowMs=()=>performance.now();
let raceStartedAtMs=null,raceFinishedAtMs=null;
let cfg={...DEFAULTS},courseId='default',courseName='기본 코스',courseScope='default',profile='',running=false,started=false,armed=false,destroyed=false,brakeHeld=false,boostHeld=false,boostExpected='boostOn',boostOnCount=0,boostOffCount=0,eventSequence=0,nextTrackId=1,tracks=[],lastFrameTime=0,averageFrameMs=16.67,raf=null,startTimer=null,feedbackObserver=null,feedbackElement=null,lastFeedbackText='',feedbackEmpty=true,lastMessage='대기 중',lastDetected='-',lastFeedback='-',runId='',profileAtStart=null,analysisLastTime=0,analysisLastSpeed=null,analysisLastSpeedTime=0,analysisMaxSpeed=null,analysisSamples=[],analysisAccel=[],analysisEvents=[],profileStatus='미확인';
const history=[],feedbackLog=[],segmentResults=[],correction={},evidence={},detectionAlerts=[];
const detectionHealth={lateSpawns:0,trackLongGaps:0,rafLongGaps:0,maxTrackGapMs:0,maxRafGapMs:0,coastTriggers:0,sparseBoostTriggers:0,nearBoostGapTriggers:0,sideBoostBands:0,wideBoostScans:0,wideBoostBands:0,wideBoostAmbiguous:0,wideBoostUnconfirmed:0,wideBoostTriggers:0,wheelLockSignalsDuringBoostHeld:0};
const stats={perfect:0,great:0,good:0,bad:0,miss:0,unmatched:0,adjusted:0,segmentResults:0};
const universalStats={highSpeedEvents:0,highSpeedPredictionUsed:0,accelerationUsed:0,accelerationRejected:0,accelerationSamples:0,fallbackCount:0,maximumSpeed:0,maximumAdvancePx:0,totalAdvancePx:0};
function game(){try{return document.querySelector('iframe[title="타임어택"]')?.contentDocument||null;}catch(_){return null;}}
function root(){return game()?.querySelector('#pedallap')||null;}

// Universal measurement only. Never turn game meters into pixel timing without calibration.
// HUD clock, final explicit result and client wall time are separate quantities.
const RUN_CLOCK_POLL_MS=160,RUN_CLOCK_MAX_SAMPLES=100;
let gameClockPoll=0,gameClockLast=null,gameClockAtFinish=null,gameClockSource=null,gameClockCount=0,gameClockTrace=[],wheelLockAtFinish=null,wheelLockObservations=[],lastSavedTiming=null;
function parseGameSeconds(raw){
  const t=String(raw??'').trim();
  if(!t||t.length>95||/최고\s*(?:기록|속력|속도)|랭킹|순위|best\s*lap/i.test(t))return null;
  const m=t.match(/(?:^|[^\d])(?:(\d{1,2}):([0-5]\d)\.(\d{1,3})|(\d{1,3})\.(\d{1,3}))\s*(?:초|seconds?|sec\b|s\b)?/i);
  if(!m)return null;
  const sec=m[1]!==undefined?Number(m[1])*60+Number(m[2])+Number('0.'+m[3]):Number(m[4])+Number('0.'+m[5]);
  return sec>=0&&sec<900&&Number.isFinite(sec)?Math.round(sec*1000)/1000:null;
}
function parseLabeledGameLapSeconds(raw){
  const t=String(raw??'').replace(/\s+/g,' ').trim();
  if(!t||t.length>160||/랭킹|순위|기록실|fastest\s*lap|best\s*lap/i.test(t))return null;
  // HUD may show "최고속력 0.0 km/h" and "랩타임 42.027초" in the same widget.
  // Parse only the digits immediately following the lap-time label.
  const m=t.match(/(?:랩\s*타임|lap\s*time)\s*[:：]?\s*((?:\d{1,2}:)?\d{1,3}\.\d{1,3})\s*(?:초|s\b)?/i);
  return m?parseGameSeconds(m[1]):null;
}
function readGameClock(){
  const r=root();if(!r)return null;
  const direct=[...r.querySelectorAll('[data-lap-time],[data-race-time],[id*="lap-time"],[class*="lap-time"],[class*="lapTime"],[id*="lapTimer"],[class*="lapTimer"],[class*="race-timer"]')].slice(0,50);
  for(const el of direct){
    if(!visible(el))continue;
    const t=textOf(el),attr=el.getAttribute('data-lap-time')||el.getAttribute('data-race-time');
    if(attr!==null){const n=parseGameSeconds(attr);if(n!==null)return {seconds:n,source:'game-hud-clock-attribute'};}
    const labeled=parseLabeledGameLapSeconds(t);
    if(labeled!==null)return {seconds:labeled,source:'game-hud-labeled-clock'};
    // Time-only element with a dedicated lap-time identifier.
    if(/^(?:(?:\d{1,2}:)?\d{1,3}\.\d{1,3})\s*(?:초|s)?$/i.test(t)){
      const n=parseGameSeconds(t);if(n!==null)return {seconds:n,source:'game-hud-dedicated-clock'};
    }
  }
  // Search only inside #pedallap (the active race iframe), never outer-page rankings.
  for(const el of [...r.querySelectorAll('span,div,small,strong,b,p')].slice(0,500)){
    if(!visible(el))continue;
    const t=textOf(el);
    if(t.length>160||!/랩\s*타임|lap\s*time/i.test(t))continue;
    const n=parseLabeledGameLapSeconds(t);
    if(n!==null)return {seconds:n,source:'game-hud-labeled-clock'};
  }
  return null;
}
function sampleGameClock(now,phase){
  if(!started)return;
  const finished=/^(finished|finish|complete|completed|result|results|ended|end|done)$/.test(phase);
  // Always sample the displayed clock at finish, even within the normal 160ms poll interval.
  if(!finished&&now-gameClockPoll<RUN_CLOCK_POLL_MS)return;
  gameClockPoll=now;
  const r=readGameClock();if(!r)return;
  if(gameClockLast!==null&&r.seconds+0.05<gameClockLast)return;
  gameClockLast=r.seconds;gameClockSource=r.source;gameClockCount++;
  if(finished&&r.seconds>0)gameClockAtFinish=r.seconds;
  const last=gameClockTrace[gameClockTrace.length-1];
  if(!last||now-last.atMs>=750||(finished&&last.phase!=='finished')){
    gameClockTrace.push({atMs:Math.round(now),seconds:r.seconds,phase:finished?'finished':'running'});
    if(gameClockTrace.length>RUN_CLOCK_MAX_SAMPLES)gameClockTrace.shift();
  }
}
function readExplicitResultTime(){
  const r=root();if(!r)return null;
  for(const el of [...r.querySelectorAll('[class*="result"],[id*="result"],[class*="finish"],[id*="finish"],[data-result]')].slice(0,50)){
    if(!visible(el))continue;
    const t=textOf(el);
    if(t.length>500)continue;
    const m=t.match(/(?:최종\s*(?:랩\s*타임|기록|시간)|공식\s*(?:기록|시간)|확정\s*(?:기록|시간)|완주\s*(?:기록|시간)|final\s*(?:lap\s*time|time))\s*[:：]?\s*((?:\d{1,2}:)?\d{1,3}\.\d{1,3})\s*(?:초|s)?/i);
    if(m){const seconds=parseGameSeconds(m[1]);if(seconds!==null)return {seconds,source:'game-result-explicit-final-label'};}
  }
  return null;
}
function recordWheelLockSignal(raw,source){
  const txt=String(raw||'').replace(/\s+/g,' ').trim();
  if(!/(?:휠\s*락|wheel\s*lock)/i.test(txt))return;
  const now=nowMs(),last=wheelLockObservations[wheelLockObservations.length-1];
  if(last&&last.text===txt&&now-last.timeMs<500)return;
  const nearest=history.length?history[history.length-1]:null;
  const boostedAtSignal=boostHeld&&boostExpected==='boostOff';
  if(boostedAtSignal)detectionHealth.wheelLockSignalsDuringBoostHeld++;
  const awaitingOff=tracks.filter(t=>t.type==='boostOff'&&!t.triggered)
    .sort((a,b)=>b.lastTime-a.lastTime)[0]||null;
  wheelLockObservations.push({timeMs:Math.round(now),source,text:txt.slice(0,200),
    nearestRecentBoostOffKey:nearest?.type==='boostOff'&&now-nearest.time<=1400?nearest.eventKey:null,
    boostHeldAtSignal:boostHeld,boostExpectedAtSignal:boostExpected,
    lastAutoInputKey:nearest?.eventKey||null,wideBoostLastEvidence:lastWideBoostEvidence?{...lastWideBoostEvidence,ageMs:round(now-lastWideBoostEvidence.at,2)}:null,awaitingBoostOffMarker:awaitingOff?{
      firstSeenY:round(awaitingOff.firstSeenY,2),lastY:round(awaitingOff.y,2),
      lastAgeMs:round(now-awaitingOff.lastTime,2),observationCount:awaitingOff.observationCount,
      suppressed:!!awaitingOff.suppressed
    }:null});
  if(wheelLockObservations.length>30)wheelLockObservations.shift();
}
function readWheelLockResult(){
  if(wheelLockObservations.length)return {status:'explicit-wheel-lock-observed-during-run',text:wheelLockObservations[wheelLockObservations.length-1].text};
  const r=root();if(!r)return {status:'not-readable',text:null};
  for(const el of [...r.querySelectorAll('[class*="result"],[id*="result"],[class*="finish"],[id*="finish"],.feedback')].slice(0,65)){
    if(!visible(el))continue;
    const m=textOf(el).slice(0,650).match(/.{0,45}(?:휠\s*락|wheel\s*lock).{0,75}/i);
    if(m)return {status:'explicit-wheel-lock-text',text:m[0]};
  }
  return {status:'not-observed',text:null}; // absence is not proof of no penalty
}
function summarizeCrossTrackFeedback(){
  const result={byAction:{},byMarkerSpeedBand:{}};
  for(const r of history){
    const speed=!Number.isFinite(r.speed)?'unknown':r.speed<.08?'less-than-0.08':r.speed<.15?'0.08-0.15':r.speed<.23?'0.15-0.23':'over-0.23';
    for(const [group,key] of [[result.byAction,r.type||'unknown'],[result.byMarkerSpeedBand,speed]]){
      const b=group[key]||(group[key]={total:0,perfect:0,great:0,good:0,bad:0,miss:0,unmatched:0,early:0,late:0});
      b.total++;
      if(r.feedbackGrade&&Object.prototype.hasOwnProperty.call(b,r.feedbackGrade))b[r.feedbackGrade]++;else if(!r.feedbackGrade)b.unmatched++;
      if(r.feedbackDirection==='early')b.early++;if(r.feedbackDirection==='late')b.late++;
    }
  }
  return {mode:'observation-only',eventNumberIndependent:true,schema:'cross-track-v1',...result};
}

function send(selector,down){const doc=game(),el=doc?.querySelector(selector);if(!el)return false;try{const w=doc.defaultView;el.dispatchEvent(new w.PointerEvent(down?'pointerdown':'pointerup',{bubbles:true,cancelable:true,pointerId:1,pointerType:'touch',isPrimary:true,button:0,buttons:down?1:0}));return true;}catch(_){return false;}}
function brake(down){if(brakeHeld===down)return true;if(!send('.cursor-interaction',down))return false;brakeHeld=down;return true;}
function boost(down){if(boostHeld===down)return true;if(!send('.boost-key',down))return false;boostHeld=down;if(down)boostOnCount++;else boostOffCount++;return true;}
function settingsKey(){return SETTINGS_PREFIX+courseScope;}
function learningKey(){return profile?LEARNING_PREFIX+encodeURIComponent(courseScope)+':'+encodeURIComponent(profile):null;}
function clearObject(o){for(const k of Object.keys(o))delete o[k];}
function loadSettings(){cfg={...DEFAULTS};try{const s=JSON.parse(localStorage.getItem(settingsKey())||'null');if(s)for(const k of Object.keys(DEFAULTS))if(Number.isFinite(s[k]))cfg[k]=s[k];}catch(_){}updateInputs();}
function saveSettings(){try{localStorage.setItem(settingsKey(),JSON.stringify(cfg));setMessage('설정 저장 완료');}catch(_){setMessage('설정 저장 실패');}}
function loadProfile(){try{profile=(localStorage.getItem(PROFILE_KEY)||'').trim();}catch(_){profile='';}}
function setProfile(v){profile=String(v||'').trim().slice(0,80);try{localStorage.setItem(PROFILE_KEY,profile);}catch(_){}loadLearning();render();}
function loadLearning(){clearObject(correction);clearObject(evidence);const key=learningKey();if(!key)return;try{const s=JSON.parse(localStorage.getItem(key)||'null');for(const [k,v] of Object.entries(s?.correction||{}))if(/^(brakeOn|brakeOff|boostOn|boostOff):\d+$/.test(k)&&Number.isFinite(v))correction[k]=clamp(v,-ENGINE.maxCorrection,ENGINE.maxCorrection);for(const [k,v] of Object.entries(s?.evidence||{}))if(/^(brakeOn|brakeOff|boostOn|boostOff):\d+$/.test(k)&&v&&typeof v==='object')evidence[k]={direction:v.direction||null,count:Number(v.count)||0,lastRun:v.lastRun||null};}catch(_){}}
function saveLearning(){const key=learningKey();if(!key)return;try{localStorage.setItem(key,JSON.stringify({version:VERSION,profile,courseId,correction,evidence}));}catch(_){}}

// Stage 1: automatic, isolated, observation-only learning. The proven predict()
// timing and legacy manual-profile corrections are not changed by this store.
const OBSERVE_PREFIX='dopamine-auto-v338:observe:', TRACE_PRE=12, TRACE_POST=8, TRACE_WINDOW_MS=180;
let observeKey=null,observeState=null,observeRunCount=0,observeRunGreat=0,observePending=[],observeCommitted=false;
function prepareObservation(vehicle){
  observeKey=null;observeState=null;observeRunCount=0;observeRunGreat=0;observePending=[];observeCommitted=false;
  if(!vehicle?.name||!vehicle?.grade||!Number.isInteger(Number(vehicle.stars))||!vehicle.tire)return;
  const identity=vehicleKey(vehicle),key=OBSERVE_PREFIX+encodeURIComponent(identity);
  let saved=null;
  try{saved=JSON.parse(localStorage.getItem(key)||'null');}catch(_){}
  observeKey=key;
  observeState=saved?.schema===1&&saved?.identity===identity&&saved?.events&&typeof saved.events==='object'
    ? saved
    : {schema:1,mode:'confidence-gated',identity,profile:{courseId,courseName,courseScope,vehicle:vehicle.name,grade:vehicle.grade,stars:vehicle.stars,tire:vehicle.tire},events:{},totalFeedback:0,createdAt:new Date().toISOString(),updatedAt:null};
  // Previous versions persisted partial races before the finish was confirmed.
  // Drop known interrupted run votes from auto-tuning; keep their logs for diagnostics.
  const availableRuns=readSavedRuns();
  const interruptedIds=new Set(availableRuns.filter(x=>x.complete===false||hasWheelLockEvidence(x)).map(x=>x.runId).filter(Boolean));
  if(interruptedIds.size)for(const entry of Object.values(observeState.events||{})){
    if(Array.isArray(entry.qualityRecent))
      entry.qualityRecent=entry.qualityRecent.filter(x=>!interruptedIds.has(x.runId));
  }
  restoreRecentTireEvidence(availableRuns);
}
// Only the six frames nearest to the input should gate training quality.
// A long gap much earlier in a track must not discard a clean, visible trigger.
function validCorrectionSample(record){
  if(!record||record.observationCount<8||record.lateSpawnSuppressed||record.wideColumnObservations>0||record.markerReadSource==='verified-wide-columns')return false;
  if(!(record.firstSeenY<record.triggerLineY-DETECTION_GUARD.lateSpawnSlackPx))return false;
  // Check only the four measurements immediately before the input. Earlier sparse
  // scans can be common at high speed, and should not discard a clean near-trigger trace.
  const frames=record.frameTrace?.before?.slice(-AUTO_TUNE.qualityFrames)||[];
  if(frames.length<AUTO_TUNE.qualityFrames)return false;
  if(!frames.every(x=>Number.isFinite(x.y)&&x.observationGapMs>0&&x.observationGapMs<=AUTO_TUNE.qualityGapMs))return false;
  if(!frames.every((x,i)=>i===0||x.y>=frames[i-1].y))return false;
  if(record.triggerSource==='visible')
    return record.lastObservationGapMs>0&&record.lastObservationGapMs<=AUTO_TUNE.qualityGapMs;
  // A coast input may be used ONLY when the game confirmed its feedback, the
  // last observed motion is monotone, and the extrapolation was tightly bounded.
  // Sparse-boost-coast and late-spawn events remain observation-only.
  if(record.triggerSource==='short-gap-coast')
    return record.triggerGapMs>0&&record.triggerGapMs<=AUTO_TUNE.coastMaxGapMs
      &&Number.isFinite(record.triggerPredictedOvershootPx)
      &&record.triggerPredictedOvershootPx>=0
      &&record.triggerPredictedOvershootPx<=AUTO_TUNE.coastMaxOvershootPx;
  return false;
}
function observeFeedback(record,parsed){
  if(!observeState||!record||!parsed?.grade)return;
  // Buffer until the game positively confirms a fully graded finish.
  // This also prevents in-race feedback from changing inter-race auto correction.
  const quality=validCorrectionSample(record);
  record.autoLearningEligible=quality;
  record.observeProfile=observeState.identity;
  record.observeSpeedBand=record.speed>=.19?'high':record.speed>=.12?'medium':'low';
  observePending.push({record,parsed:{grade:parsed.grade,direction:parsed.direction||null,distanceM:parsed.distanceM},quality});
  observeRunCount++;
  if(parsed.grade==='great')observeRunGreat++;
}
function safeNoRegressionAdvancePx(record){
  // Counterfactual only: approximate how much earlier the previous visible
  // observation would have fired, holding the original predictive term fixed.
  // Never turn a previously PERFECT visible event into an earlier frame solely
  // to repair LATE grades elsewhere.
  if(!record||record.feedbackGrade!=='perfect'||record.triggerSource!=='visible')return null;
  const frames=record.frameTrace?.before||[],prev=frames[frames.length-2];
  if(!prev||!Number.isFinite(prev.y)||!Number.isFinite(record.adaptivePredictionPx)||!Number.isFinite(record.triggerLineY))return null;
  const previouslyApplied=(record.appliedCorrection||0)+(record.autoCorrectionPx||0);
  if(Math.abs(previouslyApplied)>.05)return null; // bound from uncorrected PERFECT only
  return Math.max(0,round(record.triggerLineY-prev.y-record.adaptivePredictionPx-AUTO_TUNE.perfectSafetyMarginPx,3));
}
// Reconstruct the last runs' graded quality evidence from ORIGINAL local JSON.
// This upgrades old observation-only traces after code updates without inventing
// grades or modifying the source records. Called once on race start, never per frame.
function hasWheelLockEvidence(run){return !!run?.wheelLockObservations?.length||/휠\s*락|wheel\s*lock/i.test(run?.wheelLockResultEvidence?.text||'');}
function restoreRecentTireEvidence(runs){
  if(!observeState?.events||!Array.isArray(runs))return;
  const rebuilt=new Map();
  for(const old of runs.slice(-40)){
    if(!old?.complete||hasWheelLockEvidence(old)||old.vehicleKey!==observeState.identity||!Array.isArray(old.history)||!old.history.length)continue;
    if(old.history.some(x=>!x.feedbackGrade))continue; // all events must be graded
    for(const record of old.history){
      if(!validCorrectionSample(record))continue;
      const band=record.speed>=.19?'high':record.speed>=.12?'medium':'low';
      const key=record.eventKey+'|'+band;
      if(!rebuilt.has(key))rebuilt.set(key,[]);
      rebuilt.get(key).push({
        runId:old.runId,grade:record.feedbackGrade,
        direction:record.feedbackDirection||null,speed:record.speed,
        triggerSource:record.triggerSource,appliedPx:record.autoCorrectionPx||0,
        safeAdvancePx:safeNoRegressionAdvancePx(record),measuredDistanceM:record.feedbackDistanceM
      });
    }
  }
  for(const [key,items] of rebuilt){
    const entry=observeState.events[key]||{};
    const merged=new Map();
    for(const e of entry.qualityRecent||[])if(e?.runId)merged.set(e.runId,e);
    for(const e of items)if(e?.runId)merged.set(e.runId,e);
    entry.qualityRecent=[...merged.values()].slice(-16);
    observeState.events[key]=entry;
  }
}
function commitCompletedObservations(){
  if(!observeState||!observeKey||!observePending.length)return false;
  for(const {record,parsed,quality} of observePending){
    const band=record.observeSpeedBand;
    const key=record.eventKey+'|'+band;
    const entry=observeState.events[key]||{samples:0,perfect:0,great:0,good:0,bad:0,miss:0,late:0,early:0,measuredDistanceCount:0,signedDistanceSumM:0,speedSumPxMs:0,firstRunId:runId,lastRunId:runId};
    entry.samples++;
    entry[parsed.grade]=(entry[parsed.grade]||0)+1;
    if(parsed.direction==='late'||parsed.direction==='early'){
      entry[parsed.direction]=(entry[parsed.direction]||0)+1;
      if(Number.isFinite(parsed.distanceM)){
        entry.measuredDistanceCount++;
        entry.signedDistanceSumM+=(parsed.direction==='late'?1:-1)*parsed.distanceM;
      }
    }
    entry.speedSumPxMs+=Number(record.speed)||0;
    entry.lastRunId=runId;
    if(quality){
      const recent=Array.isArray(entry.qualityRecent)?entry.qualityRecent:[];
      if(!recent.some(x=>x.runId===runId))
        recent.push({runId,grade:parsed.grade,direction:parsed.direction||null,
          speed:record.speed,triggerSource:record.triggerSource,appliedPx:record.autoCorrectionPx||0,
          safeAdvancePx:safeNoRegressionAdvancePx(record),measuredDistanceM:parsed.distanceM});
      entry.qualityRecent=recent.slice(-16);
    }
    observeState.events[key]=entry;
    observeState.totalFeedback=(observeState.totalFeedback||0)+1;
  }
  observeState.updatedAt=new Date().toISOString();
  try{
    localStorage.setItem(observeKey,JSON.stringify(observeState));
    observeCommitted=true;observePending=[];
    return true;
  }catch(_){return false;}
}

// Experimental Stage 2: conservative, inter-run, confidence-gated automatic offset.
function autoLeadPreview(eventKey,speed){
  const empty={px:0,samples:0,runs:0,reason:'insufficient-or-manual'};
  if(!observeState||profile||(correction[eventKey]||0)!==0||!(Number.isFinite(speed)&&speed>0))return empty;
  // vehicleKey -> exact track/car/grade/star/tire. NEVER transfer offsets from
  // one tire to another, and never assume that a tire has a fixed speed multiplier.
  const band=speed>=.19?'high':speed>=.12?'medium':'low';
  const recent=observeState.events?.[eventKey+'|'+band]?.qualityRecent;
  if(!Array.isArray(recent))return empty;
  const tolerance=Math.max(AUTO_TUNE.speedTolerancePxMs,speed*AUTO_TUNE.speedToleranceFraction);
  const matches=recent.filter(x=>Number.isFinite(x.speed)&&Math.abs(x.speed-speed)<=tolerance);
  const unique=[...new Set(matches.map(x=>x.runId))].length;
  const basis={px:0,samples:matches.length,runs:unique,reason:'insufficient-speed-matched'};
  if(matches.length<AUTO_TUNE.minSamples||unique<AUTO_TUNE.minRuns)return basis;
  // A single EARLY observation contraindicates further advance at this speed.
  const early=matches.filter(x=>x.grade!=='perfect'&&x.direction==='early');
  if(early.length)return {...basis,reason:'early-safety-block'};
  const late=matches.filter(x=>x.grade!=='perfect'&&x.direction==='late'&&!(x.appliedPx>0.05));
  const correctedWins=matches.filter(x=>x.grade==='perfect'&&x.appliedPx>0.05);
  const relevant=(late.length>=AUTO_TUNE.minDirectional&&late.length/matches.length>=AUTO_TUNE.directionalFraction)
    ?late:(correctedWins.length>=2?correctedWins:null);
  if(!relevant)return {...basis,reason:'mixed-or-perfect'};
  const sortedSpeeds=relevant.map(x=>x.speed).sort((a,b)=>a-b);
  const center=sortedSpeeds[Math.floor(sortedSpeeds.length/2)];
  if(Math.abs(speed-center)>AUTO_TUNE.directionalSpeedTolerancePxMs)
    return {...basis,reason:'tire-event-speed-mismatch'};
  // Up to half a *measured* frame of marker motion: controlled subframe
  // adaptation, NOT a change to the frozen predict() / ENGINE.
  const proposedPx=clamp(speed*averageFrameMs*AUTO_TUNE.frameFraction,0,AUTO_TUNE.maxPx);
  // Existing clean PERFECT results act as a per-event, per-tire regression bound.
  // Do not advance their preceding visible frame in the static proxy.
  const perfectLimit=matches.filter(x=>x.grade==='perfect'&&!((x.appliedPx||0)>.05)
    &&Math.abs(x.speed-speed)<=AUTO_TUNE.directionalSpeedTolerancePxMs
    &&Number.isFinite(x.safeAdvancePx))
    .reduce((min,x)=>Math.min(min,x.safeAdvancePx),Infinity);
  const px=round(clamp(Math.min(proposedPx,perfectLimit),0,AUTO_TUNE.maxPx),3);
  if(px<.15)return {...basis,reason:'perfect-regression-bound'};
  return {...basis,px,reason:relevant===late?'tire-event-speed-verified-late':'tire-event-corrected-perfect-hold'};
}

function evaluateShortGapCoast(track,now) {
  if(track.triggered||track.suppressed||track.observationCount<COAST_GUARD.minObservations)return null;
  const age=now-track.lastTime;
  if(!(age>0&&age<=COAST_GUARD.maxAgeMs)||track.missing>4)return null;
  if(track.lastObservationGapMs>COAST_GUARD.maxPriorGapMs)return null;
  if(!(track.speed>=COAST_GUARD.minSpeed&&track.speed<=COAST_GUARD.maxSpeed))return null;
  const samples=track.traceWindow?.slice(-COAST_GUARD.minTrace)||[];
  if(samples.length<COAST_GUARD.minTrace)return null;
  const speeds=[];
  for(let i=1;i<samples.length;i++){
    const dt=samples[i].t-samples[i-1].t,dy=samples[i].y-samples[i-1].y;
    if(!(dt>0&&dt<=COAST_GUARD.maxRecentGapMs&&dy>0))return null;
    speeds.push(dy/dt);
  }
  if(Math.max(...speeds)-Math.min(...speeds)>COAST_GUARD.maxSpeedSpread)return null;
  const sorted=[...speeds].sort((a,b)=>a-b),median=sorted[Math.floor(sorted.length/2)];
  if(Math.abs(track.speed-median)>COAST_GUARD.maxTrackSpeedDiscrepancy)return null;
  const boost=track.type.startsWith('boost');
  const target=boost?cfg.boostY:cfg.brakeY,offset=boost?cfg.boostOffset:cfg.brakeOffset;
  const triggerLine=target-cfg.tolerance;
  if(track.y>=triggerLine||triggerLine-track.y>COAST_GUARD.nearTriggerPx)return null;
  const key=track.type+':'+(eventSequence+1),prediction=predict(track);
  const autoLead=autoLeadPreview(key,track.speed);
  const estimate=track.y+track.speed*age;
  const predictedY=estimate+prediction.predictionPx+offset+(correction[key]||0)+autoLead.px;
  const overshoot=predictedY-triggerLine;
  if(overshoot<0||overshoot>COAST_GUARD.maxPredictedOvershootPx)return null;
  return {key,prediction,autoLead,target,predictedY,meta:{
    source:'short-gap-coast',gapMs:round(age,2),estimatedMarkerY:round(estimate,2),
    observedMarkerY:round(track.y,2),medianRecentSpeed:round(median,5),
    predictedOvershootPx:round(overshoot,3)
  }};
}
function tryShortGapCoast(track,now){
  const candidate=evaluateShortGapCoast(track,now);
  if(!candidate)return false;
  const ok=executeEvent(track,candidate.predictedY,candidate.prediction,candidate.key,candidate.target,candidate.autoLead,candidate.meta);
  if(!ok)return false;
  track.triggered=true;
  detectionHealth.coastTriggers++;
  recordDetectionAlert('short-gap-coast-trigger',track,now,{eventKey:candidate.key,...candidate.meta});
  return true;
}
function shouldSuppressLateSpawn(firstY,triggerLineY){
  return firstY>triggerLineY+DETECTION_GUARD.lateSpawnSlackPx;
}
function recordDetectionAlert(kind,track,time,details={}){
  if(detectionAlerts.length>=DETECTION_GUARD.maxAlerts)return;
  detectionAlerts.push({kind,type:track.type,t:round(time,2),y:round(track.y,2),firstSeenY:round(track.firstSeenY,2),...details});
}
// Capture short numerical marker traces, not screenshots; bounded memory per event.
function captureTrackFrame(track,now){
  if(!Array.isArray(track.traceWindow))track.traceWindow=[];
  const frame={t:round(now,2),y:round(track.y,2),speed:round(track.speed,5),acceleration:round(track.acceleration,7),frameMs:round(averageFrameMs,3),observationGapMs:round(track.lastObservationGapMs||0,2)};
  track.traceWindow.push(frame);
  if(track.traceWindow.length>TRACE_PRE)track.traceWindow.shift();
  const pending=track.tracePending;
  if(!pending)return;
  const age=now-pending.at;
  if(age>0&&age<=TRACE_WINDOW_MS&&pending.record.frameTrace.after.length<TRACE_POST)pending.record.frameTrace.after.push(frame);
  if(age>TRACE_WINDOW_MS||pending.record.frameTrace.after.length>=TRACE_POST)track.tracePending=null;
}
function beginEventTrace(track,record,at){
  record.frameTrace={schema:1,before:(track.traceWindow||[]).slice(-TRACE_PRE),after:[],windowMs:TRACE_WINDOW_MS};
  track.tracePending={record,at};
}

function scopeForCourse(id,name){return (id==='editor-v1'||id==='unknown-course')?id+'::'+name:id;}
function detectCourse(){
  const doc=game();if(!doc)return;
  const source=[...doc.querySelectorAll('script')].map(el=>el.textContent||'').join('\n');
  const id=source.match(/"id"\s*:\s*"([^"]+)"/)?.[1]||'unknown-course';
  const name=source.match(/"name"\s*:\s*"([^"]+)"/)?.[1]||'알 수 없는 코스';
  const scope=scopeForCourse(id,name);
  if(scope!==courseScope){
    courseId=id;courseName=name;courseScope=scope;
    loadSettings();loadLearning();
  }else{courseId=id;courseName=name;}
  render();
}
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
let stopAfterCurrent=false,chainEnabled=false,chainState='대기',chainTimer=null,chainDeadline=0,chainNextAt=0,chainRuns=0,chainMaxRuns=0,chainPendingReturn=false,chainTire=null,chainCounts=null;
function chainSay(m){chainState=m;setMessage('연속 주행: '+m);}
function gameButtons(){const doc=game();return doc?[...doc.querySelectorAll('button,[role="button"]')].filter(visible):[];}
function readTireCounts(){
  const buttons=gameButtons(),out={};
  for(const [key,re] of Object.entries(tireNames)){
    const found=buttons.map(el=>({el,text:textOf(el)})).filter(x=>re.test(x.text)&&/\d\s*(?:개|회|\/\s*[56])/.test(x.text));
    const exact=found.filter(x=>x.text.length<85);
    if(exact.length!==1)return null;
    const t=exact[0].text;
    const m=t.match(/(?:하드|미디엄|미디움|소프트|HARD|MEDIUM|SOFT)[\s\S]{0,35}?(\d)\s*(?:개|회|\/\s*[56])/i)||t.match(/(?:^|\s)(\d)\s*(?:개|회)(?:\s|$)/);
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
  // Never launch another race until the previous race's overflow archive transaction commits.
  if(lastRunPersistence.status==='archive-pending')return;
  if(lastRunPersistence.status==='failed'){stopChain('기록 저장 실패 · 안전 중단',false);return;}
  const t=Date.now();if(t<chainNextAt)return;
  if(running){chainDeadline=0;return;}
  // Only after the current race has ended and been saved. Never touch the game mid-race.
  if(chainMaxRuns>0&&chainRuns>=chainMaxRuns){
    stopChain('사전 예약 '+chainMaxRuns+'판 완주 · 기록 저장 후 연속 종료',false);
    return;
  }
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
function requestGracefulStop(){
  if(running){stopAfterCurrent=true;if(chainEnabled)chainSay('현재 판 완주 후 연속 주행 중지 예약');else setMessage('현재 판 완주 후 중지 예약 · 주행 계속');return;}
  if(chainEnabled){stopChain('다음 판 시작 전 사용자 중지',false);return;}
  setMessage('진행 중인 AUTO 주행 없음');
}
function forceStopNow(){stopAfterCurrent=false;if(chainEnabled)stopChain('긴급 즉시 중지',true);else stop();}
function startChain(){
  if(chainEnabled||running){setMessage('이미 주행 중입니다. 중지 후 연속 시작하세요');return;}
  if(!game()||!root()){setMessage('타임어택 화면을 찾지 못했습니다');return;}
  const limitInput=$('#chain-run-limit');
  const limit=Number(limitInput?.value??'0');
  if(!Number.isInteger(limit)||limit<0||limit>18){setMessage('연속 횟수는 0~18 사이의 정수만 허용');return;}
  chainMaxRuns=limit;
  chainEnabled=true;chainRuns=0;chainDeadline=0;chainNextAt=0;chainPendingReturn=false;
  chainTimer=setInterval(chainTick,350);chainSay('화면 확인 및 자동 준비 중 · 예약 '+(chainMaxRuns?chainMaxRuns+'판':'남은 타이어 모두'));chainTick();collapsePanel();
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

function vehicleKey(v){return [v?.name||'unknown',v?.grade||'unknown',v?.stars||'unknown',v?.tire||'unknown',courseScope].join('|');}
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
// Durable overflow archive. Never remove legacy localStorage records automatically.
// IndexedDB is shared by the AUTO engine and the unified uploader on this origin.
const RUN_ARCHIVE_DB='dopamine-auto-record-archive-v1',RUN_ARCHIVE_STORE='runs';
let archiveConnection=null;
function openRunArchive(){
  if(archiveConnection)return archiveConnection;
  archiveConnection=new Promise((resolve,reject)=>{
    if(!window.indexedDB){reject(Error('IndexedDB unavailable'));return;}
    let req;
    try{req=window.indexedDB.open(RUN_ARCHIVE_DB,1);}catch(e){reject(e);return;}
    req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(RUN_ARCHIVE_STORE))req.result.createObjectStore(RUN_ARCHIVE_STORE,{keyPath:'runId'});};
    req.onsuccess=()=>{const db=req.result;db.onversionchange=()=>{db.close();archiveConnection=null;};resolve(db);};
    req.onerror=()=>{archiveConnection=null;reject(req.error||Error('IndexedDB open failed'));};
    req.onblocked=()=>{archiveConnection=null;reject(Error('IndexedDB blocked'));};
  });
  return archiveConnection;
}
const runArchive={
  async put(run){if(!run?.runId)throw Error('Missing runId');const db=await openRunArchive();return new Promise((resolve,reject)=>{
    const tx=db.transaction(RUN_ARCHIVE_STORE,'readwrite');
    tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error||Error('Archive write failed'));tx.onabort=()=>reject(tx.error||Error('Archive write aborted'));
    tx.objectStore(RUN_ARCHIVE_STORE).put(run);
  });},
  async putMany(runs){const valid=(runs||[]).filter(r=>r&&r.runId);if(!valid.length)return 0;const db=await openRunArchive();return new Promise((resolve,reject)=>{
    const tx=db.transaction(RUN_ARCHIVE_STORE,'readwrite');
    tx.oncomplete=()=>resolve(valid.length);tx.onerror=()=>reject(tx.error||Error('Archive backfill failed'));tx.onabort=()=>reject(tx.error||Error('Archive backfill aborted'));
    const store=tx.objectStore(RUN_ARCHIVE_STORE);
    for(const run of valid)store.put(run);
  });},
  async firstUnsent(sent){const db=await openRunArchive();return new Promise((resolve,reject)=>{
    const tx=db.transaction(RUN_ARCHIVE_STORE,'readonly'),store=tx.objectStore(RUN_ARCHIVE_STORE),keys=store.getAllKeys();
    keys.onerror=()=>reject(keys.error||Error('Archive scan failed'));
    keys.onsuccess=()=>{
      const id=keys.result.find(key=>!sent.has(key));
      if(!id){resolve(null);return;}
      const get=store.get(id);get.onsuccess=()=>resolve(get.result||null);get.onerror=()=>reject(get.error||Error('Archive read failed'));
    };
  });},
  async all(){const db=await openRunArchive();return new Promise((resolve,reject)=>{
    const req=db.transaction(RUN_ARCHIVE_STORE,'readonly').objectStore(RUN_ARCHIVE_STORE).getAll();
    req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error||Error('Archive export failed'));
  });}
};
window.__duRunArchive=runArchive;
let lastRunPersistence={status:'none',runId:null,error:null};
function readSavedRuns(){try{const a=JSON.parse(localStorage.getItem(ANALYSIS_KEY)||'[]');return Array.isArray(a)?a:[];}catch(_){return [];}}
function saveRun(reason){
  if(!runId||runFinalized)return; // Persist even zero-event interrupted attempts for diagnosis.
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
  const explicitResultTime=complete?readExplicitResultTime():null;
  // Finish-phase HUD value is the game's displayed lap time, not the browser stopwatch.
  // Re-read immediately before saving to capture result-phase updates and wheel-lock penalties.
  const finishHud=complete?readGameClock():null;
  if(complete&&finishHud&&finishHud.seconds>0&&(gameClockLast===null||finishHud.seconds+0.05>=gameClockLast)){
    gameClockAtFinish=finishHud.seconds;gameClockLast=finishHud.seconds;gameClockSource=finishHud.source;
  }
  if(complete&&!wheelLockAtFinish)wheelLockAtFinish=readWheelLockResult();
  const recordedLapTimeSec=complete?(explicitResultTime?.seconds??(Number.isFinite(gameClockAtFinish)&&gameClockAtFinish>0?gameClockAtFinish:null)):null;
  const recordedLapTimeSource=recordedLapTimeSec===null?null:explicitResultTime?'game-explicit-result':'game-hud-at-finish';
  const gameTiming={
    recordedLapTimeSec,recordedLapTimeSource,
    recordedLapTimeStatus:recordedLapTimeSec===null?'not-detected':explicitResultTime?'explicit-final-result':'hud-finish-observed-not-officially-verified',
    resultTimeSec:explicitResultTime?.seconds??null,resultTimeSource:explicitResultTime?.source??null,
    hudLastTimeSec:gameClockLast,hudAtFinishSec:complete?gameClockAtFinish:null,hudSource:gameClockSource,
    clockSampleCount:gameClockCount,hudClockTrace:gameClockTrace.slice(),
    clientDifferenceSec:recordedLapTimeSec!==null&&observedRaceDurationMs!==null?round(recordedLapTimeSec-observedRaceDurationMs/1000,3):null,
    warning:'Use recordedLapTimeSec from the game result/HUD; client elapsed is separate. A finish HUD value is not guaranteed to include all official penalties.'
  };
  const wheelTrainingBlocked=wheelLockObservations.length>0||hasWheelLockEvidence({wheelLockResultEvidence:wheelLockAtFinish});
   const observationCommitted=complete&&allEvents&&!wheelTrainingBlocked?commitCompletedObservations():false;
  const result={runId,version:VERSION,courseId,courseName,courseScope,vehicle:profileAtStart,vehicleKey:vehicleKey(profileAtStart),manualProfile:profile||null,
    observationLearning:{mode:'tire-speed-exact-event-confidence-gated',committed:observationCommitted,excludedReason:observationCommitted?null:!complete?'incomplete':!allEvents?'ungraded-events':wheelTrainingBlocked?'wheel-lock-sequence-unreliable':'no-eligible-observation-or-storage-failed',profileKey:observeState?.identity||null,runFeedback:observeRunCount,runGreat:observeRunGreat,eligibleFeedback:history.filter(x=>x.autoLearningEligible).length,totalProfileFeedback:observeState?.totalFeedback||0,autoCorrectionAppliedEvents:history.filter(x=>x.autoCorrectionPx!==0).length,minSamples:AUTO_TUNE.minSamples},traceCapture:{beforeFrames:TRACE_PRE,afterFrames:TRACE_POST,windowMs:TRACE_WINDOW_MS},
    reason,complete,observedRaceDurationMs,observedRaceDurationSec:observedRaceDurationMs===null?null:round(observedRaceDurationMs/1000,3),raceDurationSource:observedRaceDurationMs===null?null:'client-start-light-to-first-finish-phase',gameTiming,wheelLockResultEvidence:complete?wheelLockAtFinish:null,wheelLockObservations:wheelLockObservations.slice(),crossTrackFeedback:summarizeCrossTrackFeedback(),completionEvidence:{allEvents,allSegments,phase:root()?.dataset.phase||null},detectionHealth:{...detectionHealth},detectionAlerts:detectionAlerts.slice(),shortGapCoast:{enabled:true,guard:{...COAST_GUARD},triggeredCount:detectionHealth.coastTriggers},sparseBoostCoast:{enabled:true,guard:{...SPARSE_BOOST_GUARD},triggeredCount:detectionHealth.sparseBoostTriggers},nearBoostOffGap:{enabled:true,guard:{...NEAR_BOOST_GAP_GUARD},triggeredCount:detectionHealth.nearBoostGapTriggers},sideBoostScan:{enabled:true,guard:{...SIDE_BOOST_SCAN},bands:detectionHealth.sideBoostBands},wideBoostScan:{enabled:true,guard:{...WIDE_BOOST_SCAN},scans:detectionHealth.wideBoostScans,bands:detectionHealth.wideBoostBands,ambiguous:detectionHealth.wideBoostAmbiguous,triggers:detectionHealth.wideBoostTriggers},ungradedEventKeys:history.filter(x=>x.feedbackGrade===null).map(x=>x.eventKey),time:new Date().toISOString(),
    // Keep the canonical instant in UTC and add its KST ISO-8601 representation.
    // Using the UTC instant (rather than the device's local clock formatting) avoids a second +9h shift.
    timeKst:null,timeZone:'Asia/Seoul',
    events:history.length,grades,displayTopSpeedKmh:profileAtStart?.displayTopSpeedKmh??null,
    measuredMaxSpeedKmh:analysisMaxSpeed,meanAccelerationKmhPerSec:accel.length?round(accel.reduce((s,x)=>s+x,0)/accel.length,4):null,
    medianPositiveAccelerationKmhPerSec:median(positive),maxAccelerationKmhPerSec:accel.length?accel[accel.length-1]:null,
    rejectedAccelerationSamples:telemetryRejects,maxMarkerSpeedPxMs:universalStats.maximumSpeed,
    segmentSpeedsKmh:segmentResults.map(s=>s.speedKmh).filter(x=>x!==null),
    history:history.map(x=>({...x})),feedbackLog:feedbackLog.map(x=>({...x})),segmentResults:segmentResults.map(x=>({...x})),
    speedSamples:analysisSamples.slice(),accelerationSamples:analysisAccel.slice()};
  // Convert the exact same UTC instant to Asia/Seoul (fixed UTC+09, no daylight saving).
  result.timeKst=new Date(Date.parse(result.time)+9*60*60*1000).toISOString().replace('Z','+09:00');
  runs.push(result);
  const completedTiming={...gameTiming,clientElapsedSec:observedRaceDurationMs===null?null:round(observedRaceDurationMs/1000,3),complete};
  // Start a second independent, durable write. Its result is checked below if the
  // synchronous legacy localStorage save cannot fit another large telemetry JSON.
  let archiveWrite;
  try{archiveWrite=runArchive.put(result);}catch(e){archiveWrite=Promise.reject(e);}
  let localSaved=false,localError=null;
  try{
    // If legacy JSON became unreadable, never overwrite its raw bytes with an empty list.
    const previous=localStorage.getItem(ANALYSIS_KEY);
    if(previous&& !Array.isArray(JSON.parse(previous)))throw Error('Existing run index invalid');
    localStorage.setItem(ANALYSIS_KEY,JSON.stringify(runs.slice(-MAX_RUNS)));
    localSaved=true;
  }catch(e){localError=String(e?.message||e);}
  // A completed race must never be silently considered safely recorded after a failed write.
  runFinalized=true;
  if(localSaved){
    savedRunCount=Math.min(runs.length,MAX_RUNS);lastSavedTiming=completedTiming;
    lastRunPersistence={status:'local',runId:result.runId,error:null};
    archiveWrite.catch(e=>console.warn('[Dopamine AUTO] Additional archive write failed:',String(e)));
  }else{
    lastRunPersistence={status:'archive-pending',runId:result.runId,error:localError};
    window.__duUnsavedRun=result; // last-chance in-memory export while backup completes
    setMessage('⚠ 브라우저 용량 초과 · IndexedDB 보관 중 (페이지 이동 금지)');
    archiveWrite.then(()=>{
      if(window.__duUnsavedRun?.runId===result.runId)window.__duUnsavedRun=null;
      lastRunPersistence={status:'archive',runId:result.runId,error:null};
      savedRunCount=readSavedRuns().length+1;lastSavedTiming=completedTiming;
      setMessage('✓ 원본 별도 보관 완료 · Google Sheets 전송 대기');
    }).catch(e=>{
      lastRunPersistence={status:'failed',runId:result.runId,error:localError+' / '+String(e?.message||e)};
      if(chainEnabled)stopChain('기록 저장 실패 · 데이터 보호를 위해 연속 주행 중단',false);
      setMessage('⛔ 주행 기록 영구 저장 실패 · ⚙ 도구에서 긴급 JSON 백업 필요');
    });
  }
}
function classify(r,g,b){if(Math.max(r,g,b)<95)return null;let bestType=null,bestDistance=Infinity;for(const [type,c] of Object.entries(COLORS)){const d=Math.hypot(r-c[0],g-c[1],b-c[2]);if(d<bestDistance){bestDistance=d;bestType=type;}}return bestDistance<=cfg.colorTolerance?bestType:null;}
function scanColumnBands(canvas,x,top,bottom){
  if(x<0||x>=canvas.width||bottom<=top)return [];
  let pixels;try{pixels=canvas.getContext('2d').getImageData(x,top,1,bottom-top).data;}catch(_){return [];}
  const bands=[];let current=null;
  function finish(){if(current&&current.count>=cfg.minBandPixels)bands.push({type:current.type,y:(current.start+current.end)/2});}
  for(let i=0;i<bottom-top;i++){
    const p=i*4,y=top+i,type=classify(pixels[p],pixels[p+1],pixels[p+2]);
    if(type&&current&&current.type===type&&y-current.end<=2){current.end=y;current.count++;}
    else{finish();current=type?{type,start:y,end:y,count:1}:null;}
  }
  finish();return bands;
}
// Find one unambiguous same-side pair. Opposite-side matches alone do not prove a band.
function chooseWideBoostBand(columns,expected,guard=WIDE_BOOST_SCAN){
  const pairs=[];
  for(let i=1;i<columns.length;i++){
    const a=columns[i-1],b=columns[i];
    if(Math.sign(a.offset)!==Math.sign(b.offset)||b.offset-a.offset!==24)continue;
    for(const p of a.bands)for(const q of b.bands){
      if(p.type===expected&&q.type===expected&&Math.abs(p.y-q.y)<=guard.maxYDifferencePx)
        pairs.push({y:(p.y+q.y)/2,offsets:[a.offset,b.offset]});
    }
  }
  if(!pairs.length)return {band:null,ambiguous:false};
  const ys=pairs.map(p=>p.y);
  if(Math.max(...ys)-Math.min(...ys)>guard.maxYDifferencePx)return {band:null,ambiguous:true};
  const chosen=pairs.reduce((a,b)=>Math.abs(a.offsets[0])+Math.abs(a.offsets[1])<=Math.abs(b.offsets[0])+Math.abs(b.offsets[1])?a:b);
  return {band:{type:expected,y:chosen.y,readSource:'verified-wide-columns',wideOffsets:chosen.offsets},ambiguous:false};
}
function scanWideBoostBands(canvas,x,top,bottom,expected){
  const g=WIDE_BOOST_SCAN,lo=Math.max(0,x+g.offsets[0]),hi=Math.min(canvas.width-1,x+g.offsets.at(-1));
  if(hi<lo||bottom<=top)return {band:null,ambiguous:false};
  const width=hi-lo+1;
  let pixels;try{pixels=canvas.getContext('2d').getImageData(lo,top,width,bottom-top).data;}catch(_){return {band:null,ambiguous:false};}
  const columns=[];
  for(const offset of g.offsets){
    const cx=x+offset;if(cx<lo||cx>hi)continue;
    const bands=[];let start=-1,end=-1,count=0;
    function finish(){if(count>=cfg.minBandPixels)bands.push({type:expected,y:(start+end)/2});start=-1;end=-1;count=0;}
    for(let y=top;y<bottom;y++){
      const p=((y-top)*width+cx-lo)*4;
      if(classify(pixels[p],pixels[p+1],pixels[p+2])===expected){
        if(count&&y-end>2)finish();
        if(!count)start=y;
        end=y;count++;
      }else finish();
    }
    finish();columns.push({offset,bands});
  }
  return chooseWideBoostBand(columns,expected);
}
function scanBands(now){
  const canvas=game()?.querySelector('canvas[aria-label="타임어택 주행 트랙"]');
  if(!canvas)return [];
  const x=Math.round(cfg.scanX),top=clamp(Math.floor(cfg.scanTop),0,canvas.height),
    bottom=clamp(Math.ceil(cfg.scanBottom),0,canvas.height);
  if(x<0||x>=canvas.width||bottom<=top)return [];
  const primary=scanColumnBands(canvas,x,top,bottom);
  const extra=[];
  // Preserve the v3.3.41 fallback exactly when its original conditions hold.
  if(boostHeld&&boostExpected==='boostOff'&&!primary.some(b=>b.type==='boostOff')
      &&now-lastSideBoostScanAt>=SIDE_BOOST_SCAN.scanIntervalMs){
    lastSideBoostScanAt=now;
    const left=scanColumnBands(canvas,x-SIDE_BOOST_SCAN.offsetPx,top,bottom);
    const right=scanColumnBands(canvas,x+SIDE_BOOST_SCAN.offsetPx,top,bottom);
    for(const band of left){
      if(band.type!=='boostOff')continue;
      const peer=right.find(b=>b.type==='boostOff'&&Math.abs(b.y-band.y)<=SIDE_BOOST_SCAN.maxYDifferencePx);
      if(!peer)continue;
      const y=(band.y+peer.y)/2;
      if(primary.some(b=>b.type==='boostOff'&&Math.abs(b.y-y)<=8))continue;
      extra.push({type:'boostOff',y,readSource:'verified-side-columns'});
      detectionHealth.sideBoostBands++;
      if(extra.length>=2)break;
    }
  }
  const combined=primary.concat(extra),g=WIDE_BOOST_SCAN,line=cfg.boostY-cfg.tolerance;
  const expected=boostHeld&&boostExpected==='boostOff'?'boostOff':!boostHeld&&boostExpected==='boostOn'&&(cfg.boostZones===0||boostOnCount<cfg.boostZones)?'boostOn':null;
  if(!expected||combined.some(b=>b.type===expected&&b.y>=line-g.centerNearPx&&b.y<=line+g.maxPastPx)
      ||now-lastWideBoostScanAt<g.scanIntervalMs)return combined;
  const scanTop=Math.max(top,Math.floor(line-g.nearPx)),scanBottom=Math.min(bottom,Math.ceil(line+g.maxPastPx+1));
  if(scanBottom<=scanTop)return combined;
  lastWideBoostScanAt=now;detectionHealth.wideBoostScans++;
  const candidate=scanWideBoostBands(canvas,x,scanTop,scanBottom,expected);
  lastWideBoostEvidence={at:round(now,2),expected,y:candidate.band?.y??null,offsets:candidate.band?.wideOffsets??null,ambiguous:candidate.ambiguous};
  if(candidate.ambiguous)detectionHealth.wideBoostAmbiguous++;
  if(!candidate.band||combined.some(b=>b.type===expected&&Math.abs(b.y-candidate.band.y)<=8))return combined;
  detectionHealth.wideBoostBands++;return combined.concat(candidate.band);
}
function wideBoostTrackReady(track,line){
  const g=WIDE_BOOST_SCAN;
  return track.wideConsecutive>=2&&track.firstSeenY<line&&track.y<=line+g.maxPastPx
    &&track.lastObservationGapMs>0&&track.lastObservationGapMs<=g.maxObservationGapMs
    &&track.wideForwardMotion===true&&track.speed>=g.minSpeed&&track.speed<=g.maxSpeed;
}
function wideBoostMatch(track,band,now){
  const dt=now-track.lastTime,delta=band.y-track.y;
  if(!(dt>0&&dt<=WIDE_BOOST_SCAN.maxObservationGapMs)||delta<-.5||delta>WIDE_BOOST_SCAN.maxSpeed*dt+3)return false;
  return Math.abs(delta-Math.max(0,track.speed||0)*dt)<=Math.max(4,dt*.12);
}
function updateFrameTiming(now){if(lastFrameTime){const dt=now-lastFrameTime;if(dt>DETECTION_GUARD.rafGapMs){detectionHealth.rafLongGaps++;detectionHealth.maxRafGapMs=Math.max(detectionHealth.maxRafGapMs,dt);}if(dt>0&&dt<=ENGINE.maxFrameMs)averageFrameMs=averageFrameMs*.85+dt*.15;}lastFrameTime=now;}
function updateAcceleration(track,speed,dt){if(dt<4||dt>60||!Number.isFinite(speed))return;const previous=track.previousInstantSpeed;track.previousInstantSpeed=speed;if(!Number.isFinite(previous))return;const raw=(speed-previous)/dt;if(!Number.isFinite(raw)||Math.abs(raw)>ENGINE.accelerationMaxAbs){track.accelerationStable=false;universalStats.accelerationRejected++;return;}track.acceleration=track.acceleration*(1-ENGINE.accelerationSmoothing)+raw*ENGINE.accelerationSmoothing;track.accelerationSamples++;universalStats.accelerationSamples++;track.accelerationStable=Math.abs(raw-track.acceleration)<=ENGINE.accelerationStableThreshold;}
// v3.3.5 predict(): 숫자·조건·보정식 그대로 유지.
function predict(track){const speed=Math.max(0,track.speed);const adaptiveMs=clamp(averageFrameMs*ENGINE.frameFactor,0,ENGINE.maxAdaptiveMs);const leadMs=Math.max(0,adaptiveMs+cfg.predictionMs);const basePredictionPx=clamp(speed*leadMs,0,ENGINE.maxPredictionPx);const speedRatio=clamp((speed-ENGINE.highSpeedStart)/(ENGINE.highSpeedFull-ENGINE.highSpeedStart),0,1);const frameAdvancePx=clamp(speed*averageFrameMs*ENGINE.frameLookaheadFactor*speedRatio,0,ENGINE.maxHighSpeedAdvancePx);let accelerationPx=0,accelerationUsed=false;if(track.accelerationSamples>=ENGINE.accelerationMinSamples&&track.accelerationStable&&speedRatio>0){const extra=.5*track.acceleration*leadMs*leadMs;accelerationPx=clamp(extra*speedRatio,-ENGINE.accelerationMaxPx,ENGINE.accelerationMaxPx);accelerationUsed=Math.abs(accelerationPx)>=.02;}const highSpeedAdvancePx=frameAdvancePx;const predictionPx=clamp(basePredictionPx+highSpeedAdvancePx+accelerationPx,0,ENGINE.maxPredictionPx+ENGINE.maxHighSpeedAdvancePx+ENGINE.accelerationMaxPx);const highSpeedUsed=highSpeedAdvancePx>.01;return {speed,leadMs,basePredictionPx,frameAdvancePx,highSpeedAdvancePx,accelerationPx,accelerationUsed,highSpeedUsed,predictionPx,predictionMode:highSpeedUsed?'high-speed-lookahead':'release-2.0'};}
function executeEvent(track,predictedY,prediction,eventKey,target,autoLead,triggerMeta=null){const type=track.type;let success=false;if(type==='brakeOn'&&!brakeHeld)success=brake(true);else if(type==='brakeOff'&&brakeHeld)success=brake(false);else if(type==='boostOn'&&boostExpected==='boostOn'&&!boostHeld&&(cfg.boostZones===0||boostOnCount<cfg.boostZones)){success=boost(true);if(success)boostExpected='boostOff';}else if(type==='boostOff'&&boostExpected==='boostOff'&&boostHeld){success=boost(false);if(success)boostExpected='boostOn';}if(!success)return false;const time=nowMs(),previous=history[history.length-1];eventSequence++;const record={sequence:eventSequence,eventKey,type,event:LABELS[type],markerReadSource:track.lastMarkerReadSource||'center',sideColumnObservations:track.sideColumnObservations||0,wideColumnObservations:track.wideColumnObservations||0,wideColumnOffsets:track.lastWideOffsets||null,y:round(track.y,2),predictedY:round(predictedY,3),targetY:target,triggerLineY:target-cfg.tolerance,speed:round(track.speed,5),acceleration:round(track.acceleration,7),accelerationSamples:track.accelerationSamples,accelerationStable:track.accelerationStable,predictionMode:prediction.predictionMode,basePredictionPx:round(prediction.basePredictionPx,4),frameAdvancePx:round(prediction.frameAdvancePx,4),highSpeedAdvancePx:round(prediction.highSpeedAdvancePx,4),accelerationPredictionPx:round(prediction.accelerationPx,4),accelerationUsed:prediction.accelerationUsed,highSpeedUsed:prediction.highSpeedUsed,adaptiveLeadMs:round(prediction.leadMs,3),adaptivePredictionPx:round(prediction.predictionPx,4),averageFrameMs:round(averageFrameMs,3),distanceToTriggerPx:round(target-cfg.tolerance-track.y,4),estimatedFrameTravelPx:round(track.speed*averageFrameMs,4),time:Math.round(time),previousEvent:previous?.type||null,previousGapMs:previous?Math.round(time-previous.time):null,appliedCorrection:correction[eventKey]||0,autoCorrectionPx:autoLead?.px||0,autoCorrectionBasis:autoLead?.reason||'none',autoCorrectionSamples:autoLead?.samples||0,autoCorrectionRuns:autoLead?.runs||0,tireSpeedGuard:{tire:profileAtStart?.tire||null,markerSpeedPxMs:round(track.speed,5),frameMs:round(averageFrameMs,3)},effectiveCorrectionPx:(correction[eventKey]||0)+(autoLead?.px||0),firstSeenY:round(track.firstSeenY,2),observationCount:track.observationCount,maxObservationGapMs:round(track.maxObservationGapMs||0,2),lastObservationGapMs:round(track.lastObservationGapMs||0,2),lateSpawnSuppressed:!!track.suppressed,triggerSource:triggerMeta?.source||'visible',triggerGapMs:triggerMeta?.gapMs??0,triggerEstimatedY:triggerMeta?.estimatedMarkerY??null,triggerPredictedOvershootPx:triggerMeta?.predictedOvershootPx??null,triggerAnticipationPx:triggerMeta?.anticipationPx??0,feedbackGrade:null,feedbackDirection:null,feedbackDistanceM:null,feedback:null,feedbackTime:null};history.push(record);beginEventTrace(track,record,time);if(history.length>ENGINE.maxHistory)history.shift();if(prediction.highSpeedUsed){universalStats.highSpeedEvents++;universalStats.highSpeedPredictionUsed++;universalStats.totalAdvancePx+=prediction.highSpeedAdvancePx;universalStats.maximumAdvancePx=Math.max(universalStats.maximumAdvancePx,prediction.highSpeedAdvancePx);}else universalStats.fallbackCount++;if(prediction.accelerationUsed)universalStats.accelerationUsed++;analysisEvents.push({time:round(time,1),sequence:eventSequence,type,markerSpeedPxMs:round(track.speed,5),markerAccelerationPxMs2:round(track.acceleration,7),liveSpeedKmh:analysisLastSpeed});setMessage(LABELS[type]+' 실행');return true;}
function updateTracks(bands,now){
  const used=new Set(),sorted=[...bands].sort((a,b)=>Number(a.readSource==='verified-wide-columns')-Number(b.readSource==='verified-wide-columns')||b.y-a.y);
  for(const band of sorted){
    let best=null,distance=Infinity;
    for(const track of tracks){
      if(used.has(track.id)||track.type!==band.type)continue;
      if(band.readSource==='verified-wide-columns'&&!wideBoostMatch(track,band,now))continue;
      const delta=band.y-track.y;
      if(delta>=-8&&delta<cfg.matchDistance&&Math.abs(delta)<distance){best=track;distance=Math.abs(delta);}
    }
    const priorMissing=best?.missing??0;
    if(!best){
      best={id:nextTrackId++,type:band.type,y:band.y,firstSeenY:band.y,firstSeenAt:now,
        lastTime:now,speed:0,previousInstantSpeed:null,acceleration:0,
        accelerationSamples:0,accelerationStable:false,triggered:false,suppressed:false,
        newlyCreated:true,observationCount:1,lastObservationGapMs:0,maxObservationGapMs:0,missing:0};
      tracks.push(best);
    }else{
      const dt=now-best.lastTime,dy=band.y-best.y;
      if(band.readSource==='verified-wide-columns')best.wideForwardMotion=dy>0&&dt>0&&dt<=WIDE_BOOST_SCAN.maxObservationGapMs;
      best.observationCount++;
      best.lastObservationGapMs=dt>0?dt:0;
      best.maxObservationGapMs=Math.max(best.maxObservationGapMs,best.lastObservationGapMs);
      if(dt>DETECTION_GUARD.trackGapMs){
        detectionHealth.trackLongGaps++;
        detectionHealth.maxTrackGapMs=Math.max(detectionHealth.maxTrackGapMs,dt);
        recordDetectionAlert('track-observation-gap',best,now,{gapMs:round(dt,2)});
      }
      if(dt>0&&dt<200){
        const speed=dy/dt;
        if(speed>=-.2&&speed<ENGINE.maxSpeed){
          best.speed=best.speed===0?speed:best.speed*.45+speed*.55;
          updateAcceleration(best,speed,dt);
          universalStats.maximumSpeed=Math.max(universalStats.maximumSpeed,best.speed);
        }
      }
      best.y=band.y;best.lastTime=now;best.missing=0;
    }
    used.add(best.id);
    if(band.readSource==='verified-wide-columns'){
      best.wideConsecutive=best.lastMarkerReadSource==='verified-wide-columns'&&priorMissing===0&&best.lastObservationGapMs<=WIDE_BOOST_SCAN.maxObservationGapMs?(best.wideConsecutive||0)+1:1;
      best.wideColumnObservations=(best.wideColumnObservations||0)+1;best.lastWideOffsets=band.wideOffsets||null;
      best.wideOnly=best.wideOnly!==false&&!best.centerObserved;
    }else{best.wideConsecutive=0;best.wideOnly=false;if(!band.readSource)best.centerObserved=true;}
    best.lastMarkerReadSource=band.readSource||'center';
    if(band.readSource==='verified-side-columns')best.sideColumnObservations=(best.sideColumnObservations||0)+1;
    captureTrackFrame(best,now);
    const isBoost=best.type.startsWith('boost'),target=isBoost?cfg.boostY:cfg.brakeY;
    const offset=isBoost?cfg.boostOffset:cfg.brakeOffset;
    const triggerLine=target-cfg.tolerance;
    if(best.newlyCreated){
      best.newlyCreated=false;
      if(shouldSuppressLateSpawn(best.firstSeenY,triggerLine)){
        // Avoid a ghost/late-appearing marker firing after crossing the trigger.
        // This cannot recover an input that was already missed; keep diagnostics.
        best.suppressed=true;detectionHealth.lateSpawns++;
        recordDetectionAlert('late-spawn-suppressed',best,now,{triggerLineY:triggerLine,excessPx:round(best.firstSeenY-triggerLine,2)});
      }
    }
    const eventKey=best.type+':'+(eventSequence+1),prediction=predict(best);
    const autoLead=autoLeadPreview(eventKey,best.speed);
    const predictedY=best.y+prediction.predictionPx+offset+(correction[eventKey]||0)+autoLead.px;
    lastDetected=LABELS[best.type]+' Y='+round(best.y,1)+(best.suppressed?' (늦게 등장·입력 차단)':'');
    if(!best.triggered&&!best.suppressed&&predictedY>=triggerLine){
      const wide=best.lastMarkerReadSource==='verified-wide-columns';
      if(wide&&!wideBoostTrackReady(best,triggerLine)){detectionHealth.wideBoostUnconfirmed++;continue;}
      const source=wide?'verified-wide-columns':best.lastMarkerReadSource==='verified-side-columns'?'verified-side-columns':'visible';
      if(executeEvent(best,predictedY,prediction,eventKey,target,autoLead,{source})){best.triggered=true;if(wide)detectionHealth.wideBoostTriggers++;}
    }
  }
  for(const track of tracks)if(!used.has(track.id)){
    // A wide-column-only candidate is never extrapolated into an input.
    if(!track.wideOnly&&!tryShortGapCoast(track,now)&&!tryNearBoostOffGap(track,now))trySparseBoostCoast(track,now);
    track.missing++;
  }
  tracks=tracks.filter(track=>track.missing<=12);
  render();
}
function parseFeedback(text){const raw=String(text||'').trim();if(!raw)return null;if(/^진입\s+/i.test(raw)&&/\s*\/\s*탈출\s+/i.test(raw)){const m=raw.match(/^진입\s+(PERFECT|GREAT|GOOD|BAD|MISS)(?:\s*·\s*(빠름|늦음)\s*([\d.]+)\s*m)?\s*\/\s*탈출\s+(PERFECT|GREAT|GOOD|BAD|MISS)(?:\s*·\s*(빠름|늦음)\s*([\d.]+)\s*m)?(?:\s*·\s*(\d+)\s*km\/h)?/i);return {kind:'segment',raw,entry:m?.[1]?.toLowerCase()||null,exit:m?.[4]?.toLowerCase()||null,entryDirection:m?.[2]||null,entryDistanceM:m?.[3]?Number(m[3]):null,exitDirection:m?.[5]||null,exitDistanceM:m?.[6]?Number(m[6]):null,speedKmh:m?.[7]?Number(m[7]):null};}let eventType=null;if(/브레이크\s*진입/.test(raw))eventType='brakeOn';else if(/브레이크\s*해제/.test(raw))eventType='brakeOff';else if(/부스터\s*ON|BOOST\s*ON/i.test(raw))eventType='boostOn';else if(/부스터\s*OFF|BOOST\s*OFF/i.test(raw))eventType='boostOff';if(!eventType)return null;const gr=raw.match(/PERFECT|GREAT|GOOD|BAD|MISS|퍼펙트|그레이트|굿|배드|미스/i)?.[0]?.toLowerCase(),grades={퍼펙트:'perfect',그레이트:'great',굿:'good',배드:'bad',미스:'miss'},grade=grades[gr]||gr;if(!grade)return null;const direction=/빠름|EARLY/i.test(raw)?'early':/늦음|LATE/i.test(raw)?'late':null,dist=raw.match(/(?:빠름|늦음|EARLY|LATE)\s*([\d.]+)\s*m/i);return {kind:'event',raw,eventType,grade,direction,distanceM:dist?Number(dist[1]):null};}
function findMatchingRecord(parsed,now){const c=history.filter(r=>r.feedbackGrade===null&&r.type===parsed.eventType&&now>=r.time&&now-r.time<=ENGINE.feedbackWindowMs);return c.length===1?c[0]:null;}
function applyLearning(record,parsed){if(!profile)return;const key=record.eventKey;if(parsed.grade==='perfect'){if(evidence[key]){delete evidence[key];saveLearning();}return;}if(parsed.grade!=='great'||!parsed.direction)return;const old=evidence[key],item=old&&old.direction===parsed.direction?old:{direction:parsed.direction,count:0,lastRun:null};if(item.lastRun===runId)return;item.count++;item.lastRun=runId;evidence[key]=item;record.learningEvidenceCount=item.count;if(item.count>=ENGINE.repeatRequired){const before=correction[key]||0,delta=parsed.direction==='late'?ENGINE.correctionStep:-ENGINE.correctionStep,after=clamp(before+delta,-ENGINE.maxCorrection,ENGINE.maxCorrection);correction[key]=after;record.correctionBefore=before;record.correctionAfter=after;item.count=0;if(after!==before)stats.adjusted++;}saveLearning();}
function processFeedback(text){recordWheelLockSignal(text,'game-feedback');const parsed=parseFeedback(text);if(!parsed)return;const now=nowMs();lastFeedback=parsed.raw;if(parsed.kind==='segment'){segmentResults.push({time:Math.round(now),...parsed});stats.segmentResults++;if(segmentResults.length>ENGINE.maxHistory)segmentResults.shift();render();return;}const record=findMatchingRecord(parsed,now);feedbackLog.push({time:Math.round(now),...parsed,matched:Boolean(record),eventSequence:record?.sequence||null});if(feedbackLog.length>ENGINE.maxHistory)feedbackLog.shift();if(!record){stats.unmatched++;render();return;}record.feedbackGrade=parsed.grade;record.feedbackDirection=parsed.direction;record.feedbackDistanceM=parsed.distanceM;record.feedback=parsed.raw;record.feedbackTime=Math.round(now);if(Object.prototype.hasOwnProperty.call(stats,parsed.grade))stats[parsed.grade]++;applyLearning(record,parsed);observeFeedback(record,parsed);render();}
function connectFeedbackObserver(){const element=root()?.querySelector('.feedback');if(!element||element===feedbackElement)return;feedbackObserver?.disconnect();feedbackElement=element;lastFeedbackText='';feedbackEmpty=true;feedbackObserver=new MutationObserver(()=>{if(!running)return;const text=element.textContent?.trim()||'';if(!text){feedbackEmpty=true;return;}if(text!==lastFeedbackText||feedbackEmpty){lastFeedbackText=text;feedbackEmpty=false;processFeedback(text);}});feedbackObserver.observe(element,{childList:true,characterData:true,subtree:true});}
function drive(now){
  if(!running)return;
  updateFrameTiming(now);
  if(started){
    // The game may abort when users tap outside BRAKE/BOOST. Save as incomplete,
    // do not keep sending inputs or run another race after an interrupted attempt.
    const phase=String(root()?.dataset.phase||'').toLowerCase();
    if(/^(interrupted|aborted|canceled|cancelled|failed|stopped|quit)$/.test(phase)){
      stopAfterCurrent=false;
      stop(false,'interrupted');
      if(chainEnabled)stopChain('게임 주행 중단 감지 · 미완주 제외 · 다음 판 시작 안 함',false);
      else setMessage('게임 주행 중단 감지 · 미완주 기록은 성능 통계 제외');
      return;
    }
    updateTracks(scanBands(now),now);connectFeedbackObserver();recordTelemetry(now);
    sampleGameClock(now,phase);
    const explicitFinish=/^(finished|finish|complete|completed|result|results|ended|end|done)$/.test(phase);
    if(explicitFinish){
      if(!finishSeenAt){finishSeenAt=now;raceFinishedAtMs=now;finishReason='complete';}
      // 결과 메시지가 DOM에 반영될 시간을 확보한 뒤 확정.
      if(now-finishSeenAt>=1000){const requested=stopAfterCurrent;stop(false,finishReason);if(requested){stopAfterCurrent=false;if(chainEnabled)stopChain('현재 판 완주 · 요청한 중지 완료',false);else setMessage('현재 판 완주·저장 후 중지 완료');return;}if(chainEnabled){chainPendingReturn=true;chainDeadline=Date.now()+18000;chainNextAt=Date.now()+650;chainSay('완주 저장 · 출발선 복귀 대기');}else setMessage(lastRunPersistence.status==='archive-pending'?'저장 공간 부족 · 별도 보관 중':lastRunPersistence.status==='failed'?'⛔ 기록 저장 실패':'주행 기록 자동 저장 완료');return;}
    }else{finishSeenAt=0;finishReason=null;}
  }
  raf=requestAnimationFrame(drive);
}
function stop(show=true,reason=null){const wasRunning=running;running=false;if(startTimer!==null){clearInterval(startTimer);startTimer=null;}if(raf!==null){cancelAnimationFrame(raf);raf=null;}brake(false);if(boostHeld){send('.boost-key',false);boostHeld=false;}feedbackObserver?.disconnect();feedbackObserver=null;feedbackElement=null;started=false;armed=false;tracks=[];if(wasRunning)saveRun(reason||'stopped');if(show)setMessage('자동 플레이 중지');}
function start(){stop(false);stopAfterCurrent=false;detectCourse();const doc=game();if(!doc){setMessage('타임어택 화면 없음');return;}if(root()?.dataset.phase!=='ready'){setMessage('게임 재시작 후 실행하세요');return;}refreshVehicle();profileAtStart=structuredCloneSafe(detected);prepareObservation(profileAtStart);running=true;started=false;armed=false;runId=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9);tracks=[];nextTrackId=1;eventSequence=0;lastFrameTime=0;averageFrameMs=16.67;boostOnCount=0;boostOffCount=0;boostExpected='boostOn';history.length=0;feedbackLog.length=0;segmentResults.length=0;detectionAlerts.length=0;for(const key of Object.keys(detectionHealth))detectionHealth[key]=0;analysisSamples=[];analysisAccel=[];analysisEvents=[];analysisLastTime=0;analysisLastSpeed=null;analysisLastSpeedTime=0;analysisMaxSpeed=null;runFinalized=false;finishSeenAt=0;finishReason=null;raceStartedAtMs=null;raceFinishedAtMs=null;telemetryRejects=0;gameClockPoll=0;gameClockLast=null;gameClockAtFinish=null;gameClockSource=null;gameClockCount=0;gameClockTrace=[];wheelLockAtFinish=null;wheelLockObservations=[];lastSideBoostScanAt=0;lastWideBoostScanAt=-Infinity;lastWideBoostEvidence=null;for(const k of Object.keys(stats))stats[k]=0;for(const k of Object.keys(universalStats))universalStats[k]=0;lastFeedback='-';lastDetected='-';lastFeedbackText='';feedbackEmpty=true;connectFeedbackObserver();brake(true);setMessage('출발 신호 대기 중');const lights=[...doc.querySelectorAll('.lights i')];startTimer=setInterval(()=>{if(!running)return;const active=lights.filter(el=>{const rgb=doc.defaultView.getComputedStyle(el).backgroundColor.match(/\d+/g)?.map(Number);return rgb&&rgb[0]>110&&rgb[0]>rgb[1]*1.35&&rgb[0]>rgb[2]*1.35;}).length;if(active===5)armed=true;if(armed&&active===0){clearInterval(startTimer);startTimer=null;brake(false);raceStartedAtMs=performance.now();started=true;setMessage('자동 출발 성공');}},10);raf=requestAnimationFrame(drive);/* Keep panel state independent from driving. */}
function structuredCloneSafe(o){return JSON.parse(JSON.stringify(o||{}));}
const ui=document.createElement('div');ui.id='dopamine-auto-v336-ui';ui.style.cssText='position:fixed;left:0;top:0;width:0;height:0;z-index:2147483647;font:12px system-ui,sans-serif;color:white;pointer-events:none';
ui.innerHTML=`<style>#dopamine-auto-v336-ui *{box-sizing:border-box}#dopamine-auto-v336-ui button{color:white;border:0;font-weight:700;cursor:pointer;font-family:inherit}#dopamine-auto-v336-ui .panel{display:none;position:fixed;width:248px;max-width:calc(100vw - 16px);background:#142034;border:1px solid #64748b;border-radius:12px 12px 0 12px;box-shadow:0 5px 25px #000a;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;touch-action:pan-y;pointer-events:auto;padding:10px}#dopamine-auto-v336-ui .mini{position:fixed;width:94px;height:42px;display:flex;align-items:center;justify-content:center;background:#17283d;border:1px solid #64748b;border-radius:24px;box-shadow:0 3px 15px #0008;user-select:none;touch-action:none;pointer-events:auto;padding:0;white-space:nowrap}#dopamine-auto-v336-ui .head-title{font-size:12px;font-weight:800;margin-bottom:6px}#dopamine-auto-v336-ui .course{color:#93c5fd;font-size:10px;margin:5px 0;overflow-wrap:anywhere;white-space:pre-wrap}#dopamine-auto-v336-ui .actions{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:8px 0}#dopamine-auto-v336-ui .actions button{padding:9px 5px;border-radius:6px}#dopamine-auto-v336-ui .start{background:#15803d}#dopamine-auto-v336-ui .stop{background:#b91c1c}#dopamine-auto-v336-ui .stats{font-size:10px;line-height:1.5;color:#dbeafe;white-space:pre-wrap;overflow-wrap:anywhere}#dopamine-auto-v336-ui details{margin-top:7px;border-top:1px solid #475569;padding-top:7px}#dopamine-auto-v336-ui summary{color:#93c5fd;font-weight:700;cursor:pointer;padding:4px 0}#dopamine-auto-v336-ui label{display:block;margin:7px 0 3px;color:#cbd5e1;font-size:10px}#dopamine-auto-v336-ui input{display:block;width:100%;padding:7px;background:#1e293b;color:white;border:1px solid #64748b;border-radius:5px;font-size:12px}#dopamine-auto-v336-ui .subbutton{width:100%;margin-top:7px;padding:9px;border-radius:6px;background:#2563eb}#dopamine-auto-v336-ui .reset{background:#475569}#dopamine-auto-v336-ui .hint{font-size:10px;color:#fcd34d;line-height:1.4;margin:5px 0}#dopamine-auto-v336-ui .auto-head{display:flex;justify-content:space-between;align-items:center;gap:5px;margin-bottom:10px;font-size:12px}#dopamine-auto-v336-ui .auto-head button{background:#334155;border-radius:7px;padding:6px 10px;font-size:17px}#dopamine-auto-v336-ui .auto-line{display:flex;align-items:center;justify-content:space-between;gap:6px;margin:8px 0;font-size:11px}#dopamine-auto-v336-ui .auto-line>span:first-child{color:#94a3b8}#dopamine-auto-v336-ui #manage-area{margin-top:10px;border-top:1px solid #475569;padding-top:8px}#dopamine-auto-v336-ui #cloud-config-slot button{position:static!important;width:100%;margin-top:7px;padding:9px;background:#164e63;border:1px solid #67e8f9;border-radius:6px}#dopamine-auto-v336-ui .panel{width:248px}#dopamine-auto-v336-ui .tabs{display:flex;gap:5px;margin:5px 0 10px}#dopamine-auto-v336-ui .tabs button{flex:1;background:#334155;border-radius:7px;padding:9px 3px;font-size:11px}#dopamine-auto-v336-ui .tabs button.active{background:#2563eb}#dopamine-auto-v336-ui .analysis-box{font-size:11px;line-height:1.65;white-space:pre-wrap;overflow-wrap:anywhere;color:#dbeafe}</style><div class="panel" id="auto-panel"><div class="auto-head"><strong>🚗 DOPAMINE AUTO <span style="font-size:10px;color:#94a3b8">v${VERSION}</span></strong><button id="manage-btn" aria-label="관리 메뉴 열기" title="관리 메뉴">⚙</button></div><div class="tabs"><button id="tab-auto" class="active">🏎️ AUTO</button><button id="tab-analysis">📊 차량 분석</button></div><div id="auto-tab"><div class="auto-line"><span>상태</span><strong id="simple-state">대기 중</strong></div><div class="auto-line"><span>잔여 타이어</span><strong id="simple-tires">확인 전</strong></div><div class="actions"><button class="start" id="start-btn">▶ 1판 시작</button><button class="stop" id="stop-btn">■ 현재 판 후 중지</button></div><label>연속 실행 횟수 (0=실제 잔여 타이어 모두)</label><input id="chain-run-limit" type="number" min="0" max="18" step="1" value="0"><button class="subbutton" id="chain-btn" style="background:#0f766e">🔁 지정 횟수 연속 주행</button><div class="auto-line" style="margin-top:8px"><span>☁ Google Sheets</span><span id="cloud-state">로더에서 확인</span></div><div id="manage-area" style="display:none"><div class="course" id="course-name">코스 분석 대기</div><div class="stats" id="chain-status"></div><div class="stats" id="status">대기 중</div><div class="stats" id="vehicle-info"></div><p class="hint">자동 인식은 화면 DOM 확인이 필요합니다.</p><button class="subbutton" id="detect-btn">🔍 차량·타이어 다시 읽기</button><button class="subbutton" id="analysis-copy">📊 누적 분석 JSON 복사</button><button class="subbutton" id="analysis-download">💾 누적 분석 JSON 저장</button><button class="subbutton" id="copy-btn">📋 현재 입력 기록 복사</button><button class="subbutton reset" id="force-stop-btn">⛔ 긴급 즉시 중지</button><div id="cloud-config-slot"></div><details id="settings-details"><summary>⚙ 고급 설정</summary><label>기존 수동 프로필 (학습 보정 키)</label><input id="vehicleProfile" type="text" placeholder="비우면 기존 학습 보정 비활성"><label>브레이크 판정선 Y</label><input id="brakeY" type="number"><label>부스터 판정선 Y</label><input id="boostY" type="number"><label>브레이크 보정 px</label><input id="brakeOffset" type="number"><label>부스터 보정 px</label><input id="boostOffset" type="number"><label>예측 시간 ms</label><input id="predictionMs" type="number"><label>부스터 구간 수 (0=자동)</label><input id="boostZones" type="number"><label>색상 허용 오차</label><input id="colorTolerance" type="number"><label>판정 허용 오차 px</label><input id="tolerance" type="number"><button class="subbutton" id="save-btn">설정 저장</button><button class="subbutton reset" id="reset-btn">기본 설정 복원</button></details></div></div><div id="analysis-tab" style="display:none"><div class="analysis-box" id="analysis-summary">기록 분석 대기</div><button class="subbutton" id="analysis-refresh">🔄 분석 새로고침</button><button class="subbutton" id="analysis-copy2">📋 누적 기록 복사</button></div></div><button class="mini" id="auto-mini">🚗 AUTO</button>`;
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
function renderAnalysis(){
 const runs=readSavedRuns(),completed=runs.filter(r=>r.complete),groups=new Map();
 for(const r of completed){
   const v=r.vehicle||{},key=[r.courseName||r.courseId||'미확인',v.name||'미확인',v.grade||'?',v.stars??'?',v.tire||'?'].join(' / ');
   if(!groups.has(key))groups.set(key,{n:0,p:0,g:0,events:0,allPerfect:0,wheelLock:0,ungraded:0,gameTimes:[],clientTimes:[]});
   const x=groups.get(key);x.n++;x.p+=r.grades?.perfect||0;x.g+=r.grades?.great||0;x.events+=r.events||0;
   const wheel=!!r.wheelLockObservations?.length||/휠\s*락|wheel\s*lock/i.test(r.wheelLockResultEvidence?.text||'');
   if(wheel)x.wheelLock++;
   x.ungraded+=(r.history||[]).filter(h=>!h.feedbackGrade).length;
   if(!wheel&&r.events>0&&(r.history||[]).length===r.events&&(r.history||[]).every(h=>h.feedbackGrade==='perfect'))x.allPerfect++;
   const gameSec=r.gameTiming?.recordedLapTimeSec??r.gameTiming?.resultTimeSec??r.gameTiming?.hudAtFinishSec;
   if(Number.isFinite(gameSec)&&gameSec>0)x.gameTimes.push(gameSec);
   if(Number.isFinite(r.observedRaceDurationMs)&&r.observedRaceDurationMs>0)x.clientTimes.push(r.observedRaceDurationMs/1000);
 }
 const lines=['완주 '+completed.length+'판 / 저장 '+runs.length+'판','게임 랩타임: 완주 후 실제 HUD/최종 기록 표시 우선 · 클라이언트 시간은 참고용',''];
 for(const [key,x] of groups){
   const pct=x.events?(100*x.p/x.events).toFixed(2):'-';
   const gameBest=x.gameTimes.length?Math.min(...x.gameTimes).toFixed(3)+'초':'미확인';
   const gameAvg=x.gameTimes.length?(x.gameTimes.reduce((a,b)=>a+b,0)/x.gameTimes.length).toFixed(3)+'초':'미확인';
   const clientAvg=x.clientTimes.length?(x.clientTimes.reduce((a,b)=>a+b,0)/x.clientTimes.length).toFixed(3)+'초':'미측정';
   lines.push(key,'  '+x.n+'판 · PERFECT '+pct+'% / 올퍼펙트 '+x.allPerfect+'/'+x.n,
     '  휠락 관측 '+x.wheelLock+'/'+x.n+'판 · 미판정 입력 '+x.ungraded+'개',
     '  게임 랩타임 '+x.gameTimes.length+'/'+x.n+'판 · 최단 '+gameBest+' / 평균 '+gameAvg,
     '  브라우저 경과시간 평균 '+clientAvg+' (참고) ', '');
 }
 if(!groups.size)lines.push('아직 완주 기록이 없습니다.');
 $('#analysis-summary').textContent=lines.join('\n');
}
$('#tab-auto').addEventListener('click',()=>showTab('auto'));$('#tab-analysis').addEventListener('click',()=>showTab('analysis'));$('#analysis-refresh').addEventListener('click',renderAnalysis);$('#analysis-copy2').addEventListener('click',()=>$('#analysis-copy').click());
const fields=['brakeY','boostY','brakeOffset','boostOffset','predictionMs','boostZones','colorTolerance','tolerance'];function updateInputs(){for(const f of fields){const i=$('#'+f);if(i)i.value=cfg[f];}const p=$('#vehicleProfile');if(p)p.value=profile;}
for(const f of fields){$('#'+f).addEventListener('change',()=>{const v=Number($('#'+f).value);if(Number.isFinite(v))cfg[f]=v;else $('#'+f).value=cfg[f];});}
$('#vehicleProfile').addEventListener('change',e=>{if(running){e.target.value=profile;setMessage('주행 중 프로필 변경 불가');return;}setProfile(e.target.value);setMessage('수동 프로필 변경 완료');});
$('#start-btn').onclick=()=>{if(running||chainEnabled)return;setProfile($('#vehicleProfile').value);start();};$('#chain-btn').onclick=()=>{setProfile($('#vehicleProfile').value);startChain();};$('#stop-btn').onclick=()=>{if(running){setMessage('주행 중 외부 터치가 게임을 중단할 수 있음 · 출발 전 연속 횟수를 설정하세요');return;}requestGracefulStop();};$('#force-stop-btn').onclick=()=>{if(window.confirm('현재 주행을 즉시 중단합니다. 완주 기록이 남지 않을 수 있습니다. 계속할까요?'))forceStopNow();};$('#save-btn').onclick=()=>{if(running){setMessage('주행 중 설정 변경 불가');return;}setProfile($('#vehicleProfile').value);saveSettings();};$('#reset-btn').onclick=()=>{if(running)return;cfg={...DEFAULTS};updateInputs();saveSettings();};$('#detect-btn').onclick=()=>{refreshVehicle();setMessage('화면 차량 정보 다시 읽기 완료');};
async function copyText(t){try{await navigator.clipboard.writeText(t);return true;}catch(_){try{const el=document.createElement('textarea');el.value=t;el.style.cssText='position:fixed;left:0;top:0;opacity:0';document.body.appendChild(el);el.focus();el.select();const ok=document.execCommand('copy');el.remove();return ok;}catch(_){return false;}}}
function currentExport(){return {version:VERSION,releaseBase:RELEASE,courseId,courseName,vehicleProfile:profile||null,vehicle:profileAtStart||detected,settings:{...cfg},engine:{frameFactor:ENGINE.frameFactor,maxAdaptiveMs:ENGINE.maxAdaptiveMs,maxPredictionPx:ENGINE.maxPredictionPx,averageFrameMs:round(averageFrameMs,3),highSpeedStart:ENGINE.highSpeedStart,highSpeedFull:ENGINE.highSpeedFull,maxHighSpeedAdvancePx:ENGINE.maxHighSpeedAdvancePx,frameLookaheadFactor:ENGINE.frameLookaheadFactor,accelerationMaxPx:ENGINE.accelerationMaxPx},universalStats:{...universalStats,averageHighSpeedAdvancePx:universalStats.highSpeedEvents?round(universalStats.totalAdvancePx/universalStats.highSpeedEvents,4):0},learning:{correction:{...correction},evidence:{...evidence},stats:{...stats}},boostOnCount,boostOffCount,history,feedbackLog,segmentResults,analysis:{measuredMaxSpeedKmh:analysisMaxSpeed,markerMaxSpeedPxMs:universalStats.maximumSpeed,speedSamples:analysisSamples,accelerationSamples:analysisAccel,eventTelemetry:analysisEvents}};}
$('#copy-btn').onclick=async()=>setMessage(await copyText(JSON.stringify(currentExport(),null,2))?'입력 기록 복사 완료':'복사 실패');
$('#analysis-copy').onclick=async()=>setMessage(await copyText(JSON.stringify(readSavedRuns(),null,2))?'누적 분석 기록 복사 완료':'복사 실패');
$('#analysis-download').onclick=()=>{const blob=new Blob([JSON.stringify(readSavedRuns(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='dopamine-v337-analysis.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);setMessage(readSavedRuns().length?'누적 분석 파일 저장 요청':'저장된 분석 기록이 없습니다. 주행 후 다시 시도하세요');};
function render(){const cs=$('#chain-status');if(cs)cs.textContent='연속: '+(chainEnabled?'작동':'꺼짐')+' / '+chainState+' / 이번 실행 '+chainRuns+'판 / 예약 '+(chainMaxRuns?chainMaxRuns+'판':'잔여 모두')+(chainCounts?'\n타이어 잔여 H:'+chainCounts.hard+' M:'+chainCounts.medium+' S:'+chainCounts.soft:'');const c=$('#course-name'),s=$('#status'),v=$('#vehicle-info');if(c)c.textContent=courseName+' ('+courseId+')\n프로필: '+(profile||'자동 관찰학습 (차량별)');if(v)v.textContent='인식: '+profileStatus+'\n차량: '+(detected.name||'미확인')+'\n등급: '+(detected.grade||'미확인')+' / 별: '+(detected.stars??'미확인')+'\n타이어: '+(detected.tire||'미확인')+'\n표시 최고속력: '+(detected.displayTopSpeedKmh??'미확인')+' km/h\n누적 주행: '+savedRunCount+'회';if(s)s.textContent=lastMessage+'\nBOOST ON: '+boostOnCount+' / OFF: '+boostOffCount+'\n다음: '+boostExpected+'\n마지막 감지: '+lastDetected+'\n판정: '+lastFeedback+'\nPERFECT: '+stats.perfect+' / GREAT: '+stats.great+' / GOOD: '+stats.good+' / BAD: '+stats.bad+' / MISS: '+stats.miss+'\n고속 보정 입력: '+universalStats.highSpeedEvents+'\n가속도 보정 입력: '+universalStats.accelerationUsed+'\n프레임: '+round(averageFrameMs,1)+'ms\n학습 보정: '+stats.adjusted+'회\n실측 최고속도: '+(analysisMaxSpeed===null?'미확인':analysisMaxSpeed+' km/h');const simpleState=$('#simple-state'),simpleTires=$('#simple-tires');if(simpleState)simpleState.textContent=stopAfterCurrent?'⏳ 완주 후 중지 예약':running?'🟢 주행 중':chainEnabled?'🔁 연속 주행':'대기 중';$('#stop-btn').disabled=running||!!stopAfterCurrent;
  $('#stop-btn').textContent=running?'⚠ 주행 중 화면터치 금지':stopAfterCurrent?'⏳ 완주 후 중지 예약':'■ 다음 판 시작 전 중지';
  const limitField=$('#chain-run-limit');if(limitField)limitField.disabled=running||chainEnabled;if(simpleTires)simpleTires.textContent=chainCounts?'H '+chainCounts.hard+' · M '+chainCounts.medium+' · S '+chainCounts.soft:'확인 전';mini.textContent=expanded?'✕ AUTO':running?'🟢 AUTO':'🚗 AUTO';}
function setMessage(m){lastMessage=m;render();}
function onResize(){placeUI();}function onPageHide(){if(chainEnabled)stopChain('페이지 이동으로 중지');else stop(false);}function destroy(){if(destroyed)return;destroyed=true;clearInterval(lobbyInfoTimer);if(chainEnabled)stopChain('스크립트 교체로 중지');else stop(false);window.removeEventListener('resize',onResize);window.removeEventListener('pagehide',onPageHide);ui.remove();if(window[INSTANCE]?.destroy===destroy)delete window[INSTANCE];if(window.__duMode&&window.__duAuto)delete window.__duAuto;}
const lobbyInfoTimer=setInterval(refreshLobbyInfo,1500);
window.addEventListener('resize',onResize);window.addEventListener('pagehide',onPageHide);window[INSTANCE]={destroy};const priorTimingRun=readSavedRuns().slice(-1)[0];if(priorTimingRun?.gameTiming)lastSavedTiming={...priorTimingRun.gameTiming,clientElapsedSec:priorTimingRun.observedRaceDurationSec??null,complete:priorTimingRun.complete};if(window.__duMode){window.__duAuto={state:()=>({version:VERSION,running,chainEnabled,chainRuns,chainMaxRuns,chainState,chainCounts,lastMessage,courseName,stats:{...stats},stopAfterCurrent,learningMode:'confidence-gated',learningProfileKey:observeState?.identity||null,lastRaceTiming:lastSavedTiming,currentGameHudSec:gameClockLast,lastRunPersistence:{...lastRunPersistence},localRunCount:savedRunCount})};}loadProfile();updateInputs();restorePosition();detectCourse();refreshVehicle();refreshLobbyInfo();collapsePanel();render();
})();