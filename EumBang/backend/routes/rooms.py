"""B 담당자: Room Blueprint. 기존 EwhaMarket endpoint와 별도로 등록한다."""
import os
import secrets
import uuid
import warnings
from pathlib import Path

from flask import Blueprint, current_app, jsonify, redirect, render_template, request, session, url_for
from PIL import Image, UnidentifiedImageError

from services.room_service import (FACILITIES, ROOM_TYPES, SORTS, ValidationError,
                                   map_points, paginate, parse_filters, parse_room)

MAX_IMAGES = 10
MAX_IMAGE_BYTES = 5 * 1024 * 1024
IMAGE_FORMATS = {'JPEG': 'jpg', 'PNG': 'png', 'WEBP': 'webp', 'GIF': 'gif'}


def _save_images(files):
    """파일명은 신뢰하지 않고 이미지 실제 형식을 검증한 뒤 UUID로 저장한다."""
    if not 1 <= len(files) <= MAX_IMAGES:
        raise ValidationError('사진을 1~10장 선택해 주세요.')
    folder = Path(current_app.config['ROOM_UPLOAD_FOLDER'])
    folder.mkdir(parents=True, exist_ok=True)
    saved = []
    try:
        for file in files:
            # 파일별 크기 제한: MAX_CONTENT_LENGTH는 전체 요청을 제한한다.
            file.stream.seek(0, os.SEEK_END)
            size = file.stream.tell()
            file.stream.seek(0)
            if not 0 < size <= MAX_IMAGE_BYTES:
                raise ValidationError('사진은 장당 최대 5MB까지 가능해요.')
            try:
                with warnings.catch_warnings():
                    warnings.simplefilter('error', Image.DecompressionBombWarning)
                    with Image.open(file.stream) as image:
                        extension = IMAGE_FORMATS.get(image.format)
                        if not extension or image.width * image.height > 25_000_000:
                            raise ValidationError('지원되는 이미지 형식과 크기를 확인해 주세요.')
                        image.verify()
            except (UnidentifiedImageError, OSError, SyntaxError, Image.DecompressionBombError,
                    Image.DecompressionBombWarning):
                raise ValidationError('올바른 이미지 파일을 선택해 주세요.') from None
            # 원본 파일명을 쓰지 않는다. EXIF 등 메타데이터 제거를 위해 재인코딩한다.
            file.stream.seek(0)
            name = uuid.uuid4().hex + '.' + extension
            saved.append(name)
            with Image.open(file.stream) as image:
                clean = image.convert('RGB' if extension == 'jpg' else 'RGBA')
                clean.info.clear()
                clean.save(folder / name, format={'jpg':'JPEG','png':'PNG','webp':'WEBP','gif':'GIF'}[extension])
    except Exception:
        _delete_images(saved)
        raise
    return saved


def _delete_images(names):
    # 업로드 중 오류 또는 저장 실패 시 이번 요청에서 생성한 파일만 정리한다.
    folder = Path(current_app.config['ROOM_UPLOAD_FOLDER'])
    for name in names:
        try:
            (folder / name).unlink(missing_ok=True)
        except OSError:
            current_app.logger.warning('Room image cleanup failed', exc_info=True)


