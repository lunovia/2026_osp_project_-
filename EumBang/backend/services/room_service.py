"""B 담당자: 방 데이터 검증, Firebase 접근, 검색/정렬/페이지네이션.

Flask를 사용하지 않는 순수 로직이므로 실제 Firebase 없이 테스트할 수 있다.
"""
import math
import uuid
from datetime import date, datetime, timezone

ROOM_TYPES = ('원룸', '분리형 원룸', '투룸', '오피스텔', '쉐어')
FACILITIES = ('세탁기', '냉장고', '에어컨', '인덕션', '도어락', '엘리베이터',
              '책상', '베란다', 'CCTV', '침대', '옷장', '인터넷')
STATUSES = ('available', 'reserved', 'closed')
SORTS = ('newest', 'rent_asc', 'rent_desc', 'distance')
PER_PAGE = 4  # 기존 과제의 2×2 목록 규칙 유지


class ValidationError(ValueError):
    """잘못된 사용자 입력. 라우트에서 HTTP 400으로 변환한다."""


def text_field(value, label, maximum, required=False):
    value = str(value or '').strip()
    if required and not value:
        raise ValidationError(f'{label}을(를) 입력해 주세요.')
    if len(value) > maximum:
        raise ValidationError(f'{label}: 최대 {maximum}자까지 입력해 주세요.')
    return value


def integer(value, label, minimum=0, maximum=1_000_000_000, optional=False):
    # 빈 선택 필드는 None, 0은 유효한 숫자다. 음수/소수/문자를 거절한다.
    if optional and (value is None or value == ''):
        return None
    try:
        number = int(str(value))
    except (ValueError, TypeError):
        raise ValidationError(f'{label}: 정수를 입력해 주세요.') from None
    if not minimum <= number <= maximum:
        raise ValidationError(f'{label}: 허용 범위를 확인해 주세요.')
    return number


def decimal(value, label, minimum, maximum, optional=False):
    if optional and (value is None or value == ''):
        return None
    try:
        number = float(value)
    except (ValueError, TypeError):
        raise ValidationError(f'{label}: 숫자를 입력해 주세요.') from None
    # NaN, infinity는 지도/JSON/Firebase 데이터에서 사용할 수 없다.
    if not math.isfinite(number) or not minimum <= number <= maximum:
        raise ValidationError(f'{label}: 허용 범위를 확인해 주세요.')
    return number


def choices(values, allowed, label):
    # 체크박스는 같은 name으로 여러 값을 보내므로 getlist()를 사용한다.
    if not isinstance(values, (list, tuple)):
        raise ValidationError(f'{label}: 목록 형식이 필요해요.')
    if any(not isinstance(v, str) or v not in allowed for v in values):
        raise ValidationError(f'{label}: 올바른 항목을 선택해 주세요.')
    return list(dict.fromkeys(values))


def parse_room(form, owner_id):
    """HTML 폼 가격 단위는 만원, DB와 검색 API는 원으로 통일한다.

    owner_id는 폼 값이 아니라 서버가 확인한 로그인 세션에서 받는다.
    주소는 동/건물 근처 정도만 입력하도록 안내한다. 정확한 호수는 저장하지 않는다.
    """
    if not owner_id:
        raise ValidationError('로그인이 필요해요.')
    title = text_field(form.get('title'), '방 소개 제목', 100, True)
    address = text_field(form.get('address'), '공개용 주소', 150, True)
    room_type = form.get('room_type')
    if room_type not in ROOM_TYPES:
        raise ValidationError('방 종류를 선택해 주세요.')
    available = text_field(form.get('available_date'), '입주 가능일', 10, True)
    try:
        if date.fromisoformat(available).isoformat() != available:
            raise ValueError
    except ValueError:
        raise ValidationError('입주 가능일은 YYYY-MM-DD 형식으로 입력해 주세요.') from None
    lat = decimal(form.get('latitude'), '위도', -90, 90, optional=True)
    lng = decimal(form.get('longitude'), '경도', -180, 180, optional=True)
    if (lat is None) != (lng is None):
        raise ValidationError('위도와 경도를 함께 입력해 주세요.')
    # 공개용 핀은 건물 근처 위치만 전달하도록 UX와 연동해야 한다.
    # 도보 시간은 지도 API 계산값이 아니라 등록자가 제공하는 참고값이다.
    facilities = choices(form.getlist('facilities'), FACILITIES, '시설')
    return {
        'owner_id': owner_id,
        'title': title,
        'address': address,
        'monthly_rent': integer(form.get('monthly_rent'), '월세', maximum=100_000) * 10_000,
        'deposit': integer(form.get('deposit'), '보증금', maximum=1_000_000) * 10_000,
        'maintenance_fee': integer(form.get('maintenance_fee') or '0', '관리비', maximum=100_000) * 10_000,
        'size': decimal(form.get('size'), '크기(평)', 0.1, 1000, optional=True),
        'floor': integer(form.get('floor'), '층', minimum=-10, maximum=200, optional=True),
        'room_type': room_type,
        'available_date': available,
        'facilities': facilities,
        'tenant_comment': text_field(form.get('tenant_comment'), '전 세입자 한마디', 2000),
        'latitude': lat,
        'longitude': lng,
        'walk_minutes': integer(form.get('walk_minutes'), '도보 시간', maximum=300, optional=True),
        'status': 'available',
        'created_at': datetime.now(timezone.utc).isoformat(),
    }


