// Dopamine Fleet Tracker runtime v1.1.16 (loaded by bootstrap)
(function () {
  'use strict';
  const VERSION = '1.1.16';
  const KEY = 'dopamine-fleet-tracker-v1';
  const USERS = ['ㅇ발','구레긔','피콜로','ㅇ샘','영감','톩끼'];
  const ALIASES = {'○발':'ㅇ발','◯발':'ㅇ발','〇발':'ㅇ발','그레이트':'구레긔','픽홀':'피콜로','콜로':'피콜로','참돔':'ㅇ샘','킹황':'영감','갱서':'톩끼'};
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
  function currentGarageOwner() {
    const titles=[...document.querySelectorAll('h1,h2,h3,h4,header,[class*="title"],[class*="Title"],[class*="header"],[class*="Header"]')]
      .filter(el=>el.getClientRects().length);
    for(const el of titles) {
      const t=(el.textContent||'').trim();
      if(t.length>120) continue;
      const owner=garageOwnerFromText(t);
      if(owner) return owner;
    }
    return null;
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
    return garageOwnerFromText(p.textContent)||garageOwnerFromText(p.innerText);
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
  async function captureGarage(silent=false) {
    if (collecting) return;
    const p = activeGaragePanel();
    const actual = currentGarageOwner() || detectOwner(p);
    if (!p) { if (!silent) note('차고 팝업을 찾지 못했습니다.'); return; }
    if (!actual) { if (!silent) note('차고 소유주 미인식: 차고 제목이 보이게 캡처해 주세요. 다른 참가자 기록은 보호합니다.'); return; }
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
      if (prev.length && !changes.length) {if (!silent) note(actual+' 차고 변경 없음 ('+cars.length+'종 / '+total+'대)');return;}
      const at = date();
      db.garages[actual] = {vehicles:cars,updatedAt:at,source:'full-popup-scroll'};
      db.snapshots.push({user:actual,at,vehicles:cars,changes});
      if (prev.length && changes.length) db.events.push({user:actual,at,changes,note:'변동 원인 미확정'});
      db.snapshots = db.snapshots.slice(-800);
      db.events = db.events.slice(-800);
      save();
      selected = actual;
      if (!silent) note(actual+' 전체 수집 '+cars.length+'종 / '+total+'대 저장, 변경 '+changes.length+'건');
    } catch(e) {
      if (!silent) note('차고 수집 오류: '+String(e.message || e));
    } finally {
      if (scroll && scroll.isConnected) scroll.scrollTop = oldTop;
      collecting = false;
    }
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
    const rows = (g?.vehicles || []).map(v => {
      const model=escapeHtml(String(v.model||'').replace(/\\s*최고\\s*$/,'').trim());
      const detail=Array.isArray(v.breakdown)&&v.breakdown.length>1?' <small>('+v.breakdown.map(x=>'★'+x.stars+' '+x.qty+'대').join(' / ')+')</small>':'';
      return '<tr><td>'+escapeHtml(v.grade)+'</td><td>'+model+' ★'+v.stars+detail+'</td><td>'+v.qty+'대</td></tr>';
    }).join('');
    const total=(g?.vehicles||[]).reduce((n,v)=>n+(Number(v.qty)||0),0);
    root.style.setProperty('width',collapsed?'190px':'min(370px, calc(100vw - 24px))','important');
    shadow.innerHTML = '<style>:host{all:initial}*{box-sizing:border-box}.wrap{font:13px system-ui,sans-serif;color:#f4f6fa;background:#172334;border:1px solid #9ba7b8;border-radius:12px;box-shadow:0 5px 30px #0009;max-height:70dvh;overflow:auto}.top{display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:#29405b}button,select{background:#395471;color:#fff;border:1px solid #9aafc4;border-radius:6px;padding:7px;cursor:pointer;margin:2px}.body{padding:8px}.info{display:block;color:#d7e0ee;margin:6px 0;overflow-wrap:anywhere}table{width:100%;font-size:12px;border-collapse:collapse}td{border-bottom:1px solid #53657c;padding:4px}h4{margin:8px 0 3px}</style>'+
    '<div class="wrap"><div class="top"><b>🚗 차량 추적기 v'+VERSION+'</b><button id="toggle">'+(collapsed?'열기':'접기')+'</button></div>'+
    (collapsed?'':'<div class="body"><select id="user">'+USERS.map(u=>'<option '+(u===selected?'selected':'')+'>'+u+'</option>').join('')+'</select><button id="garage">차고 저장</button><button id="trades">거래 수집</button><button id="export">JSON</button><label class="info"><input id="auto" type="checkbox" '+(db.settings.auto?'checked':'')+'> 60초 자동 검사 (열린 화면, 팝업 자동 스크롤)</label><small class="info">'+escapeHtml(message)+'</small><h4>'+escapeHtml(selected)+' · '+(g?.vehicles.length||0)+'종 / '+total+'대</h4><table>'+rows+'</table><small class="info">최신 확인: '+escapeHtml(g?.updatedAt||'없음')+'</small><small class="info">강화 성공·실패는 차고 변화로 추정하며 확정하지 않습니다.</small></div>')+'</div>';
    shadow.getElementById('toggle').onclick = () => {collapsed=!collapsed;render();};
    if (collapsed) return;
    shadow.getElementById('user').onchange = e => {selected=e.target.value;render();};
    shadow.getElementById('garage').onclick = () => captureGarage();
    shadow.getElementById('trades').onclick = () => captureTrades();
    shadow.getElementById('export').onclick = exportJson;
    shadow.getElementById('auto').onchange = e => {db.settings.auto=e.target.checked;save();};
  }
  function relocateOverlay() {
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
  function init() {
    document.body.appendChild(root);
    relocateOverlay();
    root.style.setProperty('position','fixed','important');
    root.style.setProperty('right','8px','important');
    root.style.setProperty('bottom','8px','important');
    root.style.setProperty('width','min(370px, calc(100vw - 24px))','important');
    root.style.setProperty('z-index','2147483647','important');
    root.style.setProperty('display','block','important');
    render();
    setInterval(()=>{relocateOverlay();const u=currentGarageOwner();if(u&&u!==selected){selected=u;message=u+' 차고 인식됨';render();}},500);
    setInterval(()=>{
      if (!db.settings.auto) return;
      const p=activeGaragePanel(),u=currentGarageOwner()||detectOwner(p);
      if (u) {selected=u;render();captureGarage(true);}
      else captureTrades(true);
    },60000);
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();