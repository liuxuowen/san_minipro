from flask import Blueprint, request, jsonify, current_app
import requests
import os
from datetime import datetime
from extensions import db
from models import User

profile_bp = Blueprint('profile', __name__)

@profile_bp.route('/api/login', methods=['POST'])
def login():
    data = request.json
    code = data.get('code')
    if not code:
        return jsonify({'error': 'Missing code'}), 400

    # 获取配置
    APP_ID = current_app.config.get('WECHAT_APP_ID')
    APP_SECRET = current_app.config.get('WECHAT_APP_SECRET')

    # 调用微信接口获取 openid
    openid = None
    session_key = None

    if APP_ID == 'YOUR_APP_ID' or APP_ID == 'your_wechat_app_id':
        # 模拟环境
        openid = 'MOCK_OPENID_' + code
        session_key = 'mock_session_key'
    else:
        # 真实环境
        url = f"https://api.weixin.qq.com/sns/jscode2session?appid={APP_ID}&secret={APP_SECRET}&js_code={code}&grant_type=authorization_code"
        try:
            response = requests.get(url)
            res_data = response.json()
            if 'openid' in res_data:
                openid = res_data['openid']
                session_key = res_data.get('session_key')
            else:
                return jsonify({'error': res_data.get('errmsg')}), 400
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    # 处理用户数据
    if openid:
        user = User.query.get(openid)
        now = datetime.now()
        
        if user:
            # 更新登录信息
            user.last_login_time = now
            user.login_count += 1
        else:
            # 注册新用户
            user = User(
                openid=openid,
                registration_time=now,
                last_login_time=now,
                login_count=1
            )
            db.session.add(user)
            print(f"INFO: New user created - OpenID: {openid}, Time: {now}")
        
        try:
            db.session.commit()
            return jsonify({
                'openid': openid, 
                'session_key': session_key,
                'user': user.to_dict()
            })
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': 'Database error: ' + str(e)}), 500

    return jsonify({'error': 'Login failed'}), 400

@profile_bp.route('/api/user/update', methods=['POST'])
def update_user():
    data = request.json
    openid = data.get('openid')
    
    if not openid:
        return jsonify({'error': 'Missing openid'}), 400
        
    user = User.query.get(openid)
    if not user:
        return jsonify({'error': 'User not found'}), 404
        
    if 'nickName' in data:
        user.nickname = data['nickName']
    if 'avatarUrl' in data:
        user.avatar_url = data['avatarUrl']
        
    try:
        db.session.commit()
        return jsonify({'success': True, 'user': user.to_dict()})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
