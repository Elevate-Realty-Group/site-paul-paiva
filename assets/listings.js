/* The search page: filters over data/listings.json, in a grid or on a map. Everything is in the URL, so a search can
   be shared, and the community pages' links (town=, area=, hood=, min=, type= ...) and the search box (q=) land here. */
(function () {
  var AS = window.AS, F = document.getElementById('filters');
  var OUT = document.getElementById('results'), COUNT = document.getElementById('count'), MORE = document.getElementById('more');
  var MAP = document.getElementById('map'), PILLS = document.getElementById('pills');
  var ALL = [], PLACES = [], hits = [], shown = 0, PAGE = 24, VIEW = 'grid';
  var norm = function (s) { return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9#]+/g, ' ').trim(); };

  // the URL into the form (town= and area= from a community page's links become Where)
  var q = new URLSearchParams(location.search);
  if (q.get('town')) q.set('where', q.get('town') + (q.get('area') ? '|' + q.get('area') : ''));
  Array.prototype.forEach.call(F.elements, function (el) { if (el.name && q.has(el.name)) el.value = q.get(el.name); });
  var sortSel = document.querySelector('select[name=sort]');
  if (q.get('sort')) sortSel.value = q.get('sort');
  if (q.get('view') === 'map') VIEW = 'map';

  function vals() {
    var v = {}; Array.prototype.forEach.call(F.elements, function (el) { if (el.name) v[el.name] = (el.value || '').trim(); });
    v.sort = sortSel.value; return v;
  }
  function placeName(kind, slug) { var p = PLACES.find(function (x) { return x.u.indexOf('/' + slug + '/') >= 0 && (!kind || x.k === kind); }); return p ? p.n : slug; }
  function pills(v) {
    var out = [];
    if (v.hood) out.push(['hood', placeName('Community', v.hood)]);
    if (v.mine) out.push(['mine', 'My listings']);
    if (v.ours) out.push(['ours', 'Our brokerage’s listings']);
    if (v.new) out.push(['new', 'New this week']);
    if (v.towns) out.push(['towns', v.towns.split(',').map(function (t) { return placeName('Town', t); }).join(', ')]);
    PILLS.innerHTML = out.map(function (p) { return '<button type="button" data-clear="' + p[0] + '">' + AS.esc(p[1]) + '</button>'; }).join('');
  }
  function run() {
    var v = vals();
    var p = new URLSearchParams();
    Object.keys(v).forEach(function (k) { if (v[k] && !(k === 'sort' && v[k] === 'new')) p.set(k, v[k]); });
    if (VIEW === 'map') p.set('view', 'map');
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
      if (v.type && x.t !== v.type) return false;
      if (lo && (x.p || 0) < lo) return false;
      if (hi && (x.p || 0) > hi) return false;
      if (beds && (x.b || 0) < beds) return false;
      if (baths && (x.ba || 0) < baths) return false;
      if (words.length) { var hay = norm([x.a, x.h, x.c, x.m].join(' ')); for (var i = 0; i < words.length; i++) if (hay.indexOf(words[i]) < 0) return false; }
      return true;
    });
    var s = v.sort;
    hits.sort(s === 'lo' ? function (a, b) { return (a.p || 0) - (b.p || 0); } :
              s === 'hi' ? function (a, b) { return (b.p || 0) - (a.p || 0); } :
              s === 'big' ? function (a, b) { return (b.s || 0) - (a.s || 0); } :
              function (a, b) { return (b.me || 0) - (a.me || 0) || a.d - b.d; });
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
    F.elements[k].value = ''; run();
  });
  document.querySelectorAll('[data-view]').forEach(function (b) {
    b.classList.toggle('on', b.dataset.view === VIEW);
    b.addEventListener('click', function () {
      VIEW = b.dataset.view;
      document.querySelectorAll('[data-view]').forEach(function (x) { x.classList.toggle('on', x === b); });
      run();
    });
  });
  Promise.all([AS.data('listings'), AS.data('places').catch(function () { return []; })])
    .then(function (r) { ALL = r[0]; PLACES = r[1]; run(); })
    .catch(function () { COUNT.textContent = "Listings couldn't load. Please refresh the page."; });
})();
