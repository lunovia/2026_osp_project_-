import math
import os
import uuid
import hashlib

from flask import Flask, render_template, request, redirect, url_for
from werkzeug.utils import secure_filename

from database import DBhandler
DB = DBhandler()

app = Flask(__name__)

UPLOAD_FOLDER = os.path.join(app.root_path, "static", "uploads")
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp"}
PER_PAGE = 4  # 한 페이지에 보여줄 상품 수 (2열 x 2행)


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

    DB.insert_item(product["product_name"], request.form, picture_filename)

    return render_template("result.html", product=product)


@app.route("/products")
def product_list():
    page = request.args.get("page", 1, type=int)
    data = DB.get_items()
    page_count = max(1, math.ceil(len(data) / PER_PAGE))
    page = min(max(page, 1), page_count)  # 범위 밖 페이지 번호 보정

    start = (page - 1) * PER_PAGE
    items = list(data.items())[start:start + PER_PAGE]  # [(상품명, {...}), ...]

    return render_template(
        "product_list.html",
        items=items,
        page=page,
        page_count=page_count,
    )



@app.route("/products/<name>")
def product_detail(name):
    product = DB.get_item(name)

    if product is None:
        return "Product not found", 404

    product["name"] = name

    if product.get("img_path"):
        product["image"] = "uploads/" + product["img_path"]
    else:
        product["image"] = None

    return render_template(
        "product_detail.html",
        product=product
    )



@app.route("/reviews/register")
def register_review():
    return render_template("review_register.html")


@app.route("/reviews")
def review_list():
    return render_template("review_list.html")

@app.route("/login")
def login():
    return render_template("login.html")



#회원가입 기
@app.route("/signup", methods=["GET", "POST"])
def signup():
	if request.method == "GET":
		return render_template("signup.html")
	data = request.form
	pw_hash = hashlib.sha256(data["password"].encode("utf-8")).hexdigest()
	if DB.insert_user(data, pw_hash):
		return redirect(url_for("login"))
	return render_template("signup.html", error="This ID already exists.")

if __name__ == "__main__":
	app.run(debug=True)
