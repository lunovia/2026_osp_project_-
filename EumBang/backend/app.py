"""Standalone Flask entry point for the 이음방 room backend."""

import os
from pathlib import Path

from flask import Flask

from database import RoomDBhandler
from routes.rooms import create_room_blueprint
from services.room_service import RoomService


def _firebase_service():
    """Create a request-scoped room service backed by the existing Firebase."""
    return RoomService(RoomDBhandler().db)


def create_app(service_factory=None):
    """Build the room backend, allowing tests to inject an in-memory service."""
    app = Flask(
        __name__,
        template_folder=str(Path(__file__).with_name("templates")),
    )
    app.config["SECRET_KEY"] = os.environ.get("FLASK_SECRET_KEY") or os.urandom(32)
    app.config["ROOM_UPLOAD_FOLDER"] = str(
        Path(app.root_path) / "static" / "room_uploads"
    )
    app.config["MAX_CONTENT_LENGTH"] = 52 * 1024 * 1024

    app.register_blueprint(create_room_blueprint(service_factory or _firebase_service))

    @app.get("/login")
    def login():
        # Authentication remains the A担当者 follow-up; this endpoint keeps the
        # backend's unauthenticated HTML redirect explicit until then.
        return "이음방 로그인은 frontend에서 진행합니다.", 401

    return app


app = create_app()


if __name__ == "__main__":
    app.run(debug=True)
