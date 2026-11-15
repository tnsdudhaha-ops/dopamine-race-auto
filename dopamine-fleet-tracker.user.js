// ==UserScript==
// @name         도파민레이스 차량 추적기
// @namespace    local.dopamine.fleet
// @version      2.0.0
// @description  Bootstrap: 게임 페이지를 열 때마다 GitHub 최신 차량 추적기 실행
// @match        https://luck-game-hjh.jihwan1010.chatgpt.site/*
// @updateURL    https://raw.githubusercontent.com/tnsdudhaha-ops/dopamine-race-auto/main/dopamine-fleet-tracker.user.js
// @downloadURL  https://raw.githubusercontent.com/tnsdudhaha-ops/dopamine-race-auto/main/dopamine-fleet-tracker.user.js
// @connect      raw.githubusercontent.com
// @grant        GM_xmlhttpRequest
// @run-at       document-idle
// ==/UserScript==
(function () {
  'use strict';
  const RUNTIME = 'https://raw.githubusercontent.com/tnsdudhaha-ops/dopamine-race-auto/main/dopamine-fleet-tracker.runtime.js';
  const CACHE = 'dopamine-fleet-tracker:bootstrap-runtime-v2';
  function status(message) {
    let box = document.getElementById('dft-bootstrap-status');
    if (!box) {
      box = document.createElement('div');
      box.id = 'dft-bootstrap-status';
      box.style.cssText = 'position:fixed;bottom:10px;right:10px;z-index:2147483647;background:#25364c;color:white;border:1px solid #8ca2b9;border-radius:8px;padding:9px;font:12px sans-serif;max-width:290px';
      (document.body || document.documentElement).appendChild(box);
    }
    box.textContent = message;
  }
  function run(source, fromCache) {
    if (!source || !source.includes('Dopamine Fleet Tracker runtime')) throw new Error('실행 파일 형식 확인 실패');
    // GitHub owner/repo is the explicit trust boundary for remote code.
    (new Function(source))();
    const banner = document.getElementById('dft-bootstrap-status');
    if (banner) banner.remove();
    if (fromCache) status('GitHub 접속 실패: 저장된 추적기 버전 실행 중');
  }
  function fallback(reason) {
    try {
      const cached = localStorage.getItem(CACHE);
      if (cached) { run(cached,true); return; }
    } catch (e) { /* continue */ }
    status('차량 추적기 로딩 실패: '+reason+' (새로고침 후 재시도)');
  }
  function load() {
    status('🚗 GitHub 최신 차량 추적기 확인 중…');
    GM_xmlhttpRequest({
      method:'GET',
      url:RUNTIME+'?t='+Date.now(),
      headers:{'Cache-Control':'no-cache'},
      timeout:12000,
      onload(response) {
        if (response.status !== 200) {fallback('HTTP '+response.status);return;}
        try {
          const source=response.responseText;
          // Check syntax before storing the last-known-good runtime.
          new Function(source);
          run(source,false);
          try {localStorage.setItem(CACHE,source);} catch (e) { /* cache optional */ }
        } catch(e) {fallback(String(e.message || e));}
      },
      onerror() {fallback('네트워크 오류');},
      ontimeout() {fallback('요청 시간 초과');}
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',load,{once:true});
  else load();
})();