def parse_filters(args):
    """GET 검색 조건을 읽는다. 검색 API 가격은 원 단위(예: 600000)."""
    filters = {'q': text_field(args.get('q'), '검색어', 100),
               'room_type': args.get('room_type') or '',
               'sort': args.get('sort') or 'newest',
               'facilities': choices(args.getlist('facility'), FACILITIES, '시설')}
    if filters['room_type'] and filters['room_type'] not in ROOM_TYPES:
        raise ValidationError('방 종류를 확인해 주세요.')
    if filters['sort'] not in SORTS:
        raise ValidationError('정렬 조건을 확인해 주세요.')
    for field in ('min_rent', 'max_rent', 'max_deposit', 'max_walk'):
        filters[field] = integer(args.get(field), field, optional=True)
    if filters['min_rent'] is not None and filters['max_rent'] is not None and filters['min_rent'] > filters['max_rent']:
        raise ValidationError('최소 월세는 최대 월세보다 작거나 같아야 해요.')
    return filters


def valid_room_id(room_id):
    # 생성 시 UUID hex 사용. Firebase 경로에 임의 문자/슬래시가 들어가지 않도록 검사.
    return isinstance(room_id, str) and len(room_id) == 32 and all(c in '0123456789abcdef' for c in room_id)


def normalize_room(room_id, data):
    """Firebase는 빈 리스트/None을 생략할 수 있어 화면용 기본값을 복원한다."""
    room = dict(data)
    room['room_id'] = room_id
    for key in ('facilities', 'images'):
        value = room.get(key) or []
        # 일부 Firebase SDK에서는 리스트를 숫자 키의 객체로 돌려줄 수 있다.
        if isinstance(value, dict):
            value = list(value.values())
        room[key] = [v for v in value if isinstance(v, str)] if isinstance(value, list) else []
    for key in ('latitude', 'longitude', 'walk_minutes', 'size', 'floor'):
        room.setdefault(key, None)
    room.setdefault('tenant_comment', '')
    return room


class RoomService:
    """DBhandler().db를 주입받는다. User/Handover/Review 경로는 수정하지 않는다."""
    def __init__(self, db):
        self.db = db

    def insert_room(self, data, images):
        # 제목을 key로 쓰면 같은 제목의 방이 덮어써진다. UUID로 분리한다.
        room_id = uuid.uuid4().hex
        room = dict(data, images=list(images))
        # Firebase는 None을 저장하지 않으므로 선택 필드는 제외한다.
        self.db.child('rooms').child(room_id).set({k: v for k, v in room.items() if v is not None})
        return room_id

    def get_room(self, room_id):
        if not valid_room_id(room_id):
            return None
        data = self.db.child('rooms').child(room_id).get().val()
        return normalize_room(room_id, data) if isinstance(data, dict) else None

    def get_rooms(self):
        raw = self.db.child('rooms').get().val() or {}
        if not isinstance(raw, dict):
            return []
        return [normalize_room(key, data) for key, data in raw.items()
                if valid_room_id(key) and isinstance(data, dict)]

    def search_rooms(self, filters):
        """학생 프로젝트의 소량 데이터용 메모리 필터. 대용량은 DB query/index 필요."""
        result = []
        for room in self.get_rooms():
            if room.get('status') != 'available':
                continue
            # 검색어는 제목, 동네, 방 종류, 편의시설에서 찾는다.
            words = ' '.join([room.get('title', ''), room.get('address', ''),
                              room.get('room_type', ''), ' '.join(room['facilities'])]).casefold()
            if filters['q'].casefold() not in words:
                continue
            if filters['room_type'] and filters['room_type'] != room.get('room_type'):
                continue
            if not set(filters['facilities']).issubset(room['facilities']):
                continue
            rent, deposit, walk = room.get('monthly_rent'), room.get('deposit'), room.get('walk_minutes')
            if not isinstance(rent, int) or not isinstance(deposit, int):
                continue
            if filters['min_rent'] is not None and rent < filters['min_rent']:
                continue
            if filters['max_rent'] is not None and rent > filters['max_rent']:
                continue
            if filters['max_deposit'] is not None and deposit > filters['max_deposit']:
                continue
            if filters['max_walk'] is not None and (walk is None or walk > filters['max_walk']):
                continue
            result.append(room)
        # 먼저 최신순을 정해 같은 가격/거리일 때도 결과 순서를 안정적으로 유지한다.
        result.sort(key=lambda r: (r.get('created_at', ''), r['room_id']), reverse=True)
        if filters['sort'] == 'rent_asc':
            result.sort(key=lambda r: r['monthly_rent'])
        elif filters['sort'] == 'rent_desc':
            result.sort(key=lambda r: r['monthly_rent'], reverse=True)
        elif filters['sort'] == 'distance':
            result.sort(key=lambda r: r['walk_minutes'] if r['walk_minutes'] is not None else math.inf)
        return result


def paginate(rooms, page, per_page=PER_PAGE):
    # 반드시 필터/정렬 후 페이지를 자른다. 빈 검색 결과에도 page=1을 유지한다.
    page_count = max(1, math.ceil(len(rooms) / per_page))
    page = min(max(page, 1), page_count)
    start = (page - 1) * per_page
    return rooms[start:start + per_page], page, page_count


def map_points(rooms):
    """현재 검색 조건에 해당하는 공개용 좌표만 반환 (개인 연락처 제외)."""
    result = []
    for room in rooms:
        if room['latitude'] is None or room['longitude'] is None:
            continue
        result.append({k: room.get(k) for k in ('room_id', 'title', 'latitude', 'longitude', 'monthly_rent', 'deposit', 'walk_minutes')})
    return result
