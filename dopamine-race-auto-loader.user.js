// ==UserScript==
// @name         도파민레이스 AUTO Loader
// @namespace    dopamine-race-loader
// @version      1.1.0
// @description  Firefox Tampermonkey용 GitHub 최신 AUTO 로더 (게임 접속 시 자동 확인)
// @match        https://luck-game-hjh.jihwan1010.chatgpt.site/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      script.google.com
// @connect      script.googleusercontent.com
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
  // Telemetry uploader runs independently from the driving engine.
  // Credentials live in Tampermonkey storage, never in the public GitHub script.
  const RUNS_KEY = 'dopamine-auto-v336:runs';
  const CFG_URL = 'dopamine-uploader:url';
  const CFG_KEY = 'dopamine-uploader:key';
  const SENT_KEY = 'dopamine-uploader:sent';
  const ENDPOINT_PATTERN = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/;
  let sending = false;
  let retryAfter = 0;
  let status = '대기 중';
  let configButton = null;
  const read = (key, fallback = '') => GM_getValue(key, fallback);
  const write = (key, value) => GM_setValue(key, value);
  const sentIds = () => {
    try { const value = JSON.parse(read(SENT_KEY, '[]')); return Array.isArray(value) ? value : []; }
    catch (_) { return []; }
  };
  function setUploadStatus(message) {
    status = message;
    if (configButton) configButton.title = 'Google Sheets 자동 전송: ' + status;
    console.info(LOG, 'Sheets:', message);
  }
  function configureUpload() {
    const url = prompt('Google Apps Script 웹 앱 URL (/exec)을 입력하세요. 취소하면 기존 설정을 유지합니다.', read(CFG_URL));
    if (url === null) return;
    const clean = url.trim();
    if (!ENDPOINT_PATTERN.test(clean)) {
      alert('올바른 Apps Script /exec URL이 아닙니다.');
      return;
    }
    const key = prompt('UPLOAD_KEY를 입력하세요. 공개 GitHub에는 저장되지 않습니다.', read(CFG_KEY));
    if (key === null) return;
    if (!key.trim()) { alert('UPLOAD_KEY가 비어 있습니다.'); return; }
    write(CFG_URL, clean);
    write(CFG_KEY, key.trim());
    retryAfter = 0;
    setUploadStatus('설정 저장 완료, 전송 대기');
    uploadPending();
  }
  function makeConfigButton() {
    if (document.getElementById('dopamine-uploader-config')) return;
    configButton = document.createElement('button');
    configButton.id = 'dopamine-uploader-config';
    configButton.textContent = '☁ 기록전송 설정';
    configButton.style.cssText = 'position:fixed;bottom:8px;left:8px;z-index:2147483646;background:#164e63;color:#fff;border:1px solid #67e8f9;border-radius:8px;padding:8px;font:12px sans-serif';
    configButton.title = 'Google Sheets 자동 전송 설정';
    configButton.addEventListener('click', configureUpload);
    document.body.appendChild(configButton);
    setUploadStatus(read(CFG_URL) && read(CFG_KEY) ? '설정됨' : '설정 필요');
  }
  function uploadPending() {
    if (sending || Date.now() < retryAfter) return;
    const url = read(CFG_URL), key = read(CFG_KEY);
    if (!url || !key || !ENDPOINT_PATTERN.test(url)) return;
    let runs;
    try { runs = JSON.parse(localStorage.getItem(RUNS_KEY) || '[]'); }
    catch (_) { setUploadStatus('로컬 기록 읽기 실패'); return; }
    if (!Array.isArray(runs) || !runs.length) return;
    const already = new Set(sentIds());
    const run = runs.find(r => r && r.runId && !already.has(r.runId));
    if (!run) return;
    const body = JSON.stringify({ uploadKey: key, run });
    if (body.length > 1800000) {
      setUploadStatus('기록 용량 초과: ' + run.runId);
      retryAfter = Date.now() + 60000;
      return;
    }
    sending = true;
    setUploadStatus('전송 중: ' + run.runId);
    GM_xmlhttpRequest({
      method: 'POST', url,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      data: body, timeout: 30000,
      onload(response) {
        sending = false;
        let result;
        try { result = JSON.parse(response.responseText || ''); } catch (_) {}
        if (response.status >= 200 && response.status < 300 && result?.ok === true &&
            (result.status === 'SAVED' || result.status === 'ALREADY_SAVED') && result.runId === run.runId) {
          const ids = sentIds();
          if (!ids.includes(run.runId)) ids.push(run.runId);
          write(SENT_KEY, JSON.stringify(ids.slice(-1000)));
          retryAfter = 0;
          setUploadStatus('저장 성공: ' + run.runId);
          setTimeout(uploadPending, 1000);
        } else {
          retryAfter = Date.now() + 60000;
          setUploadStatus('전송 실패: ' + (result?.status || 'HTTP ' + response.status));
        }
      },
      onerror() { sending = false; retryAfter = Date.now() + 60000; setUploadStatus('네트워크 오류, 재시도 예정'); },
      ontimeout() { sending = false; retryAfter = Date.now() + 60000; setUploadStatus('시간 초과, 재시도 예정'); }
    });
  }
  if (document.body) makeConfigButton();
  else document.addEventListener('DOMContentLoaded', makeConfigButton, { once: true });
  setInterval(uploadPending, 7000);
  setTimeout(uploadPending, 2500);
})();
