// ==UserScript==
// @name         도파민레이스 차량 추적기
// @namespace    local.dopamine.fleet
// @version      1.1.2
// @description  독립 차량 추적기: 차고/거래 화면 수집, 변경 이력, JSON 백업
// @match        https://luck-game-hjh.jihwan1010.chatgpt.site/*
// @updateURL    https://raw.githubusercontent.com/tnsdudhaha-ops/dopamine-race-auto/main/dopamine-fleet-tracker.user.js
// @downloadURL  https://raw.githubusercontent.com/tnsdudhaha-ops/dopamine-race-auto/main/dopamine-fleet-tracker.user.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==
(function () {
  'use strict';
  const VERSION = '1.1.2';
  const KEY = 'dopamine-fleet-tracker-v1';
  const USERS = ['ㅇ발','구레긔','피콜로','ㅇ샘','영감','톩끼'];
  const ALIASES = {'그레이트':'구레긔','픽홀':'피콜로','콜로':'피콜로','참돔':'ㅇ샘','킹황':'영감','갱서':'톩끼'};
  if (document.getElementById('dft-root')) return;
  let db;
  try { db = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (_) { db = {}; }
  db = Object.assign({version:1,garages:{},snapshots:[],transactions:[],events:[],seen:[],settings:{auto:true}},db);
  db.settings = Object.assign({auto:true},db.settings || {});
  let selected = 'ㅇ발';
  let message = '차고 팝업을 열고 참가자를 선택해 저장하세요.';
  let collapsed = false;
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
  function panel() {
    const all = panels().sort((a,b) => (a.innerText || '').length - (b.innerText || '').length);
    return all[0] || null;
  }
  function detectOwner(p) {
    const t = clean(p && p.innerText).slice(0,250);
    for (const u of USERS) if (t.includes(u+'의 차고') || t.includes(u+' 차고')) return u;
    for (const [a,u] of Object.entries(ALIASES)) if (t.includes(a+'의 차고') || t.includes(a+' 차고')) return u;
    return null;
  }
  function parseGarage(p) {
    if (!p) return [];
    const items = [];
    const candidates = [...p.querySelectorAll('div,li,article')];
    for (const el of candidates) {
      const t = el.innerText || '';
      if (!/최고\s*★\s*[1-5]/.test(t) || t.length > 220) continue;
      if ([...el.children].some(ch => /최고\s*★\s*[1-5]/.test(ch.innerText || ''))) continue;
      const star = t.match(/최고\s*★\s*([1-5])\s*[·•]?\s*(\d+)\s*대/);
      const grade = t.match(/(?:^|\s)(SSR|SR|S|R)(?=\s|$)/);
      if (!star || !grade) continue;
      const lines = t.split('\n').map(clean).filter(Boolean);
      const i = lines.findIndex(x => x.includes('최고 ★'));
      const name = i > 0 ? lines.slice(Math.max(0,i-2),i).filter(x => !/^(SSR|SR|S|R)$/.test(x)).join(' ') : '';
      if (!name || name.length > 65) continue;
      items.push({grade:grade[1],model:name,stars:Number(star[1]),qty:Number(star[2])});
    }
    const map = new Map();
    for (const v of items) map.set([v.grade,v.model,v.stars].join('|'),v);
    return [...map.values()];
  }
  function differences(a,b) {
    const x = new Map(a.map(v=>[[v.grade,v.model,v.stars].join('|'),v.qty]));
    const y = new Map(b.map(v=>[[v.grade,v.model,v.stars].join('|'),v.qty]));
    return [...new Set([...x.keys(),...y.keys()])].map(k=>({key:k,delta:(y.get(k)||0)-(x.get(k)||0)})).filter(v=>v.delta);
  }
  function captureGarage(silent=false) {
    const p = panel();
    const actual = detectOwner(p);
    if (!p) { if (!silent) note('차고 팝업을 찾지 못했습니다.'); return; }
    if (!actual) { if (!silent) note('차고 소유자를 인식하지 못했습니다. 잘못된 참가자에게 저장하지 않습니다.'); return; }
    if (actual !== selected && !silent) { note('현재 차고는 '+actual+'입니다. 참가자 선택을 확인하세요.'); return; }
    const cars = parseGarage(p);
    if (!cars.length) { if (!silent) note('차량 카드 0건 인식. 실제 DOM에 맞춘 파서 조정이 필요합니다.'); return; }
    const prev = db.garages[actual]?.vehicles || [];
    const changes = differences(prev,cars);
    if (prev.length && !changes.length) { if (!silent) note(actual+' 차고 변경 없음 ('+cars.length+'종)'); return; }
    const at = date();
    db.garages[actual] = {vehicles:cars,updatedAt:at,source:'visible-garage'};
    db.snapshots.push({user:actual,at,vehicles:cars,changes});
    if (prev.length && changes.length) db.events.push({user:actual,at,changes,note:'변동 원인 미확정'});
    db.snapshots = db.snapshots.slice(-800);
    db.events = db.events.slice(-800);
    save();
    selected = actual;
    note(actual+' 차고 '+cars.length+'종 저장, 변경 '+changes.length+'건');
  }
  function captureTrades(silent=false) {
    const p = panel();
    if (!p || !/거래|장터/.test(p.innerText || '')) { if (!silent) note('거래 내역 팝업을 열어주세요.'); return; }
    const rows = [...p.querySelectorAll('tr,li,[class*="trade"],[class*="history"]')];
    let added = 0;
    for (const el of rows) {
      const t = clean(el.innerText);
      if (t.length < 10 || t.length > 400) continue;
      const pair = t.match(/(그레이트|픽홀|참돔|킹황|갱서|ㅇ발|구레긔|피콜로|ㅇ샘|영감|톩끼)\s*(?:→|->)\s*(그레이트|픽홀|참돔|킹황|갱서|ㅇ발|구레긔|피콜로|ㅇ샘|영감|톩끼)/);
      const price = t.match(/([\d,]+)\s*E\b/i);
      if (!pair || !price) continue;
      const key = t.replace(/\s+/g,'');
      if (db.seen.includes(key)) continue;
      db.seen.push(key);
      db.transactions.push({seller:who(pair[1]),buyer:who(pair[2]),price:Number(price[1].replace(/,/g,'')),barter:price[1]==='1',raw:t,observedAt:date()});
      added++;
    }
    db.seen = db.seen.slice(-3000);
    db.transactions = db.transactions.slice(-2000);
    save();
    if (added || !silent) note('거래 신규 '+added+'건 / 누적 '+db.transactions.length+'건');
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
    const g = db.garages[selected];
    const rows = (g?.vehicles || []).map(v => '<tr><td>'+escapeHtml(v.grade)+'</td><td>'+escapeHtml(v.model)+'</td><td>★'+v.stars+'</td><td>'+v.qty+'</td></tr>').join('');
    shadow.innerHTML = '<style>:host{all:initial}*{box-sizing:border-box}.wrap{font:13px system-ui,sans-serif;color:#f4f6fa;background:#172334;border:1px solid #9ba7b8;border-radius:12px;box-shadow:0 5px 30px #0009;max-height:70dvh;overflow:auto}.top{display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:#29405b}button,select{background:#395471;color:#fff;border:1px solid #9aafc4;border-radius:6px;padding:7px;cursor:pointer;margin:2px}.body{padding:8px}.info{display:block;color:#d7e0ee;margin:6px 0;overflow-wrap:anywhere}table{width:100%;font-size:12px;border-collapse:collapse}td{border-bottom:1px solid #53657c;padding:4px}h4{margin:8px 0 3px}</style>'+
    '<div class="wrap"><div class="top"><b>🚗 차량 추적기 v'+VERSION+'</b><button id="toggle">'+(collapsed?'열기':'접기')+'</button></div>'+
    (collapsed?'':'<div class="body"><select id="user">'+USERS.map(u=>'<option '+(u===selected?'selected':'')+'>'+u+'</option>').join('')+'</select><button id="garage">차고 저장</button><button id="trades">거래 수집</button><button id="export">JSON</button><label class="info"><input id="auto" type="checkbox" '+(db.settings.auto?'checked':'')+'> 60초 자동 검사 (열린 화면)</label><small class="info">'+escapeHtml(message)+'</small><h4>'+escapeHtml(selected)+' · '+(g?.vehicles.length||0)+'종</h4><table>'+rows+'</table><small class="info">최신 확인: '+escapeHtml(g?.updatedAt||'없음')+'</small><small class="info">강화 성공·실패는 차고 변화로 추정하며 확정하지 않습니다.</small></div>')+'</div>';
    shadow.getElementById('toggle').onclick = () => {collapsed=!collapsed;render();};
    if (collapsed) return;
    shadow.getElementById('user').onchange = e => {selected=e.target.value;render();};
    shadow.getElementById('garage').onclick = () => captureGarage();
    shadow.getElementById('trades').onclick = () => captureTrades();
    shadow.getElementById('export').onclick = exportJson;
    shadow.getElementById('auto').onchange = e => {db.settings.auto=e.target.checked;save();};
  }
  function init() {
    document.body.appendChild(root);
    root.style.setProperty('position','fixed','important');
    root.style.setProperty('right','12px','important');
    root.style.setProperty('bottom','12px','important');
    root.style.setProperty('width','min(370px, calc(100vw - 24px))','important');
    root.style.setProperty('z-index','2147483647','important');
    root.style.setProperty('display','block','important');
    render();
    setInterval(()=>{
      if (!db.settings.auto) return;
      const p=panel(),u=detectOwner(p);
      if (u) {selected=u;captureGarage(true);}
      else captureTrades(true);
    },60000);
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();