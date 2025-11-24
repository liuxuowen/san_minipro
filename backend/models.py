from extensions import db
from datetime import datetime

class User(db.Model):
    __tablename__ = 'users'
    openid = db.Column(db.String(64), primary_key=True)
    nickname = db.Column(db.String(64), nullable=True)
    avatar_url = db.Column(db.String(512), nullable=True)
    registration_time = db.Column(db.DateTime, default=datetime.now)
    last_login_time = db.Column(db.DateTime, default=datetime.now)
    login_count = db.Column(db.Integer, default=1)

    def to_dict(self):
        return {
            'openid': self.openid,
            'nickname': self.nickname,
            'avatar_url': self.avatar_url,
            'registration_time': self.registration_time.isoformat(),
            'last_login_time': self.last_login_time.isoformat(),
            'login_count': self.login_count
        }
