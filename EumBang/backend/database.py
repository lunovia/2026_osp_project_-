"""Firebase access for the standalone 이음방 room backend.

The credential file is never stored in this project. Set FIREBASE_AUTH_FILE
when the repository uses a different local path; otherwise the existing,
ignored repository-level authentication file is used.
"""

import json
import os
from pathlib import Path

import pyrebase


def _auth_file():
    configured = os.environ.get("FIREBASE_AUTH_FILE")
    if configured:
        return Path(configured)
    return Path(__file__).resolve().parents[2] / "authentication" / "firebase_auth.json"


class RoomDBhandler:
    """Create a Firebase database client for room operations."""

    def __init__(self):
        with _auth_file().open(encoding="utf-8") as file:
            config = json.load(file)
        self.db = pyrebase.initialize_app(config).database()
