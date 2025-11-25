from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

from flask import Flask
import os
from extensions import db
from routes.profile import profile_bp
from routes.alliance import alliance_bp
from routes.resource import resource_bp
from routes.battle import battle_bp
from routes.upload import upload_bp

app = Flask(__name__)

# 配置
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev_secret_key')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///san_minipro.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['WECHAT_APP_ID'] = os.getenv('WECHAT_APP_ID', 'YOUR_APP_ID')
app.config['WECHAT_APP_SECRET'] = os.getenv('WECHAT_APP_SECRET', 'YOUR_APP_SECRET')
app.config['UPLOAD_FOLDER'] = os.path.join(app.root_path, 'static/uploads')

# 确保上传目录存在
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

print(f"INFO: Application Startup - Config Loaded")
# print(f"INFO: AppID from config: {app.config.get('WECHAT_APP_ID')}")

# 初始化数据库
db.init_app(app)

# 注册蓝图
app.register_blueprint(profile_bp)
app.register_blueprint(alliance_bp)
app.register_blueprint(resource_bp)
app.register_blueprint(battle_bp)
app.register_blueprint(upload_bp)

if __name__ == '__main__':
    app.run(debug=True, port=5000)
