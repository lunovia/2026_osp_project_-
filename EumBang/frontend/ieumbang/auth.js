/* 이음방 임시 계정 처리 (백엔드 연결 전 데모용)
 * - 회원가입한 계정을 이 브라우저의 localStorage 에 저장하고, 로그인 때 아이디/비밀번호가 일치하는지 검사합니다.
 * - 비밀번호는 SHA-256 해시로만 저장합니다. 그래도 실제 서비스용 보안은 아니므로,
 *   백엔드가 생기면 아래 Auth.signup / Auth.login 안을 서버 API 호출(fetch)로 바꾸세요.
 * - 테스트용 기본 계정: 아이디 ewha_kim / 비밀번호 ewha1234!
 */
(function (w) {
  var USERS = 'ieumbang_users', SESSION = 'ieumbang_session';

  function read(k) { try { return JSON.parse(localStorage.getItem(k)) || null; } catch (e) { return null; } }
  function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  function hash(pw) {
    var s = 'ieumbang:' + pw;
    if (w.crypto && w.crypto.subtle && w.TextEncoder) {
      return w.crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)).then(function (b) {
        return Array.prototype.map.call(new Uint8Array(b), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
      });
    }
    return Promise.resolve('b64:' + btoa(unescape(encodeURIComponent(s))));   // 보안 컨텍스트가 아닐 때의 대체값
  }

  // 기본 테스트 계정 준비
  var ready = (function () {
    var users = read(USERS) || {};
    if (users.ewha_kim) return Promise.resolve();
    return hash('ewha1234!').then(function (h) {
      users.ewha_kim = { id: 'ewha_kim', nick: '이화킴', email: '', pw: h };
      write(USERS, users);
    });
  })();

  w.Auth = {
    signup: function (d) {
      return ready.then(function () {
        var users = read(USERS) || {};
        if (users[d.id]) return { ok: false, field: 'uid', error: '이미 사용 중인 아이디예요.' };
        return hash(d.pw).then(function (h) {
          users[d.id] = { id: d.id, nick: d.nick, tel: d.tel || '', email: d.email || '', purpose: d.purpose || '', pw: h };
          write(USERS, users);
          write(SESSION, { id: d.id, nick: d.nick });
          return { ok: true };
        });
      });
    },
    login: function (id, pw) {
      return ready.then(function () {
        var u = (read(USERS) || {})[id];
        if (!u || !pw) return { ok: false };
        return hash(pw).then(function (h) {
          if (h !== u.pw) return { ok: false };
          write(SESSION, { id: u.id, nick: u.nick });
          return { ok: true, user: u };
        });
      });
    },
    session: function () { return read(SESSION); },
    logout: function () { try { localStorage.removeItem(SESSION); } catch (e) {} }
  };
})(window);
