import os
import uuid

from werkzeug.security import generate_password_hash
from flask import Flask, render_template, request
from werkzeug.utils import secure_filename


app = Flask(__name__)

UPLOAD_FOLDER = os.path.join(app.root_path, "static", "uploads")
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp"}


def allowed_file(filename):
    return (
        "." in filename
        and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS
    )


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/products/register", methods=["GET", "POST"])
def register_product():
    if request.method == "GET":
        return render_template("product_register.html")

    picture = request.files.get("picture")
    picture_filename = None

    if picture and picture.filename:
        if not allowed_file(picture.filename):
            return "Invalid image format", 400

        original_name = secure_filename(picture.filename)
        extension = original_name.rsplit(".", 1)[1].lower()
        picture_filename = f"{uuid.uuid4().hex}.{extension}"

        os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)
        picture.save(
            os.path.join(app.config["UPLOAD_FOLDER"], picture_filename)
        )

    product = {
        "product_name": request.form.get("product_name", ""),
        "seller_id": request.form.get("seller_id", ""),
        "price": request.form.get("price", ""),
        "address": request.form.get("address", ""),
        "status": request.form.get("status", ""),
        "email": request.form.get("email", ""),
        "picture_filename": picture_filename,
    }

    return render_template("result.html", product=product)


@app.route("/products")
def product_list():
    return render_template("product_list.html")


@app.route("/reviews/register")
def register_review():
    return render_template("review_register.html")


@app.route("/reviews")
def review_list():
    return render_template("review_list.html")


@app.route("/signup", methods=["GET", "POST"])
def signup():
    if request.method == "GET":
        return render_template("signup.html")

    user_id = request.form.get("user_id", "").strip()
    password = request.form.get("password", "")
    nickname = request.form.get("nickname", "").strip()

    if not user_id or not password or not nickname:
        return render_template(
            "signup.html",
            error="Please fill in all fields."
        ), 400

    if len(password) < 6:
        return render_template(
            "signup.html",
            error="Password must be at least 6 characters."
        ), 400

    password_hash = generate_password_hash(password)

    # TODO: Check for duplicate IDs in Firebase.
    # TODO: Store user_id, nickname and password_hash in Firebase.

    return render_template(
        "signup.html",
        error="Firebase database is not connected yet."
    ), 501



if __name__ == "__main__":
    app.run(debug=True)
    