def create_room_blueprint(service_factory):
    """service_factory는 요청마다 새로운 DB 접근 객체를 만든다.

    테스트에서는 FakeFirebase 서비스를 주입할 수 있다. 기존 로그인 세션 key='id' 유지.
    """
    bp = Blueprint('rooms', __name__, url_prefix='/rooms')

    def context(**values):
        # 새 디자인을 담당하는 frontend가 동일한 context를 사용할 수 있다.
        return {'room_types': ROOM_TYPES, 'facilities': FACILITIES, 'sorts': SORTS, **values}

    def json_requested():
        return request.args.get('format') == 'json'

    @bp.before_request
    def require_login():
        # 이음방은 학교 계정 사용자 전용. 실제 이메일 인증은 A 담당자의 후속 작업.
        if not session.get('id'):
            if json_requested():
                return jsonify(error='로그인이 필요해요.'), 401
            if request.method == 'GET':
                return redirect(url_for('login'))
            return render_template('rooms/error.html', message='로그인이 필요해요.'), 401

    @bp.errorhandler(413)
    def too_large(_error):
        return render_template('rooms/error.html', message='업로드 용량 제한을 초과했어요.'), 413

    @bp.route('/register', methods=['GET', 'POST'])
    def register_room():
        # 브라우저가 제출한 owner_id가 아닌 세션 ID를 신뢰한다.
        owner_id = session.get('id')
        token = session.setdefault('room_csrf', secrets.token_urlsafe(32))
        if request.method == 'GET':
            return render_template('rooms/register.html', **context(csrf_token=token))
        images = []
        try:
            # CSRF 토큰으로 다른 웹사이트에서 강제로 방을 등록하는 요청을 방지한다.
            submitted = request.form.get('csrf_token', '')
            if not secrets.compare_digest(submitted.encode(), token.encode()):
                raise ValidationError('요청이 만료되었어요. 다시 시도해 주세요.')
            data = parse_room(request.form, owner_id)
            files = [f for f in request.files.getlist('pictures') if f.filename]
            images = _save_images(files)
            room_id = service_factory().insert_room(data, images)
        except ValidationError as exc:
            return render_template('rooms/register.html', **context(csrf_token=token, error=str(exc), form=request.form)), 400
        except Exception:
            # Firebase 요청 결과가 불확실한 네트워크 장애에서는 이미 저장됐을 수 있어
            # 이미지 삭제가 오히려 깨진 레코드를 만들 수 있다. 관리자 정리를 위해 로그만 남긴다.
            current_app.logger.exception('Room registration failed')
            return render_template('rooms/error.html', message='방 저장에 실패했어요. 목록을 확인한 후 다시 시도해 주세요.'), 503
        # POST-Redirect-GET: 페이지 새로고침으로 중복 등록되는 일을 막는다.
        return redirect(url_for('rooms.room_detail', room_id=room_id), code=303)

    @bp.get('')
    @bp.get('/')
    def room_list():
        try:
            filters = parse_filters(request.args)
            page = request.args.get('page', 1, type=int)
        except ValidationError as exc:
            if json_requested():
                return jsonify(error=str(exc)), 400
            return render_template('rooms/error.html', message=str(exc)), 400
        try:
            matched = service_factory().search_rooms(filters)
        except Exception:
            current_app.logger.exception('Room list failed')
            if json_requested():
                return jsonify(error='방 목록을 불러오지 못했어요.'), 503
            return render_template('rooms/error.html', message='방 목록을 불러오지 못했어요.'), 503
        items, page, page_count = paginate(matched, page)
        # 지도에는 페이지별 4개가 아닌 검색 결과 전체의 좌표를 전달한다.
        payload = dict(rooms=items, page=page, page_count=page_count, total=len(matched),
                       map_points=map_points(matched), filters=filters)
        if json_requested():
            return jsonify(payload)
        # 페이지 링크에서 현재 검색 조건을 유지한다.
        def page_url(number):
            args = request.args.to_dict(flat=False)
            args['page'] = [number]
            return url_for('rooms.room_list', **args)
        return render_template('rooms/list.html', **context(**payload, page_url=page_url))

    @bp.get('/<room_id>')
    def room_detail(room_id):
        try:
            room = service_factory().get_room(room_id)
        except Exception:
            current_app.logger.exception('Room detail failed')
            if json_requested():
                return jsonify(error='방 정보를 불러오지 못했어요.'), 503
            return render_template('rooms/error.html', message='방 정보를 불러오지 못했어요.'), 503
        if room is None:
            if json_requested():
                return jsonify(error='등록된 방이 없어요.'), 404
            return render_template('rooms/error.html', message='등록된 방이 없어요.'), 404
        # A 담당자의 후기/물려주기에는 같은 room_id를 전달해 연결한다.
        if json_requested():
            return jsonify(room=room)
        return render_template('rooms/detail.html', room=room)

    return bp
