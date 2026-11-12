/* 카카오 지도 설정
 *
 * 1) https://developers.kakao.com → 내 애플리케이션 → (앱 선택) → 앱 키 에서 "JavaScript 키"를 복사해
 *    아래 따옴표 안에 붙여넣으세요.
 * 2) 같은 앱의 플랫폼(또는 "앱 설정 > 플랫폼") → Web → 사이트 도메인에 아래 주소를 등록하세요.
 *      http://localhost:8000
 *    (file:// 로 직접 연 화면에서는 카카오 지도가 동작하지 않습니다.
 *     python -m http.server 8000 으로 띄운 뒤 http://localhost:8000/ieumbang/map.html 로 접속하세요.)
 * 3) 키가 비어 있으면 기본(그림) 지도가 그대로 표시됩니다.
 */
window.KAKAO_MAP_KEY = '';
