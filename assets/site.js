/* Every page: the menu, the search box with suggestions, the Terms bar, lead forms and "show on a map".
   Forms post to the Hub's agent-site-lead function (body data-lead) with this site's id (data-site); the body goes as
   text so the browser skips a CORS preflight, and the function reads it as JSON. */
(function () {
  var B = document.body, D = B.dataset, AS = window.AS;
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };

  // menu, the page we're on
  var btn = document.querySelector('.menu-btn'), nav = document.getElementById('nav');
  var top = document.querySelector('.top');
  if (btn) btn.addEventListener('click', function () { var o = nav.classList.toggle('open'); btn.setAttribute('aria-expanded', o ? 'true' : 'false'); solid(); });
  // the home page's header lies clear over the photo until the page scrolls (or the menu opens)
  function solid() { if (top) top.classList.toggle('solid', D.page !== 'home' || window.scrollY > 40 || nav.classList.contains('open')); }
  solid(); window.addEventListener('scroll', solid, { passive: true });
  $$('.nav [data-k="' + D.page + '"]').forEach(function (a) { a.classList.add('on'); });
  // on a phone (the menu button showing) a heading with a list opens it instead of leaving the page
  $$('.dd > a').forEach(function (a) {
    a.addEventListener('click', function (e) {
      if (!btn || getComputedStyle(btn).display === 'none') return;
      e.preventDefault(); a.parentNode.classList.toggle('open');
    });
  });

  var bar = document.querySelector('.termsbar');
  try { if (bar && !localStorage.getItem('termsOk')) bar.hidden = false; } catch (e) { if (bar) bar.hidden = false; }
  if (bar) bar.querySelector('button').addEventListener('click', function () { bar.hidden = true; try { localStorage.setItem('termsOk', '1'); } catch (e) {} });

  // ---- the search box: places first (towns, areas, communities), then addresses and MLS® numbers
  var norm = function (s) { return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9#]+/g, ' ').trim(); };
  $$('.omni').forEach(function (f) {
    var inp = f.querySelector('input'), list = f.querySelector('.omni-list'), items = [], sel = -1, t;
    function show(xs) {
      items = xs; sel = -1;
      list.innerHTML = xs.map(function (x, i) {
        return '<a href="' + x.u + '" data-i="' + i + '" role="option"><span class="k">' + AS.esc(x.k) + '</span><b>' + AS.esc(x.n) + '</b><small>' + AS.esc(x.s || '') + '</small></a>';
      }).join('');
      list.classList.toggle('on', xs.length > 0);
    }
    function find() {
      var q = norm(inp.value);
      if (q.length < 2) return show([]);
      Promise.all([AS.data('places').catch(function () { return []; }), q.length >= 3 ? AS.data('listings').catch(function () { return []; }) : Promise.resolve([])])
        .then(function (r) {
          if (norm(inp.value) !== q) return;
          var out = r[0].filter(function (p) { return norm(p.n).indexOf(q) === 0 || norm(p.n).indexOf(' ' + q) >= 0; })
            .sort(function (a, b) { return (norm(b.n).indexOf(q) === 0) - (norm(a.n).indexOf(q) === 0) || b.c - a.c; }).slice(0, 5)
            .map(function (p) { return { k: p.k, n: p.n, s: (p.c ? p.c.toLocaleString('en-CA') + ' for sale · ' : '') + p.s, u: p.u }; });
          r[1].forEach(function (x) {
            if (out.length >= 8) return;
            var mls = norm(x.m), addr = norm(x.a);
            if (mls.indexOf(q) === 0 || (addr && addr.indexOf(q) >= 0)) out.push({ k: mls.indexOf(q) === 0 ? 'MLS®' : 'Address', n: x.a || x.m, s: AS.money(x.p) + ' · ' + x.h, u: AS.root + 'listing/?mls=' + encodeURIComponent(x.m) });
          });
          show(out);
        });
    }
    // the hero search: Buy | Sell (Sell takes the address to the home value page) and Refine
    var modeBox = f.querySelector('.hs-mode'), panel = f.querySelector('.hs-panel'), filt = f.querySelector('.hs-filt');
    var go = f.querySelector('.hs-go span'), MODE = 'buy';
    var sell = function () { return MODE === 'sell'; };
    if (modeBox) modeBox.addEventListener('click', function (e) {
      var b = e.target.closest('[data-mode]'); if (!b) return;
      MODE = b.dataset.mode;
      $$('[data-mode]', modeBox).forEach(function (x) { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b ? 'true' : 'false'); });
      f.classList.toggle('selling', sell());
      inp.placeholder = sell() ? "Your home's address" : 'City, community, address or MLS® number';
      if (go) go.textContent = sell() ? 'Get my value' : 'Search';
      if (panel) { panel.hidden = true; filt.setAttribute('aria-expanded', 'false'); }
      show([]); inp.focus();
    });
    var count = function () {
      var n = $$('select', panel).filter(function (s) { return s.value; }).length, b = filt.querySelector('.hs-n');
      b.hidden = !n; b.textContent = n;
    };
    window.addEventListener('pageshow', function () { if (panel) $$('select', panel).forEach(function (s) { s.disabled = false; }); });   // back from the results
    if (filt) {
      filt.addEventListener('click', function () { panel.hidden = !panel.hidden; filt.setAttribute('aria-expanded', panel.hidden ? 'false' : 'true'); list.classList.remove('on'); });
      panel.addEventListener('change', count);
    }
    // Sell: Google's address suggestions (when the site has a key); picking one goes to the home value page with it
    var gfind = function () {
      var q = inp.value.trim();
      if (q.length < 4 || !AS.maps) return show([]);
      AS.gsuggest(q).then(function (xs) {
        if (inp.value.trim() !== q || !sell()) return;
        show(xs.map(function (x) { return { k: 'Address', n: x.n, s: x.s, u: f.dataset.sell + '?address=' + encodeURIComponent(x.full), g: x }; }));
      }).catch(function () { show([]); });
    };
    var goSell = function (x) {
      AS.gpick(x.g).then(function (p) { location.href = f.dataset.sell + '?address=' + encodeURIComponent(p.address) + '&lat=' + p.lat + '&lng=' + p.lng; })
        .catch(function () { location.href = x.u; });
    };
    list.addEventListener('click', function (e) {
      var a = e.target.closest('a[data-i]'); if (!a) return;
      var x = items[+a.dataset.i]; if (x && x.g) { e.preventDefault(); goSell(x); }
    });
    inp.addEventListener('input', function () { clearTimeout(t); t = setTimeout(sell() ? gfind : find, sell() ? 220 : 120); });
    inp.addEventListener('focus', function () { if (inp.value) find(); });
    inp.addEventListener('keydown', function (e) {
      if (!items.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        $$('a', list).forEach(function (a, i) { a.classList.toggle('sel', i === sel); });
      } else if (e.key === 'Escape') show([]);
    });
    f.addEventListener('submit', function (e) {
      if (sell() && sel >= 0 && items[sel] && items[sel].g) { e.preventDefault(); goSell(items[sel]); return; }
      if (sell()) { e.preventDefault(); location.href = f.dataset.sell + (inp.value.trim() ? '?address=' + encodeURIComponent(inp.value.trim()) : ''); return; }
      if (panel) $$('select', panel).forEach(function (s) { s.disabled = !s.value; });   // only the filters set go in the address
      if (sel >= 0 && items[sel]) { e.preventDefault(); location.href = items[sel].u; return; }
      if (items.length === 1 || (items[0] && norm(items[0].n) === norm(inp.value))) { e.preventDefault(); location.href = items[0].u; }
    });
    document.addEventListener('click', function (e) {
      if (!f.contains(e.target)) { list.classList.remove('on'); if (panel) { panel.hidden = true; filt.setAttribute('aria-expanded', 'false'); } }
    });
  });

  // ---- listing tabs on the home page
  $$('.tabs').forEach(function (t) {
    var sec = t.closest('section');
    t.addEventListener('click', function (e) {
      var b = e.target.closest('[data-tab]'); if (!b) return;
      $$('[data-tab]', t).forEach(function (x) { x.classList.toggle('on', x === b); });
      $$('[data-pane]', sec).forEach(function (p) { p.hidden = p.dataset.pane !== b.dataset.tab; });
    });
  });

  // ---- "show these homes on a map" (community pages)
  $$('.mapbox').forEach(function (box) {
    box.querySelector('button').addEventListener('click', function () {
      var pts = JSON.parse(box.dataset.pts || '[]'), want = {};
      pts.forEach(function (p) { want[p[3]] = 1; });
      box.innerHTML = ''; box.classList.add('on');
      AS.data('listings').then(function (rows) { return AS.map(box, rows.filter(function (x) { return want[x.m]; })); })
        .catch(function () { box.textContent = "The map couldn't load."; });
    });
  });

  // ---- lead forms
  function phone(v) {
    var d = (v || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
    return d.length === 10 ? d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6) : v;
  }
  $$('form.lead').forEach(function (f) {
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var msg = f.querySelector('.form-msg'), go = f.querySelector('button[type=submit]');
      var data = { site: D.site, form_type: f.dataset.type, page: location.href, preview: !!document.querySelector('.previewbar') };
      new FormData(f).forEach(function (v, k) { data[k] = typeof v === 'string' ? v.trim() : v; });
      data.phone = phone(data.phone);
      var c = f.querySelector('.consent') || f.querySelector('.fine');
      data.consent = data.consent === 'yes' ? 'yes' : 'no';
      data.consent_text = c ? c.textContent.trim() : '';
      data.consent_at = new Date().toISOString();
      go.disabled = true; msg.className = 'form-msg'; msg.textContent = 'Sending…';
      fetch(D.lead, { method: 'POST', body: JSON.stringify(data) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || !j.ok) throw j; }); })
        .then(function () {
          msg.className = 'form-msg ok';
          msg.textContent = f.dataset.type === 'alert' ? "You're on the list. New homes will come to your inbox." : 'Thanks! ' + (D.agent || 'I') + ' will be in touch shortly.';
          f.reset();
          if (window.gtag) { gtag('event', 'generate_lead', { form_type: f.dataset.type }); if (window.ADS_SEND) gtag('event', 'conversion', { send_to: window.ADS_SEND }); }
          if (window.fbq) fbq('track', 'Lead');
        })
        .catch(function () { msg.className = 'form-msg err'; msg.textContent = "That didn't send. Please call or email instead."; })
        .then(function () { go.disabled = false; });
    });
  });
})();
