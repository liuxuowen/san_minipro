from flask import Flask
import os
from dotenv import load_dotenv
from extensions import db
from routes.profile import profile_bp
from routes.alliance import alliance_bp
from routes.resource import resource_bp
from routes.battle import battle_bp

# 加载环境变量
load_dotenv()

app = Flask(__name__)

# 配置
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev_secret_key')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///san_minipro.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# 初始化数据库
db.init_app(app)

# 注册蓝图
app.register_blueprint(profile_bp)
app.register_blueprint(alliance_bp)
app.register_blueprint(resource_bp)
app.register_blueprint(battle_bp)

# 创建数据库表
with app.app_context():
    # 导入模型以确保它们被 SQLAlchemy 识别
    from models import User
    db.create_all()

if __name__ == '__main__':
    app.run(debug=True, port=5000)
