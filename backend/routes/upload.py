from flask import Blueprint, request, jsonify, current_app, url_for
import os
import uuid
from werkzeug.utils import secure_filename

upload_bp = Blueprint('upload', __name__)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@upload_bp.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file and allowed_file(file.filename):
        # 生成唯一文件名
        ext = file.filename.rsplit('.', 1)[1].lower()
        filename = f"{uuid.uuid4().hex}.{ext}"
        save_path = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
        
        try:
            file.save(save_path)
            # 生成完整的访问 URL
            # 注意：这里生成的是相对路径或基于请求的完整路径
            # 在生产环境中，可能需要根据配置返回 CDN 域名或服务器 IP
            file_url = url_for('static', filename=f'uploads/{filename}', _external=True)
            
            # 如果是在反向代理后面（如 Nginx），_external=True 可能生成 http://127.0.0.1...
            # 这里做一个简单的替换修复，或者依赖前端拼接
            # 为了简单，我们直接返回相对路径，由前端拼接 base_url
            relative_path = f'/static/uploads/{filename}'
            
            return jsonify({
                'success': True, 
                'url': file_url,
                'path': relative_path
            })
        except Exception as e:
            return jsonify({'error': str(e)}), 500
            
    return jsonify({'error': 'File type not allowed'}), 400
