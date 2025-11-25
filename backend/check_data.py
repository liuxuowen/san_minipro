from app import app
from extensions import db
from models import AllianceData, UploadRecord

with app.app_context():
    uploads = UploadRecord.query.order_by(UploadRecord.id.desc()).limit(2).all()
    for u in uploads:
        print(f"Upload ID: {u.id}, Filename: {u.filename}")
        data = AllianceData.query.filter_by(upload_id=u.id).limit(5).all()
        for d in data:
            print(f"  Name: {d.name}, Battle: {d.battle_achievement}, Power: {d.power}, Contrib: {d.contribution}")
