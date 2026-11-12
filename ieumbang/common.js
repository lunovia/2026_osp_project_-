/* 이음방 공통: 상단 메뉴 삽입 + 로그인 아이디 표시 + 화면 맞춤(스크롤 없이 꽉 차게)
 * 상단 메뉴는 모든 페이지에서 "똑같은 크기"로 보이도록, 페이지 내용과 따로 크기를 계산해요.
 * 사용법: <body data-active="home|find|post|share|map|review" data-dw="1280">
 *         <div class="ieum-page"><div id="ieum-header"></div> ... </div>
 *   (지도 페이지처럼 body[data-view] 가 있으면 방 찾기/동네 지도 메뉴는 페이지 이동 없이 화면만 전환해요)
 */
(function () {
  'use strict';
  var body = document.body;
  var HD = 61;                       // 상단 메뉴 디자인 높이(px)
  var MENU = [
    ['home', '홈', '../files/index.html'],
    ['find', '방 찾기', '../ieumbang/map.html'],
    ['post', '방 내놓기', '../files/post.html'],
    ['share', '물려주기', '../files/find.html'],
    ['map', '동네 지도', '../ieumbang/map.html?view=map'],
    ['review', '후기', "../ieumbang-Mary%27sPart/ReviewList.html"]
  ];
  var hasView = body.hasAttribute('data-view');           // 지도 페이지
  function activeKey() { return hasView ? (body.getAttribute('data-view') === 'map' ? 'map' : 'find') : (body.getAttribute('data-active') || ''); }

  var holder = document.getElementById('ieum-header');
  var wrap = null;
  if (holder || hasView) {
    wrap = document.createElement('div');
    wrap.className = 'ieum-hd-wrap';
    var html = '<header class="ieum-hd"><a class="ieum-logo" href="../files/index.html">이음방</a><nav>';
    MENU.forEach(function (m) { html += '<a href="' + m[2] + '" data-k="' + m[0] + '">' + m[1] + '</a>'; });
    html += '</nav><div class="ieum-user"><span><b id="ieum-uid">ewha_in</b> 님</span>' +
            '<button type="button" class="ieum-logout" id="ieum-logout">로그아웃</button></div></header>';
    wrap.innerHTML = html;
    body.appendChild(wrap);
    if (holder) holder.parentNode.removeChild(holder);

    var s = window.Auth && Auth.session();
    if (s) document.getElementById('ieum-uid').textContent = s.id;
    document.getElementById('ieum-logout').addEventListener('click', function () {
      if (window.Auth) Auth.logout();
      location.href = '../ieumbang/login.html';
    });
    var links = [].slice.call(wrap.querySelectorAll('nav a'));
    function mark() { var k = activeKey(); links.forEach(function (a) { a.classList.toggle('on', a.dataset.k === k); }); }
    mark();
    if (hasView) {
      new MutationObserver(mark).observe(body, { attributes: true, attributeFilter: ['data-view'] });
      links.forEach(function (a) {
        if (a.dataset.k !== 'find' && a.dataset.k !== 'map') return;
        a.addEventListener('click', function (e) { e.preventDefault(); body.setAttribute('data-view', a.dataset.k); });
      });
    }
  }

  /* 상단 메뉴 크기: 창 가로 길이에만 맞춰 모든 페이지에서 같게 */
  function hdScale() { return Math.min(Math.max(window.innerWidth / 1366, 0.85), 1.4); }
  window.ieumHeaderH = function () { return HD * hdScale(); };
  function fitHeader() {
    if (!wrap) return;
    var hs = hdScale();
    wrap.style.width = (window.innerWidth / hs) + 'px';
    wrap.style.transform = 'scale(' + hs + ')';
  }

  /* ---------- 화면 맞춤 (메뉴 아래 영역) ---------- */
  var page = document.querySelector('.ieum-page');
  var DW = parseFloat(body.getAttribute('data-dw')) || 1280;
  var MAX = 1.6;
  function fit() {
    fitHeader();
    if (!page) return;
    var hh = window.ieumHeaderH(), availH = window.innerHeight - hh;
    page.style.transform = 'none';
    page.style.top = hh + 'px';
    page.style.width = DW + 'px';
    page.style.height = 'auto';
    var H = page.offsetHeight;
    var s = Math.min(window.innerWidth / DW, availH / H, MAX);
    page.style.width = (window.innerWidth / s) + 'px';
    page.style.height = (availH / s) + 'px';
    page.style.transform = 'scale(' + s + ')';
  }
  window.addEventListener('resize', function () { fitHeader(); fit(); if (window.ieumOnResize) window.ieumOnResize(); });
  window.addEventListener('load', fit);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  fit();
  window.ieumFit = fit;
})();
