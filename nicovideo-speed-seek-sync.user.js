// ==UserScript==
// @name         Nicovideo Speed + Seek Sync (integrated)
// @name:ja      ニコニコ 速度制限解除＋外部シーク同期（統合版）
// @namespace    https://github.com/ButaMonky/nicovideo-speed-seek-sync
// @version      1.2.2
// @description  Synchronizes external playback-rate changes with the Nico player and aligns its internal clock after external seeks without seeking the video again.
// @description:ja 外部の再生速度変更をニコニコプレイヤーへ同期し、外部シーク後の内部時計と表示時刻のずれを補正します。動画への再シークは行いません。旧単独版を無効にして使用してください。
// @match        https://www.nicovideo.jp/watch/*
// @run-at       document-start
// @grant        none
// @sandbox      raw
// @noframes
// @author       ButaMonky (integration and external seek sync; original speed module by Eluentyw)
// @homepageURL  https://github.com/ButaMonky/nicovideo-speed-seek-sync
// @supportURL    https://github.com/ButaMonky/nicovideo-speed-seek-sync/issues
// @license      MIT
// @downloadURL  https://raw.githubusercontent.com/ButaMonky/nicovideo-speed-seek-sync/main/nicovideo-speed-seek-sync.user.js
// @updateURL    https://raw.githubusercontent.com/ButaMonky/nicovideo-speed-seek-sync/main/nicovideo-speed-seek-sync.user.js
// ==/UserScript==

/*
 * Speed logic: the original function bodies from Nicovideo speed limit unlocker v1.1
 * by Eluentyw are retained under its MIT license; see THIRD_PARTY_NOTICES.md.
 * Seek logic: Nicovideo External Seek Clock Sync v0.1.4, authored by ButaMonky.
 * Integration, duplicate-install guard, diagnostics and packaging are by ButaMonky.
 * The two components retain independent closures; no TypeScript migration here.
 * IMPORTANT: disable BOTH standalone scripts, then reload the watch page.
 * This integrated artifact is locally tested; live Nicovideo/Tampermonkey/VSC
 * integration must still be checked. It is not an upstream official release.
 * Published update and download metadata point to this repository.
 * The original speed module attribution and license are preserved in this repository.
 * The original speed module's persistent hooks/1-second defineProperty-path
 * fallback are retained. __NICO_EXTERNAL_SEEK_SYNC__.stop() stops SEEK ONLY;
 * disabling this script and reloading removes the entire integration.
 */

