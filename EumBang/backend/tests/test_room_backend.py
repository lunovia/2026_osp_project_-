"""실제 Firebase 인증 정보 없이 B 담당자 로직을 검증한다."""
import io
import re
import tempfile
import unittest
from pathlib import Path

from services.room_service import RoomService, ValidationError, parse_room, parse_filters, paginate, map_points


class MultiDict(dict):
    def getlist(self, key):
        value = self.get(key, [])
        return value if isinstance(value, list) else [value]


class Snapshot:
    def __init__(self, value):
        self.value = value

    def val(self):
        return self.value


class FakeFirebase:
    """Pyrebase의 child/set/get/val 인터페이스를 흉내내는 in-memory DB."""
    def __init__(self, store=None, path=()):
        self.store = {} if store is None else store
        self.path = path

    def child(self, key):
        return FakeFirebase(self.store, (*self.path, key))

    def set(self, data):
        node = self.store
        for key in self.path[:-1]:
            node = node.setdefault(key, {})
        node[self.path[-1]] = data

    def get(self):
        node = self.store
        for key in self.path:
            node = node.get(key) if isinstance(node, dict) else None
        return Snapshot(node)


def sample(**changes):
    return MultiDict(title='채광 좋은 방', address='대현동', monthly_rent='50', deposit='500',
                     maintenance_fee='5', size='6.5', floor='2', room_type='원룸',
                     available_date='2026-12-20', facilities=['세탁기', '냉장고'],
                     latitude='37.55', longitude='126.94', walk_minutes='7',
                     tenant_comment='햇빛이 좋아요.') | changes


def room_form(**changes):
    return MultiDict(sample(**changes))


class RoomServiceTests(unittest.TestCase):
    def setUp(self):
        self.db = FakeFirebase()
        self.service = RoomService(self.db)

    def create(self, **changes):
        return self.service.insert_room(parse_room(room_form(**changes), 'student'), ['test.jpg'])

    def test_round_trip_money_and_id(self):
        room_id = self.create()
        self.assertEqual(len(room_id), 32)
        room = self.service.get_room(room_id)
        self.assertEqual(room['monthly_rent'], 500000)
        self.assertEqual(room['deposit'], 5000000)
        self.assertEqual(room['maintenance_fee'], 50000)
        self.assertEqual(room['owner_id'], 'student')
        self.assertEqual(room['images'], ['test.jpg'])

    def test_same_title_not_overwritten(self):
        self.assertNotEqual(self.create(), self.create())
        self.assertEqual(len(self.service.get_rooms()), 2)

    def test_not_found(self):
        self.assertIsNone(self.service.get_room('0' * 32))
        self.assertIsNone(self.service.get_room('../x'))

    def test_invalid_input(self):
        for changes in [dict(monthly_rent='-1'), dict(deposit='abc'), dict(title=''),
                        dict(available_date='2026-02-30'), dict(room_type='unknown'),
                        dict(latitude='nan'), dict(longitude=''), dict(facilities=['unknown'])]:
            with self.subTest(changes=changes), self.assertRaises(ValidationError):
                parse_room(room_form(**changes), 'student')

    def test_session_owner_not_form_owner(self):
        self.assertEqual(parse_room(room_form(owner_id='forged'), 'real')['owner_id'], 'real')

    def test_optional_fields_and_empty_lists(self):
        room_id = self.create(latitude='', longitude='', walk_minutes='', facilities=[])
        room = self.service.get_room(room_id)
        self.assertIsNone(room['latitude'])
        self.assertEqual(room['facilities'], [])
        self.assertEqual(map_points([room]), [])

    def test_search_and_multi_facility_filter(self):
        match = self.create(monthly_rent='45')
        self.create(monthly_rent='70')
        self.create(monthly_rent='40', facilities=['세탁기'])
        self.create(address='신촌', monthly_rent='40')
        filters = parse_filters(MultiDict(q='대현동', max_rent='600000', facility=['세탁기','냉장고']))
        self.assertEqual([r['room_id'] for r in self.service.search_rooms(filters)], [match])

    def test_sort_distance_and_deposit(self):
        a = self.create(monthly_rent='50', walk_minutes='7', deposit='500')
        b = self.create(monthly_rent='45', walk_minutes='15', deposit='100')
        self.create(deposit='1000', walk_minutes='1')
        filters = parse_filters(MultiDict(max_deposit='5000000', sort='distance'))
        self.assertEqual([r['room_id'] for r in self.service.search_rooms(filters)], [a,b])
        filters = parse_filters(MultiDict(max_rent='500000', sort='rent_asc'))
        self.assertEqual(self.service.search_rooms(filters)[0]['room_id'], b)

    def test_invalid_filters(self):
        for data in [dict(min_rent='9', max_rent='1'), dict(max_rent='-1'), dict(sort='x')]:
            with self.assertRaises(ValidationError):
                parse_filters(MultiDict(data))

    def test_filter_before_pagination(self):
        for i in range(6):
            self.create(monthly_rent=str(40+i))
        rows = self.service.search_rooms(parse_filters(MultiDict(sort='rent_asc')))
        items, page, count = paginate(rows, 2)
        self.assertEqual((page,count,len(items)), (2,2,2))
        self.assertEqual(paginate(rows, 999)[1], 2)
        self.assertEqual(paginate([], -1), ([],1,1))

    def test_map_points(self):
        self.create()
        points = map_points(self.service.get_rooms())
        self.assertEqual(len(points), 1)
        self.assertEqual(points[0]['latitude'], 37.55)
        self.assertNotIn('owner_id', points[0])
        self.assertNotIn('address', points[0])


