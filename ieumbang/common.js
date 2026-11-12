/* 이음방 공통: 상단 메뉴 삽입 + 로그인 아이디 표시 + 화면 맞춤(스크롤 없이 꽉 차게)
 * 사용법: <body data-active="home|find|post|share|map|review" data-dw="1280"> 
 *         <div class="ieum-page"><div id="ieum-header"></div> ... </div>
 */
(function () {
  'use strict';
  var body = document.body;
  var ACTIVE = body.getAttribute('data-active') || '';
  var MENU = [
    ['home', '홈', '../files/index.html'],
    ['find', '방 찾기', '../ieumbang/map.html'],
    ['post', '방 내놓기', '../files/post.html'],
    ['share', '물려주기', '../files/find.html'],
    ['map', '동네 지도', '../ieumbang/map.html?view=map'],
    ['review', '후기', "../ieumbang-Mary%27sPart/ReviewList.html"]
  ];

  var host = document.getElementById('ieum-header');
  if (host) {
    var html = '<header class="ieum-hd"><a class="ieum-logo" href="../files/index.html">이음방</a><nav>';
    MENU.forEach(function (m) {
      html += '<a href="' + m[2] + '"' + (m[0] === ACTIVE ? ' class="on"' : '') + '>' + m[1] + '</a>';
    });
    html += '</nav><div class="ieum-user"><span><b id="ieum-uid">ewha_in</b> 님</span>' +
            '<button type="button" class="ieum-logout" id="ieum-logout">로그아웃</button></div></header>';
    host.outerHTML = html;
    var s = window.Auth && Auth.session();
    if (s) document.getElementById('ieum-uid').textContent = s.id;
    document.getElementById('ieum-logout').addEventListener('click', function () {
      if (window.Auth) Auth.logout();
      location.href = '../ieumbang/login.html';
    });
  }

  /* ---------- 화면 맞춤 ---------- */
  var page = document.querySelector('.ieum-page');
  var DW = parseFloat(body.getAttribute('data-dw')) || 1280;
  var MAX = 1.6;
  function fit() {
    if (!page) return;
    page.style.transform = 'none';
    page.style.width = DW + 'px';
    page.style.height = 'auto';
    var H = page.offsetHeight;
    var s = Math.min(window.innerWidth / DW, window.innerHeight / H, MAX);
    page.style.width = (window.innerWidth / s) + 'px';
    page.style.height = (window.innerHeight / s) + 'px';
    page.style.transform = 'scale(' + s + ')';
  }
  window.addEventListener('resize', fit);
  window.addEventListener('load', fit);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  fit();
  window.ieumFit = fit;
})();