(() => {
  'use strict';
  // Keep the scope of the verified seek component: main-frame ordinary /watch.
  if (window !== window.top || !/^\/watch\/[^/]+\/?$/.test(location.pathname)) return;
  const INTEGRATION_MARKER = '__NICO_SPEED_SEEK_BUNDLE__';
  if (Object.prototype.hasOwnProperty.call(window, INTEGRATION_MARKER)) return;
  // Do not install a second speed hook over an already-running standalone copy.
  // The old speed script has no global API; its prototype property is the only
  // named conflict checked here. No graph scan or foreign cleanup is attempted.
  if (Object.prototype.hasOwnProperty.call(window, '__NICO_EXTERNAL_SEEK_SYNC__') ||
      Reflect.has(Object.prototype, 'setPlaybackRate')) {
    console.warn('[NicoSpeedSeek] 旧スクリプトまたは同名フックが既にあります。速度同期と外部シーク同期の旧2本を無効にして、ページ全体を再読み込みしてください。');
    return;
  }
  Reflect.defineProperty(window, INTEGRATION_MARKER, {
    value: Object.freeze({ version: '1.2.2', speed: '1.1', seek: '0.1.4' }),
    configurable: false, enumerable: false, writable: false
  });

// BEGIN ORIGINAL SPEED MODULE
(function() {
'use strict';

const hookedObjects = new WeakSet();

// Hook Object.defineProperty to intercept the player's internal state
const originalDefineProperty = Object.defineProperty;
Object.defineProperty = function(obj, prop, descriptor) {
    if (prop === 'setPlaybackRate' && descriptor && typeof descriptor.value === 'function') {
        const originalMethod = descriptor.value;

        if (!hookedObjects.has(obj)) {
            hookedObjects.add(obj);

            const sync = () => {
                const video = document.querySelector('video');
                if (video && obj.playbackRate !== video.playbackRate) {
                    originalMethod.call(obj, video.playbackRate);
                }
            };

            window.addEventListener('ratechange', sync, true);
            setInterval(sync, 1000);
        }
    }
    return originalDefineProperty.apply(this, arguments);
};

// Hook direct assignment of setPlaybackRate
Object.defineProperty(Object.prototype, 'setPlaybackRate', {
    set: function(fn) {
        if (typeof fn === 'function' && this.contents && !hookedObjects.has(this)) {
            hookedObjects.add(this);
            const self = this;
            const sync = () => {
                const video = document.querySelector('video');
                if (video && self.playbackRate !== video.playbackRate) {
                    fn.call(self, video.playbackRate);
                }
            };
            window.addEventListener('ratechange', sync, true);
        }
        this.__setPlaybackRate = fn;
    },
    get: function() { return this.__setPlaybackRate; },
    configurable: true
});

})();
// END ORIGINAL SPEED MODULE

// BEGIN SEEK MODULE
(() => {
  'use strict';

  /*
   * EXPERIMENTAL: local Chromium/model tests only, NOT a live-site-tested fix.
   * Source basis: PlayerSeekBar-CyhH9cUv.js, examined 2026-09-23.
   * The native GM.setCurrentTime also seeks the video and is NEVER called here.
   * Only its known baseline + native Qj.onCurrentTimeChange clock operation
   * are used. This is an adapter to private implementation, NOT a public API.
   *
   * Scope: the first active /watch content with id "video"; trailing entries
   * are allowed. Its prefix offset is exactly zero in the verified raw getter.
   * Leading entries are NOT given a guessed offset. Skip ads/interruption,
   * native drag/sync, ended state, media/source replacement and route changes.
   * A re-registered wrapper is allowed ONLY for the same media element/source.
   * 0.1.3: temporarily pauses ONLY this known internal Animation during an
   * external seek. Native transitions retain priority. Media and rates are untouched.
   * No imports, network, storage, keyboard interception, player object sweeps,
   * media setters, synthetic seek events, or playback-rate modifications.
   */

  if (window !== window.top || !/^\/watch\/[^/]+\/?$/.test(location.pathname)) return;
  const API_NAME = '__NICO_EXTERNAL_SEEK_SYNC__';
  if (Object.prototype.hasOwnProperty.call(window, API_NAME)) return;

  const VERSION = '1.2.2';
  const DEADLINE_MS = 30000; // Construction discovery only; NOT a seek delay.
  const EPSILON_SECONDS = 0.002; // Comparison tolerance; NOT a seek step.
  const HOLD_LIMIT_MS = 8000; // Safety fuse for this feature, NOT a seek delay/step.
  const nativeAnimationPause = Animation.prototype.pause;
  const nativeAnimationPlay = Animation.prototype.play;
  const initialPath = location.pathname;
  const define = Reflect.defineProperty;
  const getDescriptor = Object.getOwnPropertyDescriptor;
  const functionText = Function.prototype.toString;
  const startedAt = performance.now();
  const state = { phase: 'waiting-for-player', reason: null, events: 0,
    corrections: 0, unchanged: 0, contentWrapperUpdates: 0, rejectedCandidates: 0, skipped: Object.create(null) };
  const records = [];
  let gm = null;
  let media = null;
  let initialContent = null;
  let lastContent = null;
  let sourceIdentity = null; // Comparison only; NEVER included in reports.
  let stopDetails = null;
  let observer = null;
  let deadline = 0;
  let hookActive = false;
  let disposed = false;
  const listeners = new AbortController();
  const antiJitter = { enabled: true, holds: 0, releases: 0, timeouts: 0,
    releaseErrors: 0, lastHold: null };
  let clockHold = null;
  let holdFrame = 0;
  let holdDeadline = 0;
  // Cache only immutable function bodies, never mutable player state/permissions.
  const knownRawGetters = new WeakSet();
  const knownClockSetters = new WeakSet();
  let perfSession = null;
  let lastMeasurement = null;

  function ownValue(object, key) {
    if (!object || (typeof object !== 'object' && typeof object !== 'function')) return undefined;
    const d = getDescriptor(object, key);
    return d && Object.prototype.hasOwnProperty.call(d, 'value') ? d.value : undefined;
  }

  function methodValue(object, key) {
    // Resolve only this named method through the ordinary class prototype chain.
    // No object graph scanning and no invocation of accessors.
    for (let depth = 0; object && depth < 3; depth++, object = Object.getPrototypeOf(object)) {
      const d = getDescriptor(object, key);
      if (d) return Object.prototype.hasOwnProperty.call(d, 'value') ? d.value : undefined;
    }
    return undefined;
  }

  function record(kind, reason, target = null, before = null, details = null) {
    records.push({ elapsedMs: Math.round(performance.now() - startedAt), kind, reason,
      targetSeconds: target, before, after: snapshot(), details: details && { ...details } });
    if (records.length > 24) records.shift();
  }

  function snapshot() {
    if (!gm || !media) return null;
    try {
      const animationMs = gm.smoothTime.animation.currentTime;
      return {
        videoSeconds: Number.isFinite(media.currentTime) ? media.currentTime : null,
        baselineSeconds: Number.isFinite(gm._setCurrentTime) ? gm._setCurrentTime : null,
        clockSeconds: typeof animationMs === 'number' ? animationMs / 1000 : null,
        videoPlaybackRate: media.playbackRate,
        clockPlaybackRate: gm.smoothTime.animation.playbackRate,
        clockPlayState: gm.smoothTime.animation.playState,
        clockPending: gm.smoothTime.animation.pending,
        clockHoldActive: !!clockHold,
        videoPaused: media.paused, videoSeeking: media.seeking,
        nativeSeeking: gm.isSeeking(), nativeTimeSyncing: gm.isTimeSyncing()
      };
    } catch { return null; }
  }

  function inspectBinding() {
    // The content wrapper is NOT the identity of the HTMLVideoElement.
    // Read only the known active-content route; no discovery/object-graph scan.
    const contents = gm && ownValue(gm, 'contents');
    const current = gm ? gm.getCurrentContent() : null;
    const source = media ? media.currentSrc : '';
    const index = Array.isArray(contents) && current ? contents.indexOf(current) : -1;
    const mediaMatches = Array.isArray(contents) && media
      ? contents.filter(c => ownValue(c, 'media') === media).length : 0;
    const videoMatches = Array.isArray(contents)
      ? contents.filter(c => ownValue(c, 'id') === 'video').length : 0;
    return {
      current, source,
      checks: {
        pathUnchanged: location.pathname === initialPath,
        mediaConnected: !!media && media.isConnected,
        contentCount: Array.isArray(contents) ? contents.length : null,
        hasCurrentContent: !!current,
        currentIsRegistered: index >= 0,
        currentContentIndex: index,
        // Source: getCurrentTimeRaw accumulates only entries BEFORE the active one.
        // A following entry contributes nothing; do not guess a leading offset.
        timelineOffsetSeconds: index === 0 ? 0 : null,
        boundMediaRegistrations: mediaMatches,
        videoIdRegistrations: videoMatches,
        currentIsVideo: !!current && current.id === 'video',
        sameMediaElement: !!current && !!media && current.media === media,
        sameInitialContentObject: !!current && current === initialContent,
        sameLastContentObject: !!current && current === lastContent,
        initialContentStillUsesMedia: !!initialContent && initialContent.media === media,
        sourceEstablished: sourceIdentity !== null,
        sourceAvailable: !!source,
        sameMediaSource: sourceIdentity === null ? null : source === sourceIdentity
      }
    };
  }

  function bindingFailure(c) {
    if (!c.pathUnchanged) return 'route-changed';
    if (!c.mediaConnected) return 'media-detached';
    if (!Number.isInteger(c.contentCount) || c.contentCount < 1) return 'content-count-changed';
    if (!c.currentIsRegistered) return 'content-not-registered';
    if (!c.currentIsVideo) return 'unsupported-content-id';
    if (!c.sameMediaElement) return 'media-element-changed';
    if (c.currentContentIndex !== 0) return 'unsupported-leading-content';
    if (c.sourceEstablished && c.sourceAvailable && !c.sameMediaSource) return 'media-source-changed';
    return null;
  }

  function currentBindingReport() {
    if (!gm || !media) return null;
    try { return inspectBinding().checks; }
    catch { return { inspectionFailed: true }; }
  }

  function contentsReport() {
    if (!gm) return [];
    try {
      const contents = ownValue(gm, 'contents');
      if (!Array.isArray(contents)) return [];
      const current = gm.getCurrentContent();
      return contents.slice(0, 12).map((c, index) => {
        const element = ownValue(c, 'media');
        const isMedia = element instanceof HTMLMediaElement;
        return { index, isCurrent: c === current,
          isVideoId: ownValue(c, 'id') === 'video', isBoundMedia: element === media,
          isHTMLVideo: element instanceof HTMLVideoElement,
          readyState: isMedia ? element.readyState : null,
          durationSeconds: isMedia && Number.isFinite(element.duration) ? element.duration : null };
      });
    } catch { return []; }
  }

  function nativeTransition(eventType, checks) {
    // Do not interpret an intermediate native transition as permanent unbinding.
    // These functions are the already-captured GM's original state predicates.
    if (gm.isSeeking() || gm.isTimeSyncing()) {
      releaseClockHold('native-takeover');
      reject('native-seek', { ...checks, eventType }); return true;
    }
    if (gm._isExternalMediaControl()) {
      releaseClockHold('external-control-interruption');
      reject('external-control-interruption', { ...checks, eventType }); return true;
    }
    return false;
  }

  function onMetadata(event) {
    if (disposed || event.currentTarget !== media) return;
    try {
      const binding = inspectBinding();
      if (!binding.checks.pathUnchanged || !binding.checks.mediaConnected) {
        stop(!binding.checks.pathUnchanged ? 'route-changed' : 'media-detached',
          { ...binding.checks, eventType: event.type }); return;
      }
      if (nativeTransition(event.type, binding.checks)) return;
      const reason = bindingFailure(binding.checks);
      if (reason) { stop(reason, { ...binding.checks, eventType: event.type }); return; }
      // Initial binding can precede the first source/metadata. Establish once;
      // never adopt a different source later, even on the very same element.
      if (sourceIdentity === null && binding.source && media.readyState >= 1) {
        sourceIdentity = binding.source;
        record('source-established', event.type);
      }
    } catch { stop('source-inspection-error', { eventType: event.type }); }
  }

  function removeHook() {
    if (!hookActive) return;
    const current = getDescriptor(Object.prototype, 'smoothTime');
    // Never overwrite another extension's later replacement.
    if (current && current.set === captureClock) Reflect.deleteProperty(Object.prototype, 'smoothTime');
    hookActive = false;
  }

  function stop(reason = 'stopped-by-user', details = null) {
    if (disposed) return;
    disposed = true;
    if (perfSession) perfSession.finish('script-stopped');
    releaseClockHold(reason); // Undo only a pause owned by this addon; never seek.
    removeHook();
    clearTimeout(deadline);
    observer?.disconnect();
    listeners.abort();
    state.phase = 'stopped';
    state.reason = reason;
    stopDetails = details && { ...details };
    record('stopped', reason, null, null, stopDetails);
    // Do not reset clocks or seek on uninstall. Reload gives a clean instance.
  }

  function reject(reason, details = null) {
    state.skipped[reason] = (state.skipped[reason] || 0) + 1;
    state.reason = reason;
    record('skipped', reason, null, null, details);
  }

  function isSupportedGM(candidate, clock) {
    if (!Array.isArray(ownValue(candidate, 'contents'))) return false;
    const baseline = getDescriptor(candidate, '_setCurrentTime');
    if (!baseline || !baseline.writable || !Number.isFinite(baseline.value)) return false;
    if (typeof ownValue(candidate, '_isEnded') !== 'boolean') return false;
    for (const key of ['getCurrentContent', 'isReady', 'isSeeking', 'isTimeSyncing', 'getCurrentTimeRaw']) {
      if (typeof methodValue(candidate, key) !== 'function') return false;
    }
    if (typeof methodValue(candidate, '_isExternalMediaControl') !== 'function') return false;
    const rawGetter = methodValue(candidate, 'getCurrentTimeRaw');
    if (!knownRawGetters.has(rawGetter)) {
      const rawText = functionText.call(rawGetter).replace(/\s+/g, '');
      if (!rawText.includes('Math.max(this._setCurrentTime,') ||
          !rawText.includes('this.getCurrentContent()') ||
          !rawText.includes('this._externalControlSnapshot')) return false;
      knownRawGetters.add(rawGetter);
    }
    if (!(ownValue(clock, 'animation') instanceof Animation)) return false;
    const setter = ownValue(clock, 'onCurrentTimeChange');
    if (typeof setter !== 'function') return false;
    // A different function identity must pass the source check before invocation.
    if (!knownClockSetters.has(setter)) {
      const setterText = functionText.call(setter).replace(/\s+/g, '');
      if (!/^(?:\()?([A-Za-z_$][\w$]*)(?:\))?=>\{this\.animation\.currentTime=\1\*(?:1e3|1000);?\}$/.test(setterText)) return false;
      knownClockSetters.add(setter);
    }
    return true;
  }

  function captureClock(value) {
    // Preserve the normal own-data-property semantics for every receiver.
    const descriptor = Object.assign(Object.create(null), {
      value, writable: true, enumerable: true, configurable: true
    });
    if (!define(this, 'smoothTime', descriptor)) throw new TypeError('Cannot define smoothTime');
    try {
      if (disposed || gm) return;
      if (!isSupportedGM(this, value)) { state.rejectedCandidates++; return; }
      gm = this;
      state.phase = 'waiting-for-video';
      removeHook(); // One capture only. Never leave the prototype hook installed.
      // Constructor completes first; content is usually registered afterwards.
      queueMicrotask(bindVideo);
    } catch { state.rejectedCandidates++; }
  }

  function bindVideo() {
    if (disposed || !gm || media) return;
    try {
      if (location.pathname !== initialPath) { stop('route-changed'); return; }
      if (gm.contents.length < 1) { state.reason = 'waiting-for-video-content'; return; }
      const content = gm.getCurrentContent();
      if (!content || content !== gm.contents[0] || content.id !== 'video') {
        state.reason = 'unsupported-content'; return;
      }
      if (!(content.media instanceof HTMLVideoElement) || !content.media.isConnected) return;
      media = content.media;
      initialContent = content;
      lastContent = content;
      if (media.readyState >= 1 && media.currentSrc) sourceIdentity = media.currentSrc;
      media.addEventListener('loadedmetadata', onMetadata, { capture: true, passive: true, signal: listeners.signal });
      for (const event of ['seeking', 'seeked']) {
        media.addEventListener(event, onSeekEvent, { capture: true, passive: true, signal: listeners.signal });
      }
      for (const event of ['play', 'playing', 'pause', 'ratechange']) {
        media.addEventListener(event, onTransportEvent, { capture: true, passive: true, signal: listeners.signal });
      }
      for (const event of ['emptied', 'error']) {
        media.addEventListener(event, onMediaReset, { capture: true, passive: true, signal: listeners.signal });
      }
      clearTimeout(deadline);
      observer?.disconnect();
      state.phase = 'active';
      state.reason = null;
      record('attached', null);
      console.info('[NicoSeekSync] 内部時計同期の実験版を接続しました。実サイトでの動作保証はありません。');
    } catch { stop('attachment-error'); }
  }

  // This is a scoped hold of an already-identified internal Web Animation,
  // not a media pause and not a new clock. No native player state flags change.
  function scheduleHoldCheck() {
    if (clockHold && !holdFrame) {
      holdFrame = requestAnimationFrame(() => { holdFrame = 0; checkClockHold(); });
    }
  }

  function beginClockHold() {
    if (!antiJitter.enabled || clockHold || !media.seeking) return;
    const animation = gm.smoothTime.animation;
    if (animation.playState !== 'running' && animation.playState !== 'paused') return;
    clockHold = { animation, startedAt: performance.now(), restoreRunning: false,
      maxSampledLeadSeconds: 0, samples: 0 };
    antiJitter.holds++;
    holdDeadline = setTimeout(() => {
      if (!clockHold) return;
      antiJitter.timeouts++;
      antiJitter.enabled = false; // Revert to 0.1.2 event-only behavior until reload.
      releaseClockHold('hold-watchdog');
      record('anti-jitter-disabled', 'hold-watchdog');
    }, HOLD_LIMIT_MS);
    scheduleHoldCheck();
  }

  function pauseHeldClock() {
    if (!clockHold) return false;
    const animation = clockHold.animation;
    if (animation !== gm.smoothTime.animation) { releaseClockHold('clock-replaced'); return false; }
    if (animation.playState === 'idle' || animation.playState === 'finished') {
      releaseClockHold('clock-no-longer-active'); return false;
    }
    if (animation.playState === 'running') {
      clockHold.restoreRunning = true;
      Reflect.apply(nativeAnimationPause, animation, []);
      return true; // The subsequent native clock setter flushes a pending pause.
    }
    return animation.pending;
  }

  function releaseClockHold(reason) {
    const hold = clockHold;
    if (!hold) return;
    clockHold = null; // Invalidate pending callbacks before touching the Animation.
    if (holdFrame) cancelAnimationFrame(holdFrame);
    clearTimeout(holdDeadline);
    holdFrame = 0;
    holdDeadline = 0;
    let resumed = false;
    try {
      // Never resurrect an idle/disposed/replaced clock or restart a user's pause.
      // Restore ONLY a running state that this addon itself interrupted.
      if (hold.restoreRunning && gm && media &&
          hold.animation === gm.smoothTime.animation &&
          hold.animation.playState === 'paused' &&
          !media.paused && !media.ended && !gm._isEnded && ownValue(gm, 'paused') === false) {
        Reflect.apply(nativeAnimationPlay, hold.animation, []);
        resumed = true;
      }
    } catch {
      antiJitter.releaseErrors++;
      antiJitter.enabled = false;
    }
    antiJitter.releases++;
    antiJitter.lastHold = { reason, durationMs: Math.round(performance.now() - hold.startedAt),
      resumed, samples: hold.samples, maxSampledLeadSeconds: hold.maxSampledLeadSeconds };
    record('clock-hold-ended', reason, null, null, antiJitter.lastHold);
  }

  function alignClocks(target, before, reason, force = false) {
    if (!force && before && before.clockSeconds !== null &&
        Math.abs(gm._setCurrentTime - target) <= EPSILON_SECONDS &&
        Math.abs(before.clockSeconds - target) <= EPSILON_SECONDS) {
      state.unchanged++; state.reason = null; return;
    }
    // The two clock updates are unchanged from the working 0.1.2 baseline.
    // With an Animation pause pending, the clock setter also completes that pause.
    gm.smoothTime.onCurrentTimeChange(target);
    gm._setCurrentTime = target;
    state.corrections++;
    state.reason = null;
    record('synchronized', reason, target, before);
  }

  function holdBindingFailure() {
    // Same identity/scope guards as bindingFailure, without counts/diagnostic objects.
    // Only the active first content matters; trailing entries remain supported.
    const contents = ownValue(gm, 'contents');
    if (!Array.isArray(contents) || contents.length < 1) return 'content-count-changed';
    const current = gm.getCurrentContent();
    if (!current || contents.indexOf(current) < 0) return 'content-not-registered';
    if (current.id !== 'video') return 'unsupported-content-id';
    if (current.media !== media) return 'media-element-changed';
    if (current !== contents[0]) return 'unsupported-leading-content';
    const source = media.currentSrc;
    if (sourceIdentity !== null && source && source !== sourceIdentity) return 'media-source-changed';
    return null;
  }

  function checkClockHold() {
    if (!clockHold || disposed) return;
    const measurement = perfSession;
    const enteredAt = measurement ? performance.now() : 0;
    try {
      if (location.pathname !== initialPath || !media.isConnected) {
        stop(location.pathname !== initialPath ? 'route-changed' : 'media-detached', currentBindingReport()); return;
      }
      // Still checked every frame, BEFORE mutable content validation.
      if (gm.isSeeking() || gm.isTimeSyncing() || gm._isExternalMediaControl()) {
        releaseClockHold('native-takeover'); return;
      }
      const reason = holdBindingFailure();
      if (reason) { stop(reason, currentBindingReport()); return; }
      const animation = gm.smoothTime.animation;
      if (clockHold.animation !== animation) { releaseClockHold('clock-replaced'); return; }
      const playState = animation.playState;
      if (gm._isEnded || media.ended || playState === 'idle' || playState === 'finished') {
        releaseClockHold('clock-no-longer-active'); return;
      }
      if (!media.currentSrc || media.readyState < 1 || !isSupportedGM(gm, gm.smoothTime)) {
        stop('clock-hold-state-unavailable', currentBindingReport()); return;
      }
      const target = media.currentTime; // Always fresh, including coalesced seeks.
      if (!Number.isFinite(target) || target < 0 || !Number.isFinite(media.duration) ||
          target >= media.duration) { releaseClockHold('out-of-scope-time'); return; }
      const animationMs = animation.currentTime;
      const clockSeconds = typeof animationMs === 'number' ? animationMs / 1000 : null;
      if (clockSeconds !== null) {
        clockHold.samples++;
        clockHold.maxSampledLeadSeconds = Math.max(clockHold.maxSampledLeadSeconds, clockSeconds - target);
      }
      if (!media.seeking) {
        alignClocks(target, snapshot(), 'hold-end-observed');
        releaseClockHold('hold-end-observed');
        return;
      }
      const pausedNow = pauseHeldClock();
      if (!clockHold) return;
      // No full snapshot/count scans when the held clock is already aligned.
      if (pausedNow || clockSeconds === null ||
          Math.abs(clockSeconds - target) > EPSILON_SECONDS ||
          Math.abs(gm._setCurrentTime - target) > EPSILON_SECONDS) {
        alignClocks(target, snapshot(), 'clock-hold-follow', pausedNow);
      }
      scheduleHoldCheck(); // Same cadence as 0.1.3; no monitor outside a seek hold.
    } catch { stop('clock-hold-error'); }
    finally { if (measurement) noteMeasuredCost(measurement, 'holdCheck', enteredAt); }
  }

  function onTransportEvent(event) {
    if (!clockHold || disposed || event.currentTarget !== media || !event.isTrusted) return;
    const hold = clockHold;
    // Let the site's own play/pause/rate handlers run first. No handler replacement.
    queueMicrotask(() => { if (clockHold === hold && !disposed) checkClockHold(); });
  }

  function onMediaReset(event) {
    if (clockHold && !disposed && event.currentTarget === media && event.isTrusted) {
      stop('media-reset-during-hold', { eventType: event.type });
    }
  }

  function onSeekEvent(event) {
    if (disposed || event.currentTarget !== media) return;
    state.events++;
    const measurement = perfSession;
    const enteredAt = measurement ? performance.now() : 0;
    try {
      if (!event.isTrusted) { reject('synthetic-event'); return; }
      const binding = inspectBinding();
      if (!binding.checks.pathUnchanged || !binding.checks.mediaConnected) {
        stop(!binding.checks.pathUnchanged ? 'route-changed' : 'media-detached',
          { ...binding.checks, eventType: event.type }); return;
      }
      if (nativeTransition(event.type, binding.checks)) return;
      const reason = bindingFailure(binding.checks);
      if (reason) { stop(reason, { ...binding.checks, eventType: event.type }); return; }
      // Missing source/metadata is not a license to guess a timeline.
      if (!binding.source || media.readyState < 1) { reject('media-source-not-ready'); return; }
      if (sourceIdentity === null) {
        sourceIdentity = binding.source;
        record('source-established', event.type);
      }
      if (binding.current !== lastContent) {
        lastContent = binding.current;
        state.contentWrapperUpdates++;
        record('content-wrapper-updated', 'same-media-and-source', null, null,
          { ...inspectBinding().checks, eventType: event.type });
      }
      // Native transition guards have already run before mutable-content checks.
      // No delayed repair queue and no native seek call is introduced.
      if (gm._isEnded || media.ended) { reject('ended-state'); return; }
      // GM.isReady() requires EVERY registered entry to have metadata. An unused
      // trailing entry need not be ready to read the first video's clock.
      // Only the active, identity-checked video's metadata is needed here.
      if (media.readyState < 1) { reject('media-not-ready'); return; }
      if (!isSupportedGM(gm, gm.smoothTime)) { stop('implementation-changed'); return; }
      if (gm.smoothTime.animation.playState === 'finished') { reject('finished-clock'); return; }
      const target = media.currentTime; // Fresh final position; no remembered delta.
      if (!Number.isFinite(target) || target < 0 || !Number.isFinite(media.duration) ||
          target >= media.duration) { reject('out-of-scope-time'); return; }
      const before = snapshot();
      if (event.type === 'seeking' && media.seeking) beginClockHold();
      const pausedNow = clockHold ? pauseHeldClock() : false;
      alignClocks(target, before, event.type, pausedNow);
      if (clockHold && !media.seeking) releaseClockHold('seeked');
      // Intentionally NO media.currentTime assignment, native seek call, event
      // broadcast, media play/pause, playbackRate write or comment-renderer reset.
    } catch {
      stop('synchronization-error');
      console.warn('[NicoSeekSync] 想定外の内部状態のため停止しました。再読み込みして診断してください。');
    } finally { if (measurement) noteMeasuredCost(measurement, 'seekEvent', enteredAt); }
  }

  // ON-DEMAND diagnostics only. No network, resource URLs or origin attribution.
  // Callback timings are NOT whole-page CPU or network speed measurements.
  function noteMeasuredCost(session, key, start) {
    const m = session.script[key];
    const elapsed = performance.now() - start;
    m.calls++; m.totalMs += elapsed; m.maxMs = Math.max(m.maxMs, elapsed);
  }

  function mediaHealth() {
    if (!media) return null;
    try {
      const t = media.currentTime;
      const ranges = media.buffered;
      let ahead = 0;
      for (let i = 0; i < ranges.length; i++) {
        if (ranges.start(i) <= t && t < ranges.end(i)) { ahead = ranges.end(i) - t; break; }
      }
      return { videoSeconds: Number.isFinite(t) ? t : null,
        bufferedAheadSeconds: ahead, readyState: media.readyState,
        networkState: media.networkState, paused: media.paused, seeking: media.seeking,
        playbackRate: media.playbackRate, hidden: document.hidden };
    } catch { return null; }
  }

  function videoQuality() {
    try {
      if (typeof media.getVideoPlaybackQuality !== 'function') return null;
      const q = media.getVideoPlaybackQuality();
      return { total: q.totalVideoFrames, dropped: q.droppedVideoFrames };
    } catch { return null; }
  }

  function measurePerformance(durationMs = 20000) {
    if (typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs < 500 || durationMs > 60000) {
      return Promise.reject(new RangeError('Duration must be 500..60000 milliseconds.'));
    }
    if (disposed || !media || state.phase !== 'active') return Promise.reject(new Error('Player is not active.'));
    if (perfSession) return Promise.reject(new Error('A measurement is already running.'));
    return new Promise(resolve => {
      const start = performance.now();
      const session = { script: {
        holdCheck: { calls: 0, totalMs: 0, maxMs: 0 },
        seekEvent: { calls: 0, totalMs: 0, maxMs: 0 }
      }, finish: null };
      const aborter = new AbortController();
      const initialQuality = videoQuality();
      const mediaEvents = { seeking: 0, seeked: 0, waiting: 0, stalled: 0, playing: 0, pause: 0 };
      const samples = { count: 0, hidden: 0, lowReadyDuringSeek: 0,
        lowReadyOutsideSeek: 0, minBufferedAheadSeconds: null };
      const longTasks = { supported: false, count: 0, totalMs: 0, maxMs: 0 };
      const eventSamples = [];
      let sampleTimer = 0, endTimer = 0, observer = null, closed = false;
      let seekingSince = media.seeking ? start : null, seekingMs = 0;
      const initialHealth = mediaHealth();
      const takeSample = () => {
        const h = mediaHealth();
        if (!h) return;
        samples.count++;
        if (h.hidden) samples.hidden++;
        if (!h.paused && h.readyState <= 2) {
          samples[h.seeking ? 'lowReadyDuringSeek' : 'lowReadyOutsideSeek']++;
        }
        if (!h.paused) samples.minBufferedAheadSeconds = samples.minBufferedAheadSeconds === null
          ? h.bufferedAheadSeconds : Math.min(samples.minBufferedAheadSeconds, h.bufferedAheadSeconds);
      };
      const addLongTasks = entries => {
        for (const entry of entries) {
          if (entry.startTime < start) continue;
          longTasks.count++; longTasks.totalMs += entry.duration;
          longTasks.maxMs = Math.max(longTasks.maxMs, entry.duration);
        }
      };
      session.finish = (finishReason = 'duration-elapsed') => {
        if (closed) return;
        closed = true;
        clearInterval(sampleTimer); clearTimeout(endTimer); aborter.abort();
        if (observer) {
          try { addLongTasks(observer.takeRecords()); observer.disconnect(); } catch { /* optional API */ }
        }
        takeSample();
        const end = performance.now();
        if (seekingSince !== null) seekingMs += end - seekingSince;
        const endQuality = videoQuality();
        const frames = { supported: !!initialQuality && !!endQuality, counterReset: false,
          totalDelta: null, droppedDelta: null };
        if (frames.supported) {
          frames.counterReset = endQuality.total < initialQuality.total || endQuality.dropped < initialQuality.dropped;
          if (!frames.counterReset) {
            frames.totalDelta = endQuality.total - initialQuality.total;
            frames.droppedDelta = endQuality.dropped - initialQuality.dropped;
          }
        }
        lastMeasurement = { scope: 'LOCAL_CALLBACKS_AND_MEDIA_SIGNALS_NOT_CAUSAL_ATTRIBUTION',
          version: VERSION, requestedMs: durationMs, elapsedMs: end - start, finishReason,
          script: session.script, mediaEvents, observedSeekingMs: seekingMs,
          samples, longTasks, frames, initialHealth, finalHealth: mediaHealth(), eventSamples };
        perfSession = null;
        resolve(JSON.parse(JSON.stringify(lastMeasurement)));
      };
      perfSession = session;
      for (const type of Object.keys(mediaEvents)) {
        media.addEventListener(type, event => {
          if (!event.isTrusted || closed) return;
          mediaEvents[type]++;
          const now = performance.now();
          if (type === 'seeking' && seekingSince === null) seekingSince = now;
          if (type === 'seeked' && seekingSince !== null) { seekingMs += now - seekingSince; seekingSince = null; }
          if (type === 'waiting' || type === 'stalled') {
            eventSamples.push({ type, elapsedMs: now - start, health: mediaHealth() });
            if (eventSamples.length > 12) eventSamples.shift();
          }
        }, { passive: true, signal: aborter.signal });
      }
      try {
        if (typeof PerformanceObserver === 'function' && PerformanceObserver.supportedEntryTypes.includes('longtask')) {
          observer = new PerformanceObserver(list => addLongTasks(list.getEntries()));
          observer.observe({ type: 'longtask' }); // Do not replay activity before this measurement.
          longTasks.supported = true;
        }
      } catch { observer?.disconnect(); observer = null; }
      takeSample();
      sampleTimer = setInterval(takeSample, 250);
      endTimer = setTimeout(() => session.finish(), durationMs);
    });
  }

  function report() {
    return {
      version: VERSION,
      components: { speed: '1.1', seek: '0.1.4' },
      validation: 'LOCAL_MODEL_ONLY_LIVE_SITE_UNVERIFIED',
      phase: state.phase, reason: state.reason,
      stopDetails: stopDetails && { ...stopDetails },
      binding: currentBindingReport(),
      contents: contentsReport(),
      performance: { measuring: !!perfSession,
        lastMeasurement: lastMeasurement ? JSON.parse(JSON.stringify(lastMeasurement)) : null },
      antiJitter: { enabled: antiJitter.enabled, holding: !!clockHold,
        monitorScheduled: !!holdFrame, holds: antiJitter.holds, releases: antiJitter.releases,
        timeouts: antiJitter.timeouts, releaseErrors: antiJitter.releaseErrors,
        currentHoldMs: clockHold ? Math.round(performance.now() - clockHold.startedAt) : null,
        lastHold: antiJitter.lastHold && { ...antiJitter.lastHold } },
      hookActive, bound: !!media && !disposed,
      counters: { events: state.events, corrections: state.corrections,
        unchanged: state.unchanged, contentWrapperUpdates: state.contentWrapperUpdates,
        rejectedCandidates: state.rejectedCandidates,
        skipped: { ...state.skipped } },
      snapshot: snapshot(),
      recent: records.map(x => ({ ...x, before: x.before && { ...x.before }, after: x.after && { ...x.after },
        details: x.details && { ...x.details } }))
    };
  }

  define(window, API_NAME, { value: Object.freeze({ version: VERSION, report, stop, measurePerformance }), configurable: true });
  window.addEventListener('pagehide', () => stop('page-hidden-or-unloaded'), { once: true, signal: listeners.signal });

  // A bounded, source-confirmed construction hook, NOT arbitrary object search.
  if (Reflect.has(Object.prototype, 'smoothTime')) {
    stop('existing-smoothTime-prototype-property');
    console.warn('[NicoSeekSync] 既存のsmoothTime定義があるため接続しませんでした。');
    return;
  }
  const hookDescriptor = Object.assign(Object.create(null), {
    configurable: true, enumerable: false, get() { return undefined; }, set: captureClock
  });
  if (!define(Object.prototype, 'smoothTime', hookDescriptor)) { stop('hook-unavailable'); return; }
  hookActive = true;
  observer = new MutationObserver(bindVideo);
  observer.observe(document, { subtree: true, childList: true });
  deadline = setTimeout(() => {
    stop('discovery-timeout');
    console.warn('[NicoSeekSync] 対応プレイヤーを取得できませんでした。document-start/page環境と再読み込みを確認してください。');
  }, DEADLINE_MS);
})();
// END SEEK MODULE

})();
