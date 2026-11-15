// ==UserScript==
// @name         도파민레이스 차량 추적기
// @namespace    local.dopamine.fleet
// @version      2.1.0
// @description  Bootstrap: 게임 페이지를 열 때마다 GitHub 최신 차량 추적기 실행
// @match        https://luck-game-hjh.jihwan1010.chatgpt.site/*
// @updateURL    https://raw.githubusercontent.com/tnsdudhaha-ops/dopamine-race-auto/main/dopamine-fleet-tracker.user.js
// @downloadURL  https://raw.githubusercontent.com/tnsdudhaha-ops/dopamine-race-auto/main/dopamine-fleet-tracker.user.js
// @connect      api.github.com
// @connect      raw.githubusercontent.com
// @grant        GM_xmlhttpRequest
// @run-at       document-idle
// ==/UserScript==
(function () {
  'use strict';
  const API = 'https://api.github.com/repos/tnsdudhaha-ops/dopamine-race-auto/contents/dopamine-fleet-tracker.runtime.js?ref=main';
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
      url:API+'&_='+Date.now(),
      headers:{'Accept':'application/vnd.github+json','Cache-Control':'no-cache'},
      timeout:15000,
      onload(response) {
        if (response.status !== 200) {fallback('GitHub API HTTP '+response.status);return;}
        try {
          const data=JSON.parse(response.responseText);
          if (data.encoding!=='base64'||typeof data.content!=='string') throw new Error('GitHub API 응답 형식 오류');
          const bytes=Uint8Array.from(atob(data.content.replace(/\\s/g,'')),c=>c.charCodeAt(0));
          const source=new TextDecoder('utf-8').decode(bytes);
          new Function(source);
          run(source,false);
          try {localStorage.setItem(CACHE,source);} catch(e) {}
        } catch(e) {fallback('최신 실행 코드 오류: '+String(e.message||e));}
      },
      onerror() {fallback('GitHub API 연결 오류');},
      ontimeout() {fallback('GitHub API 응답 시간 초과');}
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',load,{once:true});
  else load();
})();
