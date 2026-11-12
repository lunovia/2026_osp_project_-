/* 이음방: 카카오 지도 연결
 * - kakao-config.js 에 JavaScript 키가 있을 때만 동작합니다. (없으면 기본 그림 지도 유지)
 * - 방 목록/필터/선택(map.js)이 바뀌면 DOM 상태를 읽어 카카오 지도의 마커·경로·반경을 다시 그립니다.
 * - 좌표는 샘플입니다. 실제 서비스에서는 각 방의 주소를 좌표로 바꾼 값(위도/경도)을 사용하세요.
 */
(function () {
  'use strict';
  var KEY = window.KAKAO_MAP_KEY;
  if (!KEY) {
    console.info('[이음방] kakao-config.js 에 카카오 JavaScript 키를 넣으면 카카오 지도가 표시됩니다. (지금은 기본 지도)');
    return;
  }

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- 샘플 좌표 ---------- */
  var GATE = { lat: 37.5596, lng: 126.9468 };   // 이화여대 정문 부근 (필요하면 수정)
  var M_PER_PX = 3.4;                           // 디자인의 1px ≈ 3.4m 로 환산 (도보 1분 ≈ 80m)
  var REF_FIND = { x: 891, y: 302 };            // 방 찾기 화면에서 정문 위치(px)
  var REF_NEAR = { x: 819, y: 485 };            // 동네 지도 화면에서 '내가 보는 방' 위치(px)
  var ROOM1_PX = { x: 920, y: 485 };            // 방 찾기 화면의 첫 번째 방(px)

  function offset(ll, dxMeters, dyMetersSouth) {
    return {
      lat: ll.lat - dyMetersSouth / 111320,
      lng: ll.lng + dxMeters / (111320 * Math.cos(ll.lat * Math.PI / 180))
    };
  }
  function pxToLL(ref, refLL, x, y) {
    return offset(refLL, (x - ref.x) * M_PER_PX, (y - ref.y) * M_PER_PX);
  }
  var ROOM1 = pxToLL(REF_FIND, GATE, ROOM1_PX.x, ROOM1_PX.y);
  var K = function (ll) { return new kakao.maps.LatLng(ll.lat, ll.lng); };
  var num = function (el, prop) { return parseFloat(el.style[prop]) || 0; };

  /* ---------- SDK 로드 ---------- */
  var s = document.createElement('script');
  s.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=' + encodeURIComponent(KEY) + '&autoload=false';
  s.onload = function () {
    try { kakao.maps.load(init); } catch (e) { fail(e); }
  };
  s.onerror = function () { fail(new Error('카카오 지도 SDK 를 불러오지 못했어요. (키/네트워크 확인)')); };
  document.head.appendChild(s);

  function fail(e) {
    console.error('[이음방] 카카오 지도를 사용할 수 없어 기본 지도를 표시합니다.', e);
    document.body.classList.remove('kakao-on');
  }

  /* ---------- 초기화 ---------- */
  function init() {
    try {
      var maps = { find: make('.map-find'), near: make('.map-neighbor') };
      document.body.classList.add('kakao-on');

      function make(sel) {
        var box = $(sel);
        var el = document.createElement('div');
        el.className = 'kakao-canvas';
        box.insertBefore(el, box.firstChild);
        var map = new kakao.maps.Map(el, { center: K(GATE), level: 4 });
        var m = { box: box, el: el, map: map, items: [] };
        var zb = $$('.zoom button', box);
        zb[0].addEventListener('click', function () { map.setLevel(map.getLevel() - 1, { animate: true }); });
        zb[1].addEventListener('click', function () { map.setLevel(map.getLevel() + 1, { animate: true }); });
        return m;
      }
      function clear(m) { m.items.forEach(function (o) { o.setMap(null); }); m.items = []; }
      function overlay(m, ll, node, z) {
        var wrap = document.createElement('div');
        wrap.className = 'kk-wrap';
        wrap.appendChild(node);
        var o = new kakao.maps.CustomOverlay({ position: K(ll), content: wrap, xAnchor: 0, yAnchor: 0, zIndex: z || 1 });
        o.setMap(m.map);
        m.items.push(o);
        return o;
      }
      function line(m, a, b, dashed) {
        var p = new kakao.maps.Polyline({
          path: [K(a), K(b)], strokeWeight: 4, strokeColor: '#1f4a3b', strokeOpacity: 0.9,
          strokeStyle: dashed ? 'shortdot' : 'solid'
        });
        p.setMap(m.map);
        m.items.push(p);
      }
      function chip(cls, text) {
        var n = document.createElement('span');
        n.className = cls;
        n.textContent = text || '';
        return n;
      }
      function gateNodes(m) {
        overlay(m, GATE, chip('kk-gate'), 2);
        overlay(m, offset(GATE, 14, 4), chip('kk-label', '정문'), 2);
      }

      /* ----- 방 찾기 ----- */
      function renderFind() {
        var m = maps.find;
        clear(m);
        overlay(m, pxToLL(REF_FIND, GATE, 786, 201), chip('kk-school', '이화여자대학교'), 1);
        gateNodes(m);

        var sel = $('.room.is-selected');
        var selPin = sel && $('.map-find .price[data-room="' + sel.dataset.id + '"]');
        if (selPin && !selPin.classList.contains('is-off')) {
          line(m, GATE, pxToLL(REF_FIND, GATE, num(selPin, 'left'), num(selPin, 'top')), true);
        }
        $$('.map-find .price').forEach(function (el) {
          if (el.classList.contains('is-off')) return;
          var n = chip(el.className, el.textContent);
          n.addEventListener('click', function () { el.click(); });
          overlay(m, pxToLL(REF_FIND, GATE, num(el, 'left'), num(el, 'top')), n, el.classList.contains('big') ? 5 : 3);
        });
      }

      /* ----- 동네 지도 ----- */
      function renderNear() {
        var m = maps.near;
        clear(m);
        var strong = $('.map-neighbor .ring.r10') && $('.map-neighbor .ring.r10').classList.contains('strong');
        [[800, strong ? 2 : 1, 'dash', 0.0], [400, 1, 'solid', 0.18]].forEach(function (c) {
          var circle = new kakao.maps.Circle({
            center: K(ROOM1), radius: c[0], strokeWeight: c[1], strokeColor: '#5f6f67',
            strokeOpacity: 0.8, strokeStyle: c[2], fillColor: '#5f7a6c', fillOpacity: c[3]
          });
          circle.setMap(m.map);
          m.items.push(circle);
        });

        var gateOn = !$('.map-neighbor svg[data-cat="안"]').classList.contains('is-off');
        if (gateOn) { gateNodes(m); line(m, GATE, ROOM1, true); }

        $$('.map-neighbor .pin[data-cat]').forEach(function (el) {
          if (el.classList.contains('is-off')) return;
          var n = chip(el.className, el.textContent);
          n.style.background = el.style.background;
          n.addEventListener('click', function () { el.click(); });
          overlay(m, pxToLL(REF_NEAR, ROOM1, num(el, 'left') + 15, num(el, 'top') + 15), n, 3);
        });

        var me = document.createElement('div');
        me.className = 'kk-me';
        me.innerHTML = '<svg width="34" height="44" viewBox="0 0 34 44"><path d="M17 2C9 2 3 8 3 16c0 10 14 25 14 25s14-15 14-25C31 8 25 2 17 2z" fill="#1a2f27"/><circle cx="17" cy="16" r="5.5" fill="#fff"/></svg><b>내가 보는 방</b>';
        overlay(m, ROOM1, me, 6);
      }

      function fit() {
        var vFind = document.body.getAttribute('data-view') !== 'map';
        var m = vFind ? maps.find : maps.near;
        m.map.relayout();
        var b = new kakao.maps.LatLngBounds();
        if (vFind) {
          [GATE, ROOM1].forEach(function (p) { b.extend(K(p)); });
          $$('.map-find .price').forEach(function (el) {
            b.extend(K(pxToLL(REF_FIND, GATE, num(el, 'left'), num(el, 'top'))));
          });
        } else {
          b.extend(K(offset(ROOM1, 850, 850)));
          b.extend(K(offset(ROOM1, -850, -850)));
        }
        m.map.setBounds(b);
      }

      var queued = false;
      function schedule() {
        if (queued) return;
        queued = true;
        requestAnimationFrame(function () { queued = false; renderFind(); renderNear(); });
      }
      var cfg = { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'style'] };
      [$('.map-find .map-inner'), $('.map-neighbor .map-inner'), $('.rooms')].forEach(function (t) {
        if (t) new MutationObserver(schedule).observe(t, cfg);
      });
      new MutationObserver(function () { setTimeout(fit, 0); }).observe(document.body, { attributes: true, attributeFilter: ['data-view'] });

      renderFind();
      renderNear();
      fit();
    } catch (e) {
      fail(e);
    }
  }
})();
