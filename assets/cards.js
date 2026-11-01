/* Shared by the pages: a listing card from a data/listings.json row (the same markup build.py card() writes: change
   both), the data files (fetched once), and the map (Leaflet 1.9.4 and OpenStreetMap tiles, loaded only when a map
   is asked for). Row keys (build.py compact()): m mls, p price, b beds, ba baths, s sqft, t type, c town, h community,
   a address, y/x lat/lng, ph photo, d days listed, o listing office, ts town slug, hs community slug, q area, r
   REALTOR.ca number, me the agent's own, ob the brokerage's, cu how far a banded photo is cut (build.py cut_bands). */
(function () {
  var ROOT = document.body.dataset.root;
  var TYPES = { house: 'House', condo: 'Condo', townhouse: 'Townhouse', mobile: 'Mobile home', acreage: 'Acreage', land: 'Lot / land', commercial: 'Commercial' };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function money(v) { return v == null ? '' : '$' + Math.round(v).toLocaleString('en-CA'); }
  function short(v) { return !v ? '' : v >= 1e6 ? '$' + (v / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M' : '$' + Math.round(v / 1000) + 'K'; }
  function specs(x) {
    var out = '';
    if (x.b != null && x.t !== 'land' && x.t !== 'commercial') out += '<span><i class="ic ic-bed"></i>' + x.b + ' bd</span>';
    if (x.ba) out += '<span><i class="ic ic-bath"></i>' + x.ba + ' ba</span>';
    if (x.s) out += '<span><i class="ic ic-size"></i>' + x.s.toLocaleString('en-CA') + ' sq ft</span>';
    return out;
  }
  function card(x) {
    var img = x.ph ? '<img src="' + esc(x.ph) + '" alt="' + esc(TYPES[x.t] + ' at ' + (x.a || x.h)) + '" loading="lazy" width="600" height="400"' + (x.cu ? ' style="--cut:' + x.cu + '%"' : '') + '>'
                   : '<span class="nophoto">Photos coming soon</span>';
    var tag = x.me ? '<span class="tag mine">My listing</span>' : (x.d <= 7 ? '<span class="tag">New</span>' : '');
    var rca = x.r ? '<a class="rca" href="https://www.realtor.ca/real-estate/' + esc(x.r) + '" target="_blank" rel="noopener" title="See it on REALTOR.ca">Powered by <b>REALTOR.ca</b></a>' : '';
    return '<article class="card"><a class="card-a" href="' + ROOT + 'listing/?mls=' + encodeURIComponent(x.m) + '">' +
      '<span class="card-ph">' + img + tag + '<span class="card-pr">' + money(x.p) + '</span></span>' +
      '<span class="card-bd"><span class="card-ad">' + esc(x.a || TYPES[x.t]) + '</span>' +
      '<span class="card-ar">' + esc(x.h) + (x.h !== x.c ? ' · ' + esc(x.c) : '') + '</span>' +
      '<span class="card-sp">' + specs(x) + '</span></span></a>' +
      '<p class="card-ct"><span>MLS® ' + esc(x.m) + ' · Courtesy of ' + esc(x.o) + '</span>' + rca + '</p></article>';
  }
  var got = {};
  function data(name) {
    return got[name] || (got[name] = fetch(ROOT + 'data/' + name + '.json').then(function (r) { if (!r.ok) throw r.status; return r.json(); }));
  }
  var LL = null;
  function leaflet() {
    if (LL) return LL;
    LL = new Promise(function (ok, no) {
      var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(l);
      var s = document.createElement('script'); s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      s.onload = function () { ok(window.L); }; s.onerror = no; document.head.appendChild(s);
    });
    return LL;
  }
  // a map of rows in `el`; many homes are dots (fast), a few are price pins
  function map(el, rows) {
    return leaflet().then(function (L) {
      rows = rows.filter(function (x) { return x.y && x.x; });
      if (el._map) { el._map.remove(); }
      var m = el._map = L.map(el, { scrollWheelZoom: false, preferCanvas: true });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(m);
      var accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#007f79';
      var pts = [];
      rows.forEach(function (x) {
        var mk = rows.length > 250
          ? L.circleMarker([x.y, x.x], { radius: 6, color: '#fff', weight: 1.5, fillColor: accent, fillOpacity: .9 })
          : L.marker([x.y, x.x], { icon: L.divIcon({ className: 'pinwrap', html: '<span class="pin">' + short(x.p) + '</span>', iconSize: null }) });
        mk.bindPopup(function () { return card(x); }, { minWidth: 250, maxWidth: 250 });
        mk.addTo(m); pts.push([x.y, x.x]);
      });
      if (pts.length) m.fitBounds(pts, { padding: [30, 30], maxZoom: 15 }); else m.setView([53.54, -113.49], 10);
      return m;
    });
  }
  // a monthly payment: price less the down payment, Canadian semi-annual compounding (listing page, Mortgage calculator)
  function calc(el, price, editable) {
    el.innerHTML = (editable ? '<label>Price<input id="c-price" type="number" inputmode="numeric" step="5000" min="0" value="' + Math.round(price) + '"></label>' : '') +
      '<label>Down payment<select id="c-down"><option value=".05">5%</option><option value=".1">10%</option><option value=".2" selected>20%</option></select></label>' +
      '<label>Rate<select id="c-rate"><option>3.99</option><option selected>4.49</option><option>4.99</option><option>5.49</option></select></label>' +
      '<label>Years<select id="c-years"><option>20</option><option selected>25</option><option>30</option></select></label><output id="c-out"></output>';
    function go() {
      var p = editable ? +el.querySelector('#c-price').value || 0 : price;
      var down = +el.querySelector('#c-down').value, rate = +el.querySelector('#c-rate').value / 100, n = +el.querySelector('#c-years').value * 12;
      var loan = p * (1 - down), r = Math.pow(1 + rate / 2, 1 / 6) - 1;
      var pay = r ? loan * r / (1 - Math.pow(1 + r, -n)) : loan / n;
      el.querySelector('#c-out').innerHTML = money(pay) + '<small>a month, before taxes and insurance' + (down < .2 ? '; mortgage insurance extra' : '') + '</small>';
    }
    el.addEventListener('change', go); el.addEventListener('input', go); go();
  }
  // ---- Google address suggestions (Places API, New): the agent team's key in body data-maps (GOOGLE_MAPS_KEY).
  // No key, no suggestions: every box still works as plain text. One session token a search, as Google bills.
  var G = null, TOKEN = null;
  function gload() {
    var key = document.body.dataset.maps;
    if (!key) return Promise.reject('no key');
    if (G) return G;
    G = new Promise(function (ok, no) {
      window.__asMaps = ok;
      var s = document.createElement('script');
      s.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(key) + '&loading=async&v=weekly&callback=__asMaps';
      s.onerror = no; document.head.appendChild(s);
    }).then(function () { return google.maps.importLibrary('places'); });
    return G;
  }
  function gsuggest(q) {
    return gload().then(function (lib) {
      TOKEN = TOKEN || new lib.AutocompleteSessionToken();
      var c = (document.body.dataset.center || '').split(',').map(Number);
      var req = { input: q, sessionToken: TOKEN, includedRegionCodes: ['ca'] };
      if (c.length === 2 && c[0]) req.locationBias = { center: { lat: c[0], lng: c[1] }, radius: 50000 };
      return lib.AutocompleteSuggestion.fetchAutocompleteSuggestions(req);
    }).then(function (r) {
      return (r.suggestions || []).map(function (s) { return s.placePrediction; }).filter(Boolean).slice(0, 6).map(function (p) {
        return { n: p.mainText ? p.mainText.toString() : p.text.toString(), s: p.secondaryText ? p.secondaryText.toString() : '', full: p.text.toString(), pred: p };
      });
    });
  }
  function gpick(item) {
    var place = item.pred.toPlace();
    return place.fetchFields({ fields: ['formattedAddress', 'location'] }).then(function () {
      TOKEN = null;
      return { address: place.formattedAddress || item.full, lat: place.location.lat(), lng: place.location.lng() };
    });
  }
  // the community a spot is in: the most common among the nearest listings
  function nearHood(lat, lng) {
    return data('listings').then(function (rows) {
      var near = rows.filter(function (x) { return x.y && x.hs; }).map(function (x) {
        return [Math.pow(x.y - lat, 2) + Math.pow((x.x - lng) * 0.6, 2), x];
      }).sort(function (a, b) { return a[0] - b[0]; }).slice(0, 7), tally = {};
      near.forEach(function (n) { tally[n[1].h] = (tally[n[1].h] || 0) + 1; });
      return Object.keys(tally).sort(function (a, b) { return tally[b] - tally[a]; })[0] || '';
    });
  }
  window.AS = { gsuggest: gsuggest, gpick: gpick, nearHood: nearHood, maps: !!document.body.dataset.maps, root: ROOT, TYPES: TYPES, esc: esc, money: money, short: short, card: card, data: data, map: map, calc: calc };
})();
