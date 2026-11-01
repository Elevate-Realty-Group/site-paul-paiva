/* What's my home worth? An instant estimate from the homes like it for sale now (data/listings.json), then the form
   for an exact valuation (the estimate goes with it). Nothing is sent until they send the form.

   The math (to settle with Paul, October 29):
     comparables  the same type in the same community; under 5, the same type in its area of the city; under 5, its town
                  (homes within 35% of the size given, when there are 5 or more of them)
     estimate     the comparables' median price per square foot x the size given (no size: the median price of those
                  with about as many bedrooms), x LIST_TO_SALE, because asking prices run above selling prices
     range        the estimate +/- RANGE, rounded to $5,000 */
(function () {
  var AS = window.AS, $ = function (id) { return document.getElementById(id); };
  var LIST_TO_SALE = 0.97, RANGE = 0.06, MIN = 5;
  var F = $('hv'), OUT = $('hv-out');
  var hoods = JSON.parse(($('hv-list') || {}).textContent || '[]');
  $('hv-hoods').innerHTML = hoods.map(function (h) { return '<option value="' + AS.esc(h) + '">'; }).join('');
  var norm = function (s) { return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); };
  var median = function (a) { a = a.slice().sort(function (x, y) { return x - y; }); return a.length ? a[Math.floor(a.length / 2)] : 0; };
  var r5 = function (v) { return Math.round(v / 5000) * 5000; };

  function estimate(v, rows) {
    var hs = norm(v.community), sq = +v.sqft || 0, beds = +v.beds || 0;
    var inHood = rows.filter(function (x) { return x.hs === hs || norm(x.h) === hs; });
    var where = inHood[0] ? { area: inHood[0].q, town: inHood[0].ts, hood: inHood[0].h } : null;
    var pools = [[inHood, v.community]];
    if (where && where.area) pools.push([rows.filter(function (x) { return x.q === where.area && x.ts === where.town; }), 'the area around ' + v.community]);
    if (where) pools.push([rows.filter(function (x) { return x.ts === where.town; }), inHood[0].c]);
    var comps = [], place = '';
    for (var i = 0; i < pools.length; i++) {
      var same = pools[i][0].filter(function (x) { return x.t === v.type && x.p; });
      if (sq) { var near = same.filter(function (x) { return x.s && Math.abs(x.s - sq) / sq <= .35; }); if (near.length >= MIN) same = near; }
      if (same.length >= MIN) { comps = same; place = pools[i][1]; break; }
    }
    if (!comps.length) return null;
    var est, basis;
    var sized = comps.filter(function (x) { return x.s; });
    if (sq && sized.length >= MIN) {
      var ppsf = median(sized.map(function (x) { return x.p / x.s; }));
      est = ppsf * sq * LIST_TO_SALE;
      basis = sized.length + ' homes like yours for sale in ' + place + ' right now, at a median of ' + AS.money(ppsf) + ' a square foot';
    } else {
      var bd = comps.filter(function (x) { return x.b != null && Math.abs(x.b - beds) <= 1; });
      if (bd.length < MIN) bd = comps;
      est = median(bd.map(function (x) { return x.p; })) * LIST_TO_SALE;
      basis = bd.length + ' homes like yours for sale in ' + place + ' right now';
    }
    comps.sort(function (a, b) { return Math.abs((a.s || 0) - sq) - Math.abs((b.s || 0) - sq) || Math.abs((a.b || 0) - beds) - Math.abs((b.b || 0) - beds); });
    return { lo: r5(est * (1 - RANGE)), mid: r5(est), hi: r5(est * (1 + RANGE)), basis: basis, comps: comps.slice(0, 3) };
  }

  var Q = new URLSearchParams(location.search), given = Q.get('address');
  if (given) F.elements.address.value = given;
  var setHood = function (lat, lng) {
    AS.nearHood(lat, lng).then(function (h) { if (h && !F.elements.community.value) { F.elements.community.value = h; F.elements.community.classList.add('auto'); } });
  };
  if (Q.get('lat') && Q.get('lng')) setHood(+Q.get('lat'), +Q.get('lng'));
  // Google's address suggestions under the address box (when the site has a key)
  if (AS.maps) {
    var box = F.elements.address, wrap = box.parentNode, gl = document.createElement('div'), gitems = [], gt;
    gl.className = 'omni-list'; wrap.style.position = 'relative'; wrap.appendChild(gl);
    box.setAttribute('autocomplete', 'off');
    box.addEventListener('input', function () {
      clearTimeout(gt);
      gt = setTimeout(function () {
        var q = box.value.trim();
        if (q.length < 4) { gl.classList.remove('on'); return; }
        AS.gsuggest(q).then(function (xs) {
          gitems = xs;
          gl.innerHTML = xs.map(function (x, i) { return '<a href="#" data-g="' + i + '"><span class="k">Address</span><b>' + AS.esc(x.n) + '</b><small>' + AS.esc(x.s) + '</small></a>'; }).join('');
          gl.classList.toggle('on', xs.length > 0);
        }).catch(function () {});
      }, 220);
    });
    gl.addEventListener('click', function (e) {
      var a = e.target.closest('[data-g]'); if (!a) return; e.preventDefault();
      var x = gitems[+a.dataset.g]; gl.classList.remove('on');
      box.value = x.full;
      AS.gpick(x).then(function (p) { box.value = p.address; F.elements.community.value = ''; setHood(p.lat, p.lng); });
    });
    document.addEventListener('click', function (e) { if (!wrap.contains(e.target)) gl.classList.remove('on'); });
  }

  F.addEventListener('submit', function (e) {
    e.preventDefault();
    var v = {}; new FormData(F).forEach(function (val, k) { v[k] = String(val).trim(); });
    OUT.hidden = false; OUT.innerHTML = '<p class="muted">Working it out…</p>';
    AS.data('listings').then(function (rows) {
      var r = estimate(v, rows);
      var details = v.address + ' (' + v.community + '): ' + v.type + ', ' + v.beds + ' bed, ' + v.baths + ' bath' + (v.sqft ? ', ' + v.sqft + ' sq ft' : '');
      $('hv-prop').value = v.address + ', ' + v.community;
      if (!r) {
        OUT.innerHTML = '<div class="hv-res"><h2>Let me value this one by hand</h2><p>There aren\'t enough homes like yours for sale near ' + AS.esc(v.community) +
          ' right now for an instant estimate. Send the form below and I\'ll do a full valuation for free.</p><a class="btn" href="#hv-exact">Get my exact value</a></div>';
        $('hv-msg').value = details + '. No instant estimate (too few comparables).';
        return;
      }
      $('hv-msg').value = details + '. Instant estimate ' + AS.money(r.lo) + '–' + AS.money(r.hi) + ' (' + r.basis + ').';
      OUT.innerHTML = '<div class="hv-res"><p class="kicker">Your instant estimate</p><p class="hv-range">' + AS.short(r.lo) + ' – ' + AS.short(r.hi) + '</p>' +
        '<p>Most likely about <strong>' + AS.money(r.mid) + '</strong>, from ' + AS.esc(r.basis) + '. Asking prices usually run a little above selling prices, so this is adjusted down 3%.</p>' +
        '<p class="small fine">An estimate from listings, not an appraisal. Your home\'s condition, upgrades and lot can move it a lot either way.</p>' +
        '<a class="btn" href="#hv-exact">Get my exact value, free</a></div>' +
        '<h3>Homes like yours for sale now</h3><div class="cards">' + r.comps.map(AS.card).join('') + '</div>';
      OUT.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }).catch(function () { OUT.innerHTML = '<p>The estimate couldn\'t load. Please refresh, or use the form below.</p>'; });
  });
})();
