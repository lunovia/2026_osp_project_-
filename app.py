from flask import Flask, render_template, request
from werkzeug.utils import secure_filename
import os

app = Flask(__name__)
UPLOAD = 'static/uploads'
os.makedirs(UPLOAD, exist_ok=True)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/product/new')
def product_form():
    return render_template('product_form.html')

@app.route('/products')
def product_list():
    return render_template('product_list.html')

@app.route('/review/new')
def review_form():
    return render_template('review_form.html')

@app.route('/reviews')
def review_list():
    return render_template('review_list.html')

@app.route('/result', methods=['POST'])
def result():
    pic = request.files['picture']
    name = secure_filename(pic.filename)
    pic.save(os.path.join(UPLOAD, name))
    return render_template('result.html', data=request.form, picture=name)

if __name__ == '__main__':
    app.run(debug=True)
