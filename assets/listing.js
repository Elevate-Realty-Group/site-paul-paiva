/* The listing page (/listing/?mls=...): draws data/l/<mls>.json (build.py shape()), sends CREA's analytics beacon
   (DDF® Rules 5.c), opens photos full size, works out a monthly payment and shows similar homes nearby. A listing that
   has left the feed has no file: "no longer for sale". The sidebar's tour request: in person or by video, ASAP or a
   day in the next two weeks, then name and email; site.js folds the choices (data-note) into the message. */
(function () {
  var AS = window.AS, B = document.body.dataset, ROOT = B.root, $ = function (id) { return document.getElementById(id); };
  var esc = AS.esc, money = AS.money, TYPES = AS.TYPES;
  var mls = (new URLSearchParams(location.search).get('mls') || '').trim();
  var file = mls.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  function gone() { $('lp-wait').hidden = true; $('lp-gone').hidden = false; document.title = 'No longer for sale'; }
  if (!file) return gone();

  function beacon(x) {
    if (!B.dest || !x.key) return;
    var id; try { id = localStorage.getItem('ddfUuid'); if (!id) { id = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)); localStorage.setItem('ddfUuid', id); } } catch (e) { id = 'anon'; }
    new Image().src = 'https://analytics.crea.ca/LogEvents.svc/LogEvents?ListingID=' + encodeURIComponent(x.key) +
      '&DestinationID=' + encodeURIComponent(B.dest) + '&EventType=view&UUID=' + encodeURIComponent(id + '-' + B.dest) +
      '&LanguageID=1&ReferralURL=' + encodeURIComponent(document.referrer || location.href);
  }
  function lightbox(list, i) {
    var d = document.createElement('div'); d.className = 'lb'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'Photos');
    d.innerHTML = '<img alt=""><button class="pv" aria-label="Previous">‹</button><button class="nx" aria-label="Next">›</button><button class="x" aria-label="Close">×</button><span class="n"></span>';
    var img = d.querySelector('img'), n = d.querySelector('.n');
    function show() { img.src = list[i]; n.textContent = (i + 1) + ' / ' + list.length; }
    function close() { d.remove(); document.removeEventListener('keydown', key); }
    function key(e) { if (e.key === 'Escape') close(); if (e.key === 'ArrowRight') { i = (i + 1) % list.length; show(); } if (e.key === 'ArrowLeft') { i = (i - 1 + list.length) % list.length; show(); } }
    d.querySelector('.x').onclick = close;
    d.querySelector('.nx').onclick = function () { i = (i + 1) % list.length; show(); };
    d.querySelector('.pv').onclick = function () { i = (i - 1 + list.length) % list.length; show(); };
    d.addEventListener('click', function (e) { if (e.target === d) close(); });
    document.addEventListener('keydown', key);
    document.body.appendChild(d); show();
  }
  tour();
  function tour() {
    var f = $('tour'), strip = $('tour-days');
    if (!f) return;
    var D = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var DL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    var ML = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    var h = '<label class="td asap"><input type="radio" name="tour_day" value="As soon as possible" data-note="Day" checked><i class="ic ic-clock"></i><b>ASAP</b></label>';
    for (var i = 1; i <= 14; i++) {
      var d = new Date(); d.setDate(d.getDate() + i);
      h += '<label class="td"><input type="radio" name="tour_day" data-note="Day" value="' + DL[d.getDay()] + ', ' + ML[d.getMonth()] + ' ' + d.getDate() + '"><small>' +
        D[d.getDay()] + '</small><b>' + d.getDate() + '</b><small>' + M[d.getMonth()] + '</small></label>';
    }
    strip.innerHTML = h;
    var nav = f.querySelectorAll('.td-nav');
    function arrows() { nav[0].hidden = strip.scrollLeft < 4; nav[1].hidden = strip.scrollLeft + strip.clientWidth > strip.scrollWidth - 4; }
    nav.forEach(function (b) { b.onclick = function () { strip.scrollBy({ left: +b.dataset.go * strip.clientWidth * .8, behavior: 'smooth' }); }; });
    strip.addEventListener('scroll', arrows, { passive: true }); window.addEventListener('resize', arrows); arrows();
    var step = f.querySelector('.tour-step'), more = f.querySelector('.tour-more'), ask = f.querySelector('.tour-q');
    function tourOn(on) { f.querySelectorAll('[name=tour_kind],[name=tour_day],[name=tour_time]').forEach(function (e) { e.disabled = !on; }); f.querySelector('.tour-time').hidden = !on; }
    function open(asking) {
      tourOn(!asking);
      var k = f.querySelector('[name=tour_kind]:checked').value, d = f.querySelector('[name=tour_day]:checked').value;
      $('tour-pick').textContent = asking ? '' : (k === 'In person' ? 'In-person tour' : 'Video chat tour') + ' · ' + (d === 'As soon as possible' ? 'as soon as possible' : d);
      f.querySelector('.tour-pick').hidden = asking;
      $('tour-h').textContent = asking ? 'Ask a question' : 'Schedule a tour';
      $('tour-send').textContent = asking ? 'Send' : 'Request tour';
      f.querySelector('[name=message]').placeholder = asking ? 'Your question about this home' : 'Anything I should know? (optional)';
      step.hidden = true; more.hidden = false; ask.hidden = true;
      f.querySelector('[name=first_name]').focus();
    }
    f.querySelector('.tour-go').onclick = function () { open(false); };
    f.querySelector('.tour-ask').onclick = function () { open(true); };
    f.querySelector('.tour-back').onclick = function () { tourOn(true); step.hidden = false; more.hidden = true; ask.hidden = false; $('tour-h').textContent = 'Schedule a tour'; arrows(); };
  }
  // each listing's file: in the website's own listings site (build.py details), or data/ for one built before
  var LB = document.body.dataset.listings || ROOT + 'data/';
  fetch(LB + 'l/' + file + '.json').then(function (r) { if (!r.ok) throw r.status; return r.json(); }).then(function (x) {
    var title = x.addr || (TYPES[x.type] + ' in ' + x.hood);
    var town = ROOT + 'communities/' + x.town_slug + '/', hood = x.hood_slug ? town + x.hood_slug + '/' : '';
    document.title = title + ', ' + x.city + ' | ' + money(x.price);
    $('lp-crumbs').innerHTML = '<a href="' + ROOT + '">Home</a> <span>›</span> <a href="' + ROOT + 'communities/">Communities</a> <span>›</span> <a href="' + town + '">' + esc(x.city) + '</a>' +
      (hood ? ' <span>›</span> <a href="' + hood + '">' + esc(x.hood) + '</a>' : '');
    $('lp-addr').textContent = title;
    $('lp-area').innerHTML = '<i class="ic ic-pin"></i> ' + (hood ? '<a href="' + hood + '">' + esc(x.hood) + '</a>, ' : '') + esc(x.city);
    $('lp-price').textContent = money(x.price);
    var chips = [TYPES[x.type]];
    if (x.beds != null && x.type !== 'land') chips.push('<i class="ic ic-bed"></i>' + x.beds + ' bedrooms');
    if (x.baths) chips.push('<i class="ic ic-bath"></i>' + x.baths + ' bathrooms');
    if (x.sqft) chips.push('<i class="ic ic-size"></i>' + x.sqft.toLocaleString('en-CA') + ' sq ft');
    if (x.lot) chips.push(esc(x.lot));
    if (x.year) chips.push('Built ' + x.year);
    $('lp-specs').innerHTML = chips.map(function (c) { return '<span>' + c + '</span>'; }).join('');
    $('lp-court').textContent = 'MLS® ' + x.mls + ' · Courtesy of ' + x.office;
    $('lp-courtesy').textContent = x.courtesy;
    document.querySelectorAll('.lp-board').forEach(function (e) { e.textContent = x.board; });
    $('lp-rca').href = x.rca;
    $('lp-remarks').textContent = x.remarks;
    $('lp-facts').innerHTML = x.facts.map(function (f) { return '<div><dt>' + esc(f[0]) + '</dt><dd>' + esc(f[1]) + '</dd></div>'; }).join('');
    if (x.features.length) $('lp-features').innerHTML = '<h2>Features</h2><dl class="facts">' +
      x.features.map(function (f) { return '<div><dt>' + esc(f[0]) + '</dt><dd>' + esc(f[1]) + '</dd></div>'; }).join('') + '</dl>';
    if (x.rooms.length) $('lp-rooms').innerHTML = '<h2>Rooms</h2><div style="overflow-x:auto"><table><thead><tr><th>Room</th><th>Level</th><th>Size</th></tr></thead><tbody>' +
      x.rooms.map(function (r) { return '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td><td>' + esc(r[2]) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    if (x.price) AS.calc($('lp-calc'), x.price, false, x.tax_m);
    var tn = x.tax_note;
    if (tn) { $('lp-taxnote').innerHTML = 'The ' + tn.year + ' City assessment comes from ' + esc(tn.licence) + '. The property tax is an estimate at the City\'s ' +
      tn.year + ' residential rate ($' + tn.per_k + ' per $1,000 of assessment); separately titled parking or storage is assessed and taxed on its own. Check it with the <a href="' +
      esc(tn.estimator) + '" target="_blank" rel="noopener">City of ' + esc(tn.city) + ' tax estimator</a>.'; $('lp-taxnote').hidden = false; }
    if (x.lat && x.lng) $('lp-map').innerHTML = '<h2>Location</h2><iframe class="mapf" loading="lazy" title="Map" src="https://www.openstreetmap.org/export/embed.html?bbox=' +
      (x.lng - .012) + ',' + (x.lat - .007) + ',' + (x.lng + .012) + ',' + (x.lat + .007) + '&layer=mapnik&marker=' + x.lat + ',' + x.lng + '"></iframe>';
    var g = $('lp-gallery'), ph = x.photos || [];
    g.className = 'gallery n' + Math.min(ph.length, 5);
    g.innerHTML = ph.slice(0, 5).map(function (u, i) {
      return '<img src="' + esc(u) + '" alt="Photo ' + (i + 1) + ' of ' + esc(title) + '"' + (i ? ' loading="lazy"' : '') + ' data-i="' + i + '">';
    }).join('') + (ph.length > 1 ? '<button class="btn sm all" type="button" data-i="0">All ' + ph.length + ' photos</button>' : '') || '<p class="nophoto">Photos coming soon</p>';
    g.addEventListener('click', function (e) { var i = e.target.getAttribute('data-i'); if (i != null && ph.length) lightbox(ph, +i); });
    $('lp-mls').value = x.mls; $('lp-addr-in').value = title + ', ' + x.city;
    $('lp-wait').hidden = true; $('lp-body').hidden = false;
    beacon(x);
    // similar homes: the same community (else town) and type, closest in price
    AS.data('listings').then(function (rows) {
      var same = rows.filter(function (y) { return y.m !== x.mls && y.t === x.type && (x.hood_slug ? y.hs === x.hood_slug : y.ts === x.town_slug); });
      if (same.length < 3) same = rows.filter(function (y) { return y.m !== x.mls && y.t === x.type && y.ts === x.town_slug && (!x.area || y.q === x.area); });
      same.sort(function (a, b) { return Math.abs((a.p || 0) - x.price) - Math.abs((b.p || 0) - x.price); });
      if (same.length) $('lp-similar').innerHTML = '<div class="sec-h" style="margin-top:48px"><h2>Similar homes nearby</h2>' +
        (hood ? '<a class="more" href="' + hood + '">More in ' + esc(x.hood) + ' →</a>' : '') + '</div><div class="cards">' + same.slice(0, 3).map(AS.card).join('') + '</div>';
    });
  }).catch(gone);
})();
