/* Cascades: People Infrastructure Gap lead capture
   - gated form (HubSpot Forms API + Netlify Forms backup)
   - desktop pop-up / mobile banner
   - privacy-conscious event tracking (fires only into tools you have installed) */
(function () {
  'use strict';

  /* ---------- CONFIG: fill in from HubSpot (Marketing > Forms > form > Share > Embed code) ---------- */
  var HUBSPOT = {
    portalId: '247696322',
    formGuid: ''    // e.g. 'a1b2c3d4-....'
  };
  var DOC_URL = 'people-infrastructure-gap.html';
  var LANDING = 'checklist.html';
  var DISMISS_DAYS = 14;
  var K = { done: 'cascades_pig_download', dismissed: 'cascades_pig_dismissed', shown: 'cascades_pig_shown', utm: 'cascades_utm' };

  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function ss(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { return null; } }

  /* ---------- tracking ---------- */
  function track(name, props) {
    props = props || {};
    try { (window.dataLayer = window.dataLayer || []).push(Object.assign({ event: name }, props)); } catch (e) {}
    try { if (typeof window.plausible === 'function') window.plausible(name, { props: props }); } catch (e) {}
    try { if (typeof window.gtag === 'function') window.gtag('event', name, props); } catch (e) {}
    try { if (window._hsq) window._hsq.push(['trackCustomBehavioralEvent', { name: name, properties: props }]); } catch (e) {}
  }
  window.cascadesTrack = track;

  /* ---------- keep first-touch attribution for the session ---------- */
  (function captureUtm() {
    if (ss(K.utm)) return;
    var p = new URLSearchParams(location.search), o = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (k) { if (p.get(k)) o[k] = p.get(k); });
    o.referrer = document.referrer || '';
    o.landing_page = location.pathname;
    ss(K.utm, JSON.stringify(o));
  })();
  function utm() { try { return JSON.parse(ss(K.utm) || '{}'); } catch (e) { return {}; } }
  function cookie(n) { var m = document.cookie.match('(?:^|; )' + n + '=([^;]*)'); return m ? decodeURIComponent(m[1]) : ''; }

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-track]');
    if (a) track(a.getAttribute('data-track'), { location: location.pathname });
  });

  /* ---------- gated form ---------- */
  var form = document.getElementById('pigForm');
  if (form) {
    var started = false, err = document.getElementById('pigErr');
    var src = new URLSearchParams(location.search).get('src') || 'direct';
    form.addEventListener('focusin', function () { if (!started) { started = true; track('pig_form_start', { src: src }); } });

    if (ls(K.done) === '1') showDone(false);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      err.hidden = true;
      var bad = [].slice.call(form.querySelectorAll('[required]')).filter(function (f) { return !f.value.trim() || (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.value.trim())); });
      form.querySelectorAll('[aria-invalid]').forEach(function (f) { f.removeAttribute('aria-invalid'); });
      if (bad.length) {
        bad.forEach(function (f) { f.setAttribute('aria-invalid', 'true'); });
        err.hidden = false; err.setAttribute('data-state', 'err');
        err.textContent = 'Please complete the highlighted fields' + (bad.some(function (f) { return f.type === 'email'; }) ? ' and use a valid business email.' : '.');
        bad[0].focus();
        return;
      }
      var btn = form.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = 'Preparing your checklist\u2026';

      var fd = new FormData(form), u = utm();
      var name = (fd.get('name') || '').trim().split(/\s+/);
      var consent = fd.get('marketing_consent') === 'yes';

      // 1) Netlify Forms backup (always): nothing is lost if HubSpot is misconfigured
      Object.keys(u).forEach(function (k) { fd.append(k, u[k]); });
      fd.append('entry_point', src);
      var netlify = fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fd).toString() });

      // 2) HubSpot Forms API (when configured)
      var hubspot = Promise.resolve({ ok: true, skipped: true });
      if (HUBSPOT.portalId && HUBSPOT.formGuid) {
        var fields = [
          { name: 'firstname', value: name[0] || '' },
          { name: 'lastname', value: name.slice(1).join(' ') },
          { name: 'email', value: (fd.get('email') || '').trim() },
          { name: 'company', value: (fd.get('company') || '').trim() },
          { name: 'jobtitle', value: (fd.get('jobtitle') || '').trim() },
          { name: 'hr_challenge', value: fd.get('hr_challenge') || '' },
          { name: 'cascades_lead_source', value: 'HR Checklist Download' },
          { name: 'cascades_service_interest', value: 'Fractional / Interim HR Leadership' },
          { name: 'cascades_entry_point', value: src }
        ];
        var payload = {
          fields: fields,
          context: { hutk: cookie('hubspotutk') || undefined, pageUri: location.href, pageName: document.title },
          legalConsentOptions: {
            consent: {
              consentToProcess: true,
              text: 'I agree to allow Cascades Human Capital Management to store and process my personal data to send the requested resource.',
              communications: [{ value: consent, subscriptionTypeId: 999, text: 'Occasional insights on HR leadership and workforce transformation.' }]
            }
          }
        };
        hubspot = fetch('https://api.hsforms.com/submissions/v3/integration/submit/' + HUBSPOT.portalId + '/' + HUBSPOT.formGuid, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
      }

      Promise.allSettled([netlify, hubspot]).then(function (r) {
        var anyOk = r.some(function (x) { return x.status === 'fulfilled' && x.value && x.value.ok && !x.value.skipped; });
        if (!anyOk) throw new Error('no destination accepted the submission');
        ls(K.done, '1');
        track('pig_form_complete', { src: src, challenge: fd.get('hr_challenge') || 'none', consent: consent ? 'yes' : 'no' });
        showDone(true);
      }).catch(function () {
        btn.disabled = false; btn.textContent = 'Get the executive checklist';
        err.hidden = false; err.setAttribute('data-state', 'err');
        err.innerHTML = 'Something went wrong. Please try again, or email <a href="mailto:admin@cascadeshcm.com">admin@cascadeshcm.com</a> and we will send it directly.';
      });
    });
  }
  function showDone(fresh) {
    var f = document.getElementById('dlForm'), d = document.getElementById('dlDone'), link = document.getElementById('dlLink');
    if (!f || !d) return;
    link.href = DOC_URL; // the document URL only enters the page after submission
    link.addEventListener('click', function () { track('pig_download', { location: location.pathname }); });
    f.hidden = true; d.hidden = false;
    if (fresh) d.focus();
  }

  /* ---------- pop-up (desktop) / banner (mobile) ---------- */
  var body = document.body;
  if (body.hasAttribute('data-no-popup') || form) return;
  if (ls(K.done) === '1' || ss(K.shown) === '1') return;
  var d = +ls(K.dismissed) || 0;
  if (d && Date.now() - d < DISMISS_DAYS * 864e5) return;

  var desktop = window.matchMedia('(min-width:961px) and (hover:hover)').matches;
  var fired = false, timer;

  function typing() { var a = document.activeElement; return a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName); }
  function scrolled(p) { var h = document.documentElement; return (h.scrollTop + innerHeight) / h.scrollHeight >= p; }
  function fire(trigger) {
    if (fired) return;
    if (typing()) { clearTimeout(timer); timer = setTimeout(function () { fire(trigger); }, 8000); return; }
    fired = true; ss(K.shown, '1');
    window.removeEventListener('scroll', onScroll);
    document.removeEventListener('mouseout', onExit);
    desktop ? openModal(trigger) : openBanner(trigger);
  }
  function onScroll() { if (scrolled(desktop ? 0.35 : 0.4)) fire('scroll'); }
  function onExit(e) { if (!e.relatedTarget && e.clientY <= 0) fire('exit_intent'); }

  window.addEventListener('scroll', onScroll, { passive: true });
  if (desktop) {
    timer = setTimeout(function () { fire('time_12s'); }, 12000);
    setTimeout(function () { document.addEventListener('mouseout', onExit); }, 4000);
  }

  function href(t) { return LANDING + '?src=' + (desktop ? 'popup' : 'banner') + '_' + t + '#get'; }

  function openModal(trigger) {
    var last = document.activeElement;
    var wrap = document.createElement('div');
    wrap.className = 'pig-pop';
    wrap.innerHTML =
      '<div class="pig-back" data-close></div>' +
      '<div class="pig-dlg" role="dialog" aria-modal="true" aria-labelledby="pigT" aria-describedby="pigD">' +
        '<button class="pig-x" type="button" data-close aria-label="Close">&times;</button>' +
        '<div class="pig-mock" aria-hidden="true"><div class="mock-page"><img src="assets/cascades-logo-white.png" alt=""/><span class="mock-k">Executive checklist</span><b class="mock-t">The People Infrastructure Gap</b><img class="mock-r" src="assets/ridge.svg" alt=""/></div></div>' +
        '<div class="pig-copy">' +
          '<span class="pig-k">Complimentary executive resource</span>' +
          '<h2 id="pigT">Has your business outgrown its HR infrastructure?</h2>' +
          '<p id="pigD">Identify the leadership, operational, and organizational gaps that could be holding back your next stage of growth. Download our complimentary 25-point executive checklist.</p>' +
          '<div class="pig-btns"><a class="btn btn-ink" href="' + href(trigger) + '" data-cta>Get the executive checklist</a><button class="pig-not" type="button" data-close>Not now</button></div>' +
        '</div>' +
      '</div>';
    body.appendChild(wrap);
    requestAnimationFrame(function () { wrap.classList.add('on'); });
    track('pig_popup_impression', { trigger: trigger, page: location.pathname });
    var dlg = wrap.querySelector('.pig-dlg'), focusables = dlg.querySelectorAll('a,button');
    focusables[focusables.length - 2].focus();
    function close(reason) {
      ls(K.dismissed, String(Date.now()));
      track('pig_popup_dismiss', { reason: reason });
      wrap.classList.remove('on');
      document.removeEventListener('keydown', key);
      setTimeout(function () { wrap.remove(); if (last && last.focus) last.focus(); }, 180);
    }
    function key(e) {
      if (e.key === 'Escape') close('escape');
      if (e.key === 'Tab') {
        var f = [].slice.call(focusables), i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    }
    document.addEventListener('keydown', key);
    wrap.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) close('click'); });
    wrap.querySelector('[data-cta]').addEventListener('click', function () { track('pig_popup_click', { trigger: trigger }); });
  }

  function openBanner(trigger) {
    var b = document.createElement('div');
    b.className = 'pig-banner';
    b.setAttribute('role', 'region');
    b.setAttribute('aria-label', 'Complimentary executive checklist');
    b.innerHTML = '<a href="' + href(trigger) + '" data-cta><b>Free executive checklist</b><span>Has your HR kept pace with growth?</span></a><button type="button" aria-label="Dismiss">&times;</button>';
    body.appendChild(b);
    requestAnimationFrame(function () { b.classList.add('on'); });
    track('pig_popup_impression', { trigger: trigger, format: 'banner', page: location.pathname });
    b.querySelector('button').addEventListener('click', function () { ls(K.dismissed, String(Date.now())); track('pig_popup_dismiss', { format: 'banner' }); b.remove(); });
    b.querySelector('[data-cta]').addEventListener('click', function () { track('pig_popup_click', { format: 'banner' }); });
  }
})();
