/* 이음방 지도 화면 동작
 * - 상단 탭 전환 / 줌·드래그 / 방 찾기 필터·정렬·검색 / 동네 지도 카테고리·도보 반경
 * 백엔드 연결 전 데모 동작입니다. 데이터는 HTML 의 data-* 속성에서 읽습니다.
 */
(function () {
  var body = document.body;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- 창 크기에 맞추기 ---------- */
  // 1313x964 디자인을 비율 유지로 맞추되, 남는 가로/세로 공간은 지도 영역이 채움
  var pageScale = 1;
  function fitPage() {
    var pg = $('.page'), hh = window.ieumHeaderH ? window.ieumHeaderH() : 61;
    // 위쪽 61px(예전 메뉴 자리)은 공통 상단 메뉴가 덮어요. 나머지가 창 아래쪽까지 꽉 차게 맞춤
    pageScale = Math.min((innerHeight - hh) / (964 - 61), innerWidth / 1313, 1.5);
    pg.style.width = innerWidth / pageScale + 'px';
    pg.style.height = (innerHeight - hh) / pageScale + 61 + 'px';
    pg.style.top = (hh - 61 * pageScale) + 'px';
    pg.style.transform = 'scale(' + pageScale + ')';
  }
  addEventListener('resize', fitPage);
  fitPage();

  /* ---------- 토스트 ---------- */
  var toastEl = $('#toast'), toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 1800);
  }

  /* ---------- 방 제목 클릭 → 매물 상세(팀원 페이지) ---------- */
  $$('.room').forEach(function (r) {
    r.style.userSelect = 'none';
    r.addEventListener('dblclick', function () { location.href = '../files/detail.html?id=' + (r.dataset.id || 1); });
  });
  $$('.room h3').forEach(function (h) {
    h.style.cursor = 'pointer'; h.title = '자세히 보기';
    h.addEventListener('click', function (e) { e.stopPropagation(); location.href = '../files/detail.html?id=' + (h.closest('.room').dataset.id || 1); });
  });

  /* ---------- 뷰 전환 ---------- */
  var q = new URLSearchParams(location.search).get('view');
  if (q === 'find' || q === 'map') body.setAttribute('data-view', q);

  /* ---------- 지도 줌 / 드래그 ---------- */
  function setupMap(mapEl, ox, oy) {
    var inner = $('.map-inner', mapEl);
    var s = 1, tx = 0, ty = 0, moved = false;
    inner.style.transformOrigin = ox + 'px ' + oy + 'px';
    function apply(smooth) {
      inner.style.transition = smooth ? 'transform .2s ease' : 'none';
      inner.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + s + ')';
    }
    function zoom(f) { s = Math.min(2.2, Math.max(.6, s * f)); apply(true); }
    var zb = $$('.zoom button', mapEl);
    zb[0].addEventListener('click', function () { zoom(1.25); });
    zb[1].addEventListener('click', function () { zoom(0.8); });
    mapEl.addEventListener('wheel', function (e) { e.preventDefault(); zoom(e.deltaY < 0 ? 1.1 : 0.9); }, { passive: false });

    var sx, sy, stx, sty, down = false;
    mapEl.addEventListener('pointerdown', function (e) {
      if (e.target.closest('button, .pin, .price, .popup, .zoom')) return;
      down = true; moved = false; sx = e.clientX; sy = e.clientY; stx = tx; sty = ty;
      mapEl.classList.add('grabbing');
    });
    window.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
      tx = stx + dx / pageScale; ty = sty + dy / pageScale; apply(false);
    });
    window.addEventListener('pointerup', function () { down = false; mapEl.classList.remove('grabbing'); });
    return { wasDrag: function () { return moved; } };
  }
  var findMapCtl = setupMap($('.map-find'), 979, 515);
  var nbMapCtl = setupMap($('.map-neighbor'), 867, 514);

  /* =====================================================
     방 찾기
     ===================================================== */
  var rooms = $$('.room');
  var roomList = $('.rooms');
  var prices = $$('.price[data-room]');
  var route = $('#find-route');
  var popup = $('#find-popup');
  var state = { rent: true, walk: true, share: true, dep: null, type: null, fac: null, sort: 0 };
  var touched = false;
  var selected = rooms[0];
  var EXTRA = 20;   // 데모용: 샘플 방 4개 외 나머지 개수(24 - 4). 백엔드 연결 후 실제 총 개수로 교체

  function pinOf(room) { return $('.price[data-room="' + room.dataset.id + '"]'); }

  function select(room) {
    selected = room;
    rooms.forEach(function (r) { r.classList.toggle('is-selected', r === room); });
    prices.forEach(function (p) {
      var r = rooms.filter(function (x) { return x.dataset.id === p.dataset.room; })[0];
      var on = r === room;
      p.classList.toggle('big', on);
      p.textContent = on ? r.dataset.rent + ' / ' + r.dataset.dep : r.dataset.rent;
    });
    var pin = pinOf(room);
    if (pin && !pin.classList.contains('is-off')) {
      var ex = parseFloat(pin.style.left), ey = parseFloat(pin.style.top) - 22;
      var dy = ey - 302;
      route.setAttribute('d', 'M891 302 C 897 ' + (302 + dy * .45) + ', ' + ex + ' ' + (302 + dy * .7) + ', ' + ex + ' ' + ey);
      route.parentNode.style.display = '';
    }
    $('#pop-title').textContent = $('h3', room).textContent;
    $('#pop-sub').textContent = room.dataset.popup;
    popup.style.display = '';
  }

  /* 필터 적용 */
  function matches(r, qtext) {
    var d = r.dataset, rent = +d.rent, dep = +d.dep, walk = +d.walk, share = +d.share;
    if (touched) {
      if (state.rent && (rent < 40 || rent > 60)) return false;
      if (state.walk && walk > 15) return false;
      if (!state.share && share > 0) return false;
      if (state.dep !== null && dep > state.dep) return false;
      if (state.type && d.type !== state.type) return false;
      if (state.fac && d.fac.indexOf(state.fac) < 0) return false;
    }
    if (qtext && r.textContent.replace(/\s+/g, ' ').toLowerCase().indexOf(qtext) < 0) return false;
    return true;
  }
  var SORTS = [
    ['최신순', function (a, b) { return a.dataset.order - b.dataset.order; }],
    ['낮은 가격순', function (a, b) { return a.dataset.rent - b.dataset.rent; }],
    ['정문 가까운순', function (a, b) { return a.dataset.walk - b.dataset.walk; }]
  ];
  function apply() {
    var qtext = $('#q').value.trim().toLowerCase();
    var visible = [];
    rooms.forEach(function (r) {
      var ok = matches(r, qtext);
      r.classList.toggle('is-off', !ok);
      var pin = pinOf(r);
      if (pin) pin.classList.toggle('is-off', !ok);
      if (ok) visible.push(r);
    });
    rooms.slice().sort(SORTS[state.sort][1]).forEach(function (r) { roomList.appendChild(r); });
    // 필터/검색 전에는 디자인의 "24"를 유지, 이후에는 실제 조건에 맞는 개수 표시
    $('#count').textContent = (touched || qtext) ? visible.length : visible.length + EXTRA;
    $('#empty').hidden = visible.length > 0;
    $('#empty').innerHTML = qtext ? '“' + $('#q').value.trim().replace(/[<>&]/g, '') + '” 검색 결과가 없어요.<br>다른 동네나 시설로 검색해 보세요.' : '조건에 맞는 방이 없어요.<br>필터를 바꿔 보세요.';
    if (!visible.length) {
      route.parentNode.style.display = 'none';
      popup.style.display = 'none';
    } else if (visible.indexOf(selected) < 0) {
      select(visible[0]);
    } else {
      select(selected);
    }
    return visible.length;
  }

  /* 칩: 토글형 / 드롭다운형 */
  var OPTIONS = {
    dep: [['전체', null], ['500 이하', 500], ['1000 이하', 1000]],
    type: [['전체', null], ['원룸', '원룸'], ['오피스텔', '오피스텔'], ['복층', '복층']],
    fac: [['전체', null], ['세탁기', '세탁기'], ['에어컨', '에어컨'], ['베란다', '베란다'], ['풀옵션', '풀옵션']]
  };
  var chipsEl = $('#chips'), menu = null;
  function closeMenu() { if (menu) { menu.remove(); menu = null; } }
  $$('.chip', chipsEl).forEach(function (chip) {
    chip.addEventListener('click', function (e) {
      e.stopPropagation();
      var f = chip.dataset.f;
      if (!OPTIONS[f]) {                       // 토글형
        state[f] = !state[f];
        chip.classList.toggle('on', state[f]);
        touched = true; apply(); closeMenu();
        return;
      }
      var same = menu && menu.dataset.f === f; // 드롭다운형
      closeMenu();
      if (same) return;
      menu = document.createElement('ul');
      menu.className = 'menu'; menu.dataset.f = f;
      OPTIONS[f].forEach(function (o) {
        var li = document.createElement('li');
        li.textContent = o[0];
        if (state[f] === o[1]) li.className = 'cur';
        li.addEventListener('click', function (ev) {
          ev.stopPropagation();
          state[f] = o[1];
          chip.classList.toggle('on', o[1] !== null);
          chip.innerHTML = o[1] === null ? chip.dataset.base + ' <small>▾</small>' : o[0] + ' <small>▾</small>';
          touched = true; apply(); closeMenu();
        });
        menu.appendChild(li);
      });
      menu.style.left = chip.offsetLeft + 'px';
      menu.style.top = (chip.offsetTop + chip.offsetHeight + 4) + 'px';
      chipsEl.appendChild(menu);
    });
  });
  document.addEventListener('click', closeMenu);

  /* 정렬 */
  $('#sort-btn').addEventListener('click', function () {
    state.sort = (state.sort + 1) % SORTS.length;
    this.innerHTML = SORTS[state.sort][0] + ' <small>▾</small>';
    apply();
  });

  /* 검색 */
  $('#q').addEventListener('input', function () { apply(); });
  // 홈 검색창에서 넘어온 검색어(?q=대현동)를 검색창에 채우고 바로 검색
  var q0 = new URLSearchParams(location.search).get('q');
  if (q0) { $('#q').value = q0; apply(); }
  $('#research').addEventListener('click', function () {
    var n = apply();
    toast('이 지역에서 다시 검색했어요 · ' + n + '개');   // TODO: 지도 영역 기준 API 조회
  });

  /* 목록 ↔ 지도 핀 연동 */
  rooms.forEach(function (r) { r.addEventListener('click', function () { select(r); }); });
  prices.forEach(function (p) {
    p.addEventListener('click', function () {
      var r = rooms.filter(function (x) { return x.dataset.id === p.dataset.room; })[0];
      if (!r) return;
      select(r);
      r.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  });
  $$('.price:not([data-room])').forEach(function (p) {
    p.addEventListener('click', function () { toast('이 방은 아직 소개 정보가 없어요'); });
  });

  /* =====================================================
     동네 지도
     ===================================================== */
  var CENTER = { x: 819, y: 485 }, PX_PER_MIN = 23.4;
  var pins = $$('.pin');
  var catLis = $$('.cats li');
  var popText = $('#pop-text');
  var defaultPop = popText.textContent;
  var radius = 5;
  var CATNAME = {};
  catLis.forEach(function (li) { CATNAME[li.dataset.cat] = $('span', li).textContent; });

  function pinCenter(p) { return { x: parseFloat(p.style.left) + 15, y: parseFloat(p.style.top) + 15 }; }
  function distMin(p) {
    var c = pinCenter(p);
    return Math.hypot(c.x - CENTER.x, c.y - CENTER.y) / PX_PER_MIN;
  }

  catLis.forEach(function (li) {
    li.addEventListener('click', function () {
      var on = li.classList.toggle('on');
      var cat = li.dataset.cat;
      $$('[data-cat="' + cat + '"]').forEach(function (el) {
        if (el !== li) el.classList.toggle('is-off', !on);
      });
      if (cat === '안') {
        $('em', li).textContent = on ? '표시 중' : '숨김';
        if (!on) popText.textContent = '안심 귀갓길 표시를 껐어요'; else popText.textContent = defaultPop;
      }
    });
  });

  function applyRadius(min) {
    radius = min;
    $$('.seg button').forEach(function (b, i) { b.classList.toggle('on', (i === 0) === (min === 5)); });
    $('.ring.r10').classList.toggle('strong', min === 10);
    var inside = 0;
    pins.forEach(function (p) {
      var out = distMin(p) > min;
      p.classList.toggle('dim', out);
      if (!out && !p.classList.contains('is-off') && p.dataset.cat !== '안') inside++;
    });
    return inside;
  }
  $$('.seg button').forEach(function (b, i) {
    b.addEventListener('click', function () {
      var n = applyRadius(i === 0 ? 5 : 10);
      toast('도보 ' + radius + '분 이내 시설 ' + n + '곳');
    });
  });
  applyRadius(5);
  pins.forEach(function (p) { p.classList.remove('dim'); });   // 피그마 기본 상태: 모든 핀 선명하게 (도보 5/10분 버튼을 누르면 반경 밖 핀이 흐려짐)

  pins.forEach(function (p) {
    p.addEventListener('click', function () {
      pins.forEach(function (x) { x.classList.remove('active'); });
      p.classList.add('active');
      var m = Math.max(1, Math.round(distMin(p)));
      popText.textContent = CATNAME[p.dataset.cat] + ' · 내 방에서 도보 ' + m + '분';
      $('.popup-wide .dots').style.display = 'none';
    });
  });
  $('.map-neighbor').addEventListener('click', function (e) {
    if (e.target.closest('.pin, .popup, .zoom') || nbMapCtl.wasDrag()) return;
    pins.forEach(function (x) { x.classList.remove('active'); });
    popText.textContent = defaultPop;
    $('.popup-wide .dots').style.display = '';
  });

  /* 가까운 곳 목록 클릭 */
  $$('.near dl').forEach(function (dl) {
    dl.style.cursor = 'pointer';
    dl.addEventListener('click', function () { toast($('dt', dl).textContent + ' · ' + $('dd', dl).textContent); });
  });

  /* 초기 상태 */
  apply();
})();
