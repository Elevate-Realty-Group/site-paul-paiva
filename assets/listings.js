/* The search page: filters over data/listings.json, in a grid or on a map. Everything is in the URL, so a search can
   be shared, and the community pages' links (town=, area=, hood=, min=, type= ...) and the search box (q=) land here. */
(function () {
  var AS = window.AS, F = document.getElementById('filters');
  var OUT = document.getElementById('results'), COUNT = document.getElementById('count'), MORE = document.getElementById('more');
  var MAP = document.getElementById('map'), PILLS = document.getElementById('pills');
  var ALL = [], PLACES = [], hits = [], shown = 0, PAGE = 24, VIEW = 'grid';
  var MOREF = document.getElementById('moreF'), MOREB = document.getElementById('moreBtn'), MOREN = document.getElementById('moreN');
  var norm = function (s) { return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9#]+/g, ' ').trim(); };

  // the URL into the form (town= and area= from a community page's links become Where)
  var q = new URLSearchParams(location.search);
  // a page of its own for one filter (listed-this-week/, featured-listings/: build.py, homepage.PRESETS): set here,
  // and left out of its address
  var PRESET = window.PRESET || {};
  Object.keys(PRESET).forEach(function (k) { if (!q.has(k)) q.set(k, PRESET[k]); });
  if (q.get('town')) q.set('where', q.get('town') + (q.get('area') ? '|' + q.get('area') : ''));
  function setv(el, v) {
    if (el.type === 'checkbox') { el.checked = !!v && v !== '0'; return; }
    // a value the list doesn't offer (a listing page's year built, an old link's price): added, so the filter holds
    if (el.tagName === 'SELECT' && v && !Array.prototype.some.call(el.options, function (o) { return o.value === v; })) {
      var o = document.createElement('option'); o.value = v; o.textContent = el.name === 'yb' ? v + ' or newer' : /^\d+$/.test(v) && +v >= 1000 ? '$' + (+v).toLocaleString('en-CA') : v;
      el.appendChild(o);
    }
    el.value = v;
  }
  Array.prototype.forEach.call(F.elements, function (el) { if (el.name && q.has(el.name)) setv(el, q.get(el.name)); });
  var sortSel = document.querySelector('select[name=sort]');
  if (q.get('sort')) sortSel.value = q.get('sort');
  if (q.get('view') === 'map') VIEW = 'map';

  function vals() {
    var v = {}; Array.prototype.forEach.call(F.elements, function (el) { if (el.name) v[el.name] = el.type === 'checkbox' ? (el.checked ? '1' : '') : (el.value || '').trim(); });
    v.sort = sortSel.value; return v;
  }
  function placeName(kind, slug) { var p = PLACES.find(function (x) { return x.u.indexOf('/' + slug + '/') >= 0 && (!kind || x.k === kind); }); return p ? p.n : slug; }
  function pills(v) {
    var out = [];
    if (v.hood) out.push(['hood', placeName('Community', v.hood)]);
    if (v.mine) out.push(['mine', 'Featured listings']);
    if (v.ours) out.push(['ours', 'Our brokerage’s listings']);
    if (v.towns) out.push(['towns', v.towns.split(',').map(function (t) { return placeName('Town', t); }).join(', ')]);
    // the Filters panel's, each as it reads there; their count on the Filters button
    var n = 0;
    MOREF.querySelectorAll('[name]').forEach(function (el) {
      if (!v[el.name]) return; n++;
      out.push([el.name, el.type === 'checkbox' ? el.parentNode.textContent.trim() : el.closest('label').querySelector('span').textContent + ': ' + el.options[el.selectedIndex].text]);
    });
    MOREN.hidden = !n; MOREN.textContent = n;
    PILLS.innerHTML = out.map(function (p) { return '<button type="button" data-clear="' + p[0] + '">' + AS.esc(p[1]) + '</button>'; }).join('');
  }
  function run() {
    var v = vals();
    var p = new URLSearchParams();
    Object.keys(v).forEach(function (k) { if (v[k] && !(k === 'sort' && v[k] === 'new') && PRESET[k] !== v[k]) p.set(k, v[k]); });
    if (VIEW === 'map' && PRESET.view !== 'map') p.set('view', 'map');
    history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : ''));
    var w = v.where.split('|'), town = w[0], area = w[1] || '';
    var words = norm(v.q).split(' ').filter(Boolean), lo = +v.min || 0, hi = +v.max || 0, beds = +v.beds || 0, baths = +v.baths || 0;
    hits = ALL.filter(function (x) {
      if (town && x.ts !== town) return false;
      if (v.towns && v.towns.split(',').indexOf(x.ts) < 0) return false;
      if (area && x.q !== area) return false;
      if (v.hood && x.hs !== v.hood) return false;
      if (v.mine && !x.me) return false;
      if (v.ours && !x.ob) return false;
      if (v.new && x.d > +v.new) return false;
      if (v.type === 'luxury' ? (x.p || 0) < 1e6 : v.type && x.t !== v.type) return false;
      if (lo && (x.p || 0) < lo) return false;
      if (hi && (x.p || 0) > hi) return false;
      if (beds && (x.b || 0) < beds) return false;
      if (baths && (x.ba || 0) < baths) return false;
      // Filters (build.py filters_of): a home whose detail isn't known doesn't match a filter on it
      if (v.smin && !((x.s || 0) >= +v.smin)) return false;
      if (v.smax && !(x.s && x.s <= +v.smax)) return false;
      if (v.yb && !((x.yb || 0) >= +v.yb)) return false;
      if (v.st === '1' && !(x.st && x.st < 1.5)) return false;
      if (v.st === '2' && !((x.st || 0) >= 1.5)) return false;
      if (v.gar === 'any' && !x.g) return false;
      if (v.gar === '2' && !((x.gs || 0) >= 2)) return false;
      if (/^[adu]$/.test(v.gar) && x.g !== v.gar) return false;
      if (v.bs === 'f' && x.bs !== 'f') return false;
      if (v.bs === 'fp' && x.bs !== 'f' && x.bs !== 'p') return false;
      if (v.bs === 'any' && (!x.bs || x.bs === 'n')) return false;
      if (v.la && !((x.la || 0) >= +v.la)) return false;
      if (v.cf && !(x.cf && x.cf <= +v.cf)) return false;
      if (v.ac && !x.ac) return false;
      if (v.fp && !x.fp) return false;
      if (v.cut && !x.cu) return false;
      if (words.length) { var hay = norm([x.a, x.h, x.c, x.m].join(' ')); for (var i = 0; i < words.length; i++) if (hay.indexOf(words[i]) < 0) return false; }
      return true;
    });
    var s = v.sort;
    hits.sort(s === 'lo' ? function (a, b) { return (a.p || 0) - (b.p || 0); } :
              s === 'hi' ? function (a, b) { return (b.p || 0) - (a.p || 0); } :
              s === 'big' ? function (a, b) { return (b.s || 0) - (a.s || 0); } :
              PRESET.mine ? function (a, b) { return (b.me || 0) - (a.me || 0) || (b.at || 0) - (a.at || 0); } :
              function (a, b) { return (b.at || 0) - (a.at || 0) || a.d - b.d; });   // newest first, to the minute
    COUNT.textContent = hits.length.toLocaleString('en-CA') + (hits.length === 1 ? ' home' : ' homes') + ' for sale';
    pills(v);
    shown = 0; OUT.innerHTML = '';
    if (VIEW === 'map') { MAP.hidden = false; AS.map(MAP, hits); } else { MAP.hidden = true; }
    draw();
  }
  function draw() {
    OUT.insertAdjacentHTML('beforeend', hits.slice(shown, shown + PAGE).map(AS.card).join(''));
    shown = Math.min(hits.length, shown + PAGE);
    MORE.hidden = shown >= hits.length;
  }

  var t;
  F.addEventListener('input', function (e) { clearTimeout(t); t = setTimeout(run, e.target.name === 'q' ? 220 : 0); });
  F.addEventListener('change', run);
  F.addEventListener('submit', function (e) { e.preventDefault(); run(); });
  sortSel.addEventListener('change', run);
  MORE.addEventListener('click', draw);
  PILLS.addEventListener('click', function (e) {
    var k = e.target.getAttribute('data-clear'); if (!k) return;
    setv(F.elements[k], ''); run();
  });
  document.querySelectorAll('[data-view]').forEach(function (b) {
    b.classList.toggle('on', b.dataset.view === VIEW);
    b.addEventListener('click', function () {
      VIEW = b.dataset.view;
      document.querySelectorAll('[data-view]').forEach(function (x) { x.classList.toggle('on', x === b); });
      run();
    });
  });
  // ---- Filters: more ways to narrow the search, in a panel under the bar
  function moreOpen(o) { MOREF.hidden = !o; MOREB.setAttribute('aria-expanded', o ? 'true' : 'false'); }
  MOREB.addEventListener('click', function () { moreOpen(MOREF.hidden); });
  document.getElementById('moreDone').addEventListener('click', function () { moreOpen(false); });
  document.getElementById('moreClear').addEventListener('click', function () { MOREF.querySelectorAll('[name]').forEach(function (el) { setv(el, ''); }); run(); });

  // ---- Save search (Paul, November 12): the visitor's name, email and how often, with a title made from the search;
  // it goes to the agent as a listing alert sign-up (site.js lead forms), the search's own link with it
  var SS = document.getElementById('ss'), SF = SS.querySelector('form'), SN = document.getElementById('ssName');
  var PLURAL = { house: 'houses', condo: 'apartments', townhouse: 'townhouses', duplex: 'duplexes', luxury: 'luxury homes', mobile: 'mobile homes', acreage: 'acreages', land: 'lots', commercial: 'commercial properties' };
  var k = function (n) { return n >= 1e6 ? '$' + (n / 1e6).toFixed(n % 1e6 ? 1 : 0).replace(/\.0$/, '') + 'M' : '$' + Math.round(n / 1000) + 'K'; };
  function where(v) {
    if (v.hood) return placeName('Community', v.hood);
    if (v.where) { var o = F.elements.where; return o.options[o.selectedIndex].text.trim(); }
    if (v.towns) return v.towns.split(',').map(function (t) { return placeName('Town', t); }).join(' and ');
    if (v.q) return v.q;
    return '';
  }
  function title(v) {
    var t = (v.beds ? v.beds + '+ bed ' : '') + (v.type ? PLURAL[v.type] || 'homes' : 'homes'), w = where(v);
    if (w) t += ' in ' + w;
    var lo = +v.min || 0, hi = +v.max || 0;
    if (lo && hi) t += ', ' + k(lo) + '–' + k(hi); else if (hi) t += ' under ' + k(hi); else if (lo) t += ' over ' + k(lo);
    var x = [];
    if (v.gar) x.push(v.gar === '2' ? 'double garage' : v.gar === 'u' ? 'underground parking' : v.gar === 'a' ? 'attached garage' : v.gar === 'd' ? 'detached garage' : 'garage');
    if (v.bs === 'f' || v.bs === 'fp') x.push('finished basement');
    if (v.ac) x.push('A/C');
    if (v.yb) x.push('built ' + v.yb + '+');
    if (v.la) x.push(v.la + '+ acres');
    if (v.st === '1') x.push('bungalow');
    if (x.length) t += ' with ' + x.slice(0, 2).join(' and ');
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  function summary() {
    var v = vals(), out = [hits.length.toLocaleString('en-CA') + (hits.length === 1 ? ' home matches' : ' homes match') + ' now'];
    PILLS.querySelectorAll('button').forEach(function (b) { out.push(b.textContent); });
    return out.join(' · ');
  }
  function fill() {
    var v = vals(), f = SF.querySelector('input[name=frequency]:checked');
    document.getElementById('ssMsg').value = ['Saved search: ' + (SN.value.trim() || title(v)), 'Emails: ' + (f ? f.value : 'Instantly'),
      'Search: ' + summary(), 'Link: ' + location.href].join('\n');
  }
  function ssOpen(o) {
    SS.hidden = !o; document.documentElement.classList.toggle('ss-on', o);
    if (o) { SN.value = title(vals()); document.getElementById('ssSum').textContent = summary(); fill(); setTimeout(function () { SN.focus(); SN.select(); }, 30); }
  }
  document.getElementById('saveS').addEventListener('click', function () { ssOpen(true); });
  document.getElementById('ssX').addEventListener('click', function () { ssOpen(false); });
  SS.addEventListener('click', function (e) { if (e.target === SS) ssOpen(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !SS.hidden) ssOpen(false); });
  SF.addEventListener('input', fill); SF.addEventListener('change', fill);
  SF.addEventListener('submit', fill, true);   // before site.js sends it
  SF.addEventListener('sent', function () { setTimeout(function () { ssOpen(false); SF.querySelector('.form-msg').textContent = ''; }, 2600); });

  Promise.all([AS.data('listings'), AS.data('places').catch(function () { return []; })])
    .then(function (r) { ALL = r[0]; PLACES = r[1]; run(); })
    .catch(function () { COUNT.textContent = "Listings couldn't load. Please refresh the page."; });
})();
