import json
import pyrebase

class DBhandler:
	def __init__(self):
		f = open("./authentication/firebase_auth.json")
		config = json.load(f)
		f.close()
		firebase = pyrebase.initialize_app(config)
		self.db = firebase.database()

	def insert_item(self, name, data, img_path):
		item_info = {"seller_id": data["seller_id"], "price": data["price"], "address": data["address"], "status": data["status"], "email": data["email"], "img_path": img_path}
		self.db.child("item").child(name).set(item_info)
		return True

	def get_item(self, name):
		item = self.db.child("item").child(name).get()
		return item.val()

	def get_items(self):
		# {상품명: {...}} 딕셔너리 (Firebase 키 순서 = 이름순). 상품이 없으면 {}
		items = self.db.child("item").get().val()
		return items or {}

	def insert_user(self, data, pw):
		user_info = {"id": data["id"], "pw": pw, "nickname": data["nickname"]}
		if self.user_duplicate_check(data["id"]):
			self.db.child("user").push(user_info)
			return True
		return False

	def user_duplicate_check(self, id_string):
		users = self.db.child("user").get()
		if users.val() is None:
			return True
		for res in users.each():
			if res.val()["id"] == id_string:
				return False
		return True
