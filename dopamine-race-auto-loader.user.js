// ==UserScript==
// @name         도파민레이스 AUTO Loader
// @namespace    dopamine-race-loader
// @version      1.0.0
// @description  Firefox Tampermonkey용 GitHub 최신 AUTO 로더 (게임 접속 시 자동 확인)
// @match        https://luck-game-hjh.jihwan1010.chatgpt.site/*
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      raw.githubusercontent.com
// @run-at       document-idle
// ==/UserScript==
(() => {
  'use strict';
  const SOURCE = 'https://raw.githubusercontent.com/tnsdudhaha-ops/dopamine-race-auto/main/dopamine-race-auto.user.js';
  const LOG = '[Dopamine AUTO Loader]';
  const notify = (message, error = false) => {
    console[error ? 'error' : 'info'](LOG, message);
    const show = () => {
      if (!document.body) return;
      let el = document.getElementById('dopamine-auto-loader-status');
      if (!el) {
        el = document.createElement('div');
        el.id = 'dopamine-auto-loader-status';
        el.style.cssText = 'position:fixed;top:8px;left:8px;z-index:2147483647;max-width:80vw;padding:7px 10px;border-radius:7px;background:#17283d;color:#fff;font:12px sans-serif;pointer-events:none;box-shadow:0 2px 10px #0008';
        document.body.appendChild(el);
      }
      el.textContent = message;
      if (error) el.style.background = '#9f1239';
      else setTimeout(() => el.remove(), 4500);
    };
    if (document.body) show();
    else document.addEventListener('DOMContentLoaded', show, { once: true });
  };
  notify('AUTO 최신 코드 확인 중…');
  GM_xmlhttpRequest({
    method: 'GET',
    url: SOURCE + '?loader=' + Date.now(),
    timeout: 15000,
    headers: { 'Cache-Control': 'no-cache' },
    onload(response) {
      if (response.status !== 200) {
        notify('AUTO 다운로드 실패: HTTP ' + response.status, true);
        return;
      }
      const source = response.responseText || '';
      const match = source.match(/^\/\/ @version\s+(\S+)/m);
      if (!source.startsWith('// ==UserScript==') || !source.includes("const VERSION=") || !match) {
        notify('AUTO 코드 형식 확인 실패', true);
        return;
      }
      try {
        // The main AUTO script expects the game's page window.
        // Only execute code from the configured, user-controlled GitHub repository.
        new Function('window', 'document', source + '\n//# sourceURL=dopamine-race-auto.remote.user.js')(unsafeWindow, document);
        notify('AUTO v' + match[1] + ' 로드 완료');
      } catch (error) {
        notify('AUTO 실행 실패: ' + String(error && error.message || error), true);
      }
    },
    onerror() { notify('AUTO 다운로드 실패: 네트워크 연결 확인', true); },
    ontimeout() { notify('AUTO 다운로드 시간 초과', true); }
  });
})();
