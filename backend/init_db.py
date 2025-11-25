from app import app
from extensions import db
from models import User, UploadRecord, AllianceData

if __name__ == '__main__':
    with app.app_context():
        print("Initializing database...")
        db.create_all()
        print("Database initialized successfully!")
