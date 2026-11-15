// Dopamine Fleet Tracker runtime v1.1.26 (loaded by bootstrap)
(function () {
  'use strict';
  const VERSION = '1.1.26';
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
    const titles=garageTitleCandidates();
    const p=activeGaragePanel();
    const lines=['진단 v'+VERSION,'제목 후보: '+titles.length,
      ...titles.map(x=>x.text+' => '+(x.owner||'미인식')+' (y='+x.top+')'),
      '차고 영역: '+(p?'찾음':'없음'),
      '현재 소유주: '+(currentGarageOwner()||'미인식')];
    note(lines.join(' / '));
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
  async function captureGarage(silent=false) {
    if (collecting) return;
    const p = activeGaragePanel();
    const actual = currentGarageOwner();
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
    const isEntry=t=>/(?:\d{2}\.\d{2}\.\d{2}\.?\s*\d{2}:\d{2})/.test(t)&&
      /(차량출고|거래 완료|매입|출고|성사)/.test(t);
    for(const el of container.querySelectorAll('div,li,article,section')) {
      if(el===root||root.contains(el)) continue;
      const t=(el.innerText||'').trim();
      if(t.length<20||t.length>850||!isEntry(t)) continue;
      if([...el.children].some(ch=>isEntry((ch.innerText||'').trim())&&(ch.innerText||'').length>=20)) continue;
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
  let tradeCollecting=false;
  async function captureTrades(silent=false) {
    if(tradeCollecting)return;
    const screen=tradeScreen();
    if(!screen){if(!silent)note('전체 공지 / 유저장터 / 딜러 매입 화면을 열어주세요.');return;}
    tradeCollecting=true;
    const scroll=tradeScrollContainer(screen.container);
    const oldTop=scroll?scroll.scrollTop:0;
    const found=new Set();
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
      let added=0,skipped=0,rawAdded=0,parsedAdded=0,vehicleCount=0,otherCount=0;
      for(const raw of found){
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
        if(db.seen.includes(key))continue;
        db.seen.push(key);db.transactions.push(item);added++;
        if(item.parsed)parsedAdded++;else rawAdded++;
        if(item.category==='vehicle')vehicleCount++;else otherCount++;
      }
      for(const item of db.transactions)if(!item.category)item.category=classifyFeedItem(item);
      db.seen=db.seen.slice(-6000);db.transactions=db.transactions.slice(-4000);
      save();
      if(added||!silent)note(screen.type+': 신규 '+added+'건 (차량 관련 '+vehicleCount+' / 기타 '+otherCount+' / 신규 구조화 '+parsedAdded+' / 기존 재분석 '+reparsed+' / 원문 '+rawAdded+') / 누적 '+db.transactions.length+'건'+(complete?' (끝까지 확인)':' (일부만 확인)'));
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
    (collapsed?'':'<div class="body"><select id="user">'+USERS.map(u=>'<option '+(u===selected?'selected':'')+'>'+u+'</option>').join('')+'</select><button id="garage">차고 저장</button><button id="trades">거래 수집</button><button id="diagnose">진단</button><button id="export">JSON</button><label class="info"><input id="auto" type="checkbox" '+(db.settings.auto?'checked':'')+'> 60초 자동 검사 (열린 화면, 팝업 자동 스크롤)</label><small class="info">'+escapeHtml(message)+'</small><h4>'+escapeHtml(selected)+' · '+(g?.vehicles.length||0)+'종 / '+total+'대</h4><table>'+rows+'</table><small class="info">최신 확인: '+escapeHtml(g?.updatedAt||'없음')+'</small><small class="info">강화 성공·실패는 차고 변화로 추정하며 확정하지 않습니다.</small></div>')+'</div>';
    shadow.getElementById('toggle').onclick = () => {collapsed=!collapsed;render();};
    if (collapsed) return;
    shadow.getElementById('user').onchange = e => {selected=e.target.value;render();};
    shadow.getElementById('garage').onclick = () => captureGarage();
    shadow.getElementById('trades').onclick = () => captureTrades();
    const diagnosticButton=shadow.getElementById('diagnose');
    if (diagnosticButton) diagnosticButton.onclick = showDiagnostics;
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
    setInterval(()=>{relocateOverlay();const u=currentGarageOwner();if(u&&u!==selected){selected=u;message=u+' 차고 인식됨';render();}},1200);
    setInterval(()=>{
      if (!db.settings.auto) return;
      const p=activeGaragePanel(),u=currentGarageOwner();
      if (u) {selected=u;render();captureGarage(true);}
      else captureTrades(true);
    },60000);
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();