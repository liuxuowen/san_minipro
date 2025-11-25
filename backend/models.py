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

class UploadRecord(db.Model):
    __tablename__ = 'upload_records'
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(256), nullable=False)
    upload_time = db.Column(db.DateTime, default=datetime.now)
    member_count = db.Column(db.Integer, default=0)
    # 存储从文件名解析出的统计时间，用于去重
    stats_time = db.Column(db.DateTime, nullable=True)
    
    # 可以添加更多字段，如关联的用户ID等
    # user_id = db.Column(db.String(64), db.ForeignKey('users.openid'))

    def to_dict(self):
        return {
            'id': self.id,
            'filename': self.filename,
            'ts': self.upload_time.strftime('%Y-%m-%d %H:%M:%S'),
            'stats_time': self.stats_time.strftime('%Y-%m-%d %H:%M:%S') if self.stats_time else None,
            'member_count': self.member_count
        }

class AllianceData(db.Model):
    __tablename__ = 'alliance_data'
    id = db.Column(db.Integer, primary_key=True)
    upload_id = db.Column(db.Integer, db.ForeignKey('upload_records.id'), nullable=False)
    rank = db.Column(db.Integer, default=0)
    name = db.Column(db.String(64), nullable=False)
    group_name = db.Column(db.String(64), default='未分组')
    contribution = db.Column(db.Integer, default=0)
    power = db.Column(db.Integer, default=0)
    battle_achievement = db.Column(db.Integer, default=0)
    assist = db.Column(db.Integer, default=0)
    donation = db.Column(db.Integer, default=0)
    
    # 建立与 UploadRecord 的关系
    upload_record = db.relationship('UploadRecord', backref=db.backref('details', cascade='all, delete-orphan'))

    def to_dict(self):
        return {
            'rank': self.rank,
            'name': self.name,
            'group_name': self.group_name,
            'contribution': self.contribution,
            'power': self.power,
            'battle_achievement': self.battle_achievement,
            'assist': self.assist,
            'donation': self.donation
        }