try:
    from flask import Flask
    from PIL import Image
    from routes.rooms import create_room_blueprint
    HAS_WEB_DEPS = True
except ImportError:
    HAS_WEB_DEPS = False


@unittest.skipUnless(HAS_WEB_DEPS, 'Flask/Pillow not installed')
class RoomRouteTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.db = FakeFirebase()
        app = Flask(__name__, template_folder=str(Path(__file__).resolve().parents[1] / 'templates'))
        # 독립 패키지에는 기존 base.html이 없으므로 테스트 전용 base 템플릿만 주입.
        from jinja2 import ChoiceLoader, DictLoader
        app.jinja_loader = ChoiceLoader([DictLoader({'base.html': '{% block content %}{% endblock %}'}), app.jinja_loader])
        app.config.update(TESTING=True, SECRET_KEY='test-only', ROOM_UPLOAD_FOLDER=self.temp.name,
                          MAX_CONTENT_LENGTH=52*1024*1024)
        app.add_url_rule('/login', 'login', lambda: 'Login')
        app.register_blueprint(create_room_blueprint(lambda: RoomService(self.db)))
        self.client = app.test_client()

    def login(self):
        with self.client.session_transaction() as session:
            session['id'] = 'student'
        response = self.client.get('/rooms/register')
        self.assertEqual(response.status_code, 200)
        return re.search(rb'name="csrf_token" value="([^"]+)"', response.data).group(1).decode()

    def png(self):
        stream = io.BytesIO()
        Image.new('RGB', (8, 8), 'white').save(stream, 'PNG')
        stream.seek(0)
        return (stream, 'sample.png')

    def test_login_required(self):
        self.assertEqual(self.client.get('/rooms?format=json').status_code, 401)
        self.assertEqual(self.client.get('/rooms/register').status_code, 302)

    def test_registration_list_detail_and_map(self):
        token = self.login()
        data = dict(room_form(), csrf_token=token, pictures=[self.png(), self.png()])
        response = self.client.post('/rooms/register', data=data, content_type='multipart/form-data')
        self.assertEqual(response.status_code, 303)
        detail = self.client.get(response.location + '?format=json').get_json()['room']
        self.assertEqual(len(detail['images']), 2)
        self.assertEqual(detail['owner_id'], 'student')
        self.assertEqual(len(list(Path(self.temp.name).iterdir())), 2)
        listing = self.client.get('/rooms?format=json&max_rent=600000').get_json()
        self.assertEqual(listing['total'], 1)
        self.assertEqual(len(listing['map_points']), 1)
        self.assertEqual(self.client.get('/rooms/' + '0'*32).status_code, 404)

    def test_csrf_and_bad_image(self):
        token = self.login()
        data = dict(room_form(), csrf_token='bad', pictures=self.png())
        self.assertEqual(self.client.post('/rooms/register', data=data).status_code, 400)
        data = dict(room_form(), csrf_token=token, pictures=(io.BytesIO(b'not image'), 'fake.png'))
        self.assertEqual(self.client.post('/rooms/register', data=data).status_code, 400)
        self.assertEqual(len(list(Path(self.temp.name).iterdir())), 0)


if __name__ == '__main__':
    unittest.main()
