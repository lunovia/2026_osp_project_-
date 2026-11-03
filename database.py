
import os
import firebase_admin

from firebase_admin import credentials, db


class DBhandler:
    def __init__(self):
        if not firebase_admin._apps:
            credential_path = os.environ.get(
                "FIREBASE_CREDENTIALS"
            )
            database_url = os.environ.get(
                "FIREBASE_DATABASE_URL"
            )

            if not credential_path or not database_url:
                raise RuntimeError(
                    "Firebase configuration is missing."
                )

            cred = credentials.Certificate(credential_path)

            firebase_admin.initialize_app(
                cred,
                {"databaseURL": database_url}
            )

    def get_user(self, user_id):
        return db.reference("user").child(user_id).get()

    def create_user(self, user_id, nickname, password_hash):
        user_ref = db.reference("user").child(user_id)

        def save_if_available(current):
            if current is not None:
                return current

            return {
                "id": user_id,
                "nickname": nickname,
                "password": password_hash
            }

        result = user_ref.transaction(save_if_available)

        return (
            result is not None
            and result.get("password") == password_hash
        )
