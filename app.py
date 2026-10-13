import os
import uuid

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


if __name__ == "__main__":
    app.run(debug=True)
    