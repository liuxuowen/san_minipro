"""
OCR识别服务路由
使用腾讯云OCR API进行文字识别
"""
from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename
import base64
import os
import re
from datetime import datetime
from tencentcloud.common import credential
from tencentcloud.common.profile.client_profile import ClientProfile
from tencentcloud.common.profile.http_profile import HttpProfile
from tencentcloud.ocr.v20181119 import ocr_client, models
import json

ocr_bp = Blueprint('ocr', __name__)

# 腾讯云OCR配置
# 从环境变量读取，或在此处配置
TENCENT_SECRET_ID = os.getenv('TENCENT_SECRET_ID', 'your_secret_id')
TENCENT_SECRET_KEY = os.getenv('TENCENT_SECRET_KEY', 'your_secret_key')
TENCENT_REGION = 'ap-guangzhou'  # 华南地区（广州）

# 图片存储配置
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'ocr_uploads')
MAX_FILE_SIZE = 4 * 1024 * 1024  # 4MB
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'bmp', 'webp'}

# 确保上传目录存在
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def allowed_file(filename):
    """检查文件扩展名是否允许"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def save_uploaded_image(base64_data, prefix='ocr'):
    """
    保存上传的图片到本地
    返回保存的文件路径
    """
    try:
        # 去除base64前缀
        if ',' in base64_data:
            base64_data = base64_data.split(',')[1]
        
        # 解码base64
        image_data = base64.b64decode(base64_data)
        
        # 检查文件大小
        if len(image_data) > MAX_FILE_SIZE:
            raise ValueError(f'图片大小超过限制（最大4MB），当前大小: {len(image_data) / 1024 / 1024:.2f}MB')
        
        # 生成文件名：prefix_时间戳.jpg
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
        filename = f"{prefix}_{timestamp}.jpg"
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        
        # 保存文件
        with open(filepath, 'wb') as f:
            f.write(image_data)
        
        return filepath, len(image_data)
    
    except Exception as e:
        raise Exception(f'保存图片失败: {str(e)}')


def get_ocr_client():
    """获取腾讯云OCR客户端"""
    cred = credential.Credential(TENCENT_SECRET_ID, TENCENT_SECRET_KEY)
    
    httpProfile = HttpProfile()
    httpProfile.endpoint = "ocr.tencentcloudapi.com"
    
    clientProfile = ClientProfile()
    clientProfile.httpProfile = httpProfile
    
    client = ocr_client.OcrClient(cred, TENCENT_REGION, clientProfile)
    
    return client


@ocr_bp.route('/api/ocr/recognize', methods=['POST'])
def recognize_text():
    """
    通用文字识别接口
    接收base64编码的图片，返回识别文本
    """
    data = request.json
    image_base64 = data.get('image')
    save_image = data.get('save', True)  # 默认保存图片
    
    if not image_base64:
        return jsonify({'error': '缺少图片数据'}), 400
    
    try:
        # 保存图片（如果需要）
        filepath = None
        file_size = 0
        if save_image:
            filepath, file_size = save_uploaded_image(image_base64, prefix='recognize')
            print(f'[OCR] 图片已保存: {filepath}, 大小: {file_size / 1024:.2f}KB')
        
        # 准备base64数据（去除前缀）
        if ',' in image_base64:
            image_base64 = image_base64.split(',')[1]
        
        # 调用腾讯云OCR
        client = get_ocr_client()
        req = models.GeneralBasicOCRRequest()
        
        params = {
            "ImageBase64": image_base64,
            "LanguageType": "zh"  # 中文识别
        }
        req.from_json_string(json.dumps(params))
        
        resp = client.GeneralBasicOCR(req)
        resp_json = json.loads(resp.to_json_string())
        
        # 提取识别文本
        text_detections = resp_json.get('TextDetections', [])
        text_lines = [item['DetectedText'] for item in text_detections]
        
        return jsonify({
            'success': True,
            'text': text_lines,
            'count': len(text_lines),
            'saved_path': filepath if save_image else None,
            'file_size': file_size,
            'full_result': resp_json
        })
        
    except ValueError as e:
        # 文件大小超限等用户错误
        return jsonify({'error': str(e)}), 400
        
    except Exception as e:
        print(f'[OCR Error] {str(e)}')
        return jsonify({'error': f'OCR识别失败: {str(e)}'}), 500


@ocr_bp.route('/api/ocr/profile', methods=['POST'])
def recognize_profile():
    """
    专门用于识别游戏个人资料界面
    包含额外的字段解析逻辑
    """
    data = request.json
    image_base64 = data.get('image')
    
    if not image_base64:
        return jsonify({'error': '缺少图片数据'}), 400
    
    try:
        # 保存图片
        filepath, file_size = save_uploaded_image(image_base64, prefix='profile')
        print(f'[OCR Profile] 图片已保存: {filepath}, 大小: {file_size / 1024:.2f}KB')
        
        # 准备base64数据
        if ',' in image_base64:
            image_base64 = image_base64.split(',')[1]
        
        # 调用腾讯云OCR（使用高精度版本）
        client = get_ocr_client()
        req = models.GeneralAccurateOCRRequest()  # 高精度版本
        
        params = {
            "ImageBase64": image_base64,
            "LanguageType": "zh"
        }
        req.from_json_string(json.dumps(params))
        
        resp = client.GeneralAccurateOCR(req)
        resp_json = json.loads(resp.to_json_string())
        
        # 提取所有文本
        text_detections = resp_json.get('TextDetections', [])
        text_lines = [item['DetectedText'] for item in text_detections]
        
        # 合并成一个字符串用于匹配
        full_text = ' '.join(text_lines)
        print(f'[OCR Profile] 识别文本: {full_text}')
        
        # 解析字段
        parsed_data = parse_profile_fields(full_text)
        
        return jsonify({
            'success': True,
            'raw_text': text_lines,
            'parsed': parsed_data,
            'saved_path': filepath,
            'file_size': file_size,
            'full_result': resp_json
        })
        
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
        
    except Exception as e:
        print(f'[OCR Profile Error] {str(e)}')
        return jsonify({'error': f'OCR识别失败: {str(e)}'}), 500


@ocr_bp.route('/api/ocr/battle', methods=['POST'])
def recognize_battle():
    """
    专门用于识别战斗功勋界面
    返回识别的数字
    """
    data = request.json
    image_base64 = data.get('image')
    label = data.get('label', 'battle')  # 标签：助攻/控制等
    
    if not image_base64:
        return jsonify({'error': '缺少图片数据'}), 400
    
    try:
        # 保存图片
        filepath, file_size = save_uploaded_image(image_base64, prefix=f'battle_{label}')
        print(f'[OCR Battle] 图片已保存: {filepath}, 标签: {label}, 大小: {file_size / 1024:.2f}KB')
        
        # 准备base64数据
        if ',' in image_base64:
            image_base64 = image_base64.split(',')[1]
        
        # 调用腾讯云OCR
        client = get_ocr_client()
        req = models.GeneralBasicOCRRequest()
        
        params = {
            "ImageBase64": image_base64,
            "LanguageType": "zh"
        }
        req.from_json_string(json.dumps(params))
        
        resp = client.GeneralBasicOCR(req)
        resp_json = json.loads(resp.to_json_string())
        
        # 提取所有文本
        text_detections = resp_json.get('TextDetections', [])
        text_lines = [item['DetectedText'] for item in text_detections]
        full_text = ' '.join(text_lines)
        
        print(f'[OCR Battle] {label} 识别文本: {full_text}')
        
        # 提取数字
        numbers = re.findall(r'\d+', full_text)
        
        if numbers:
            # 通常取第一个数字，如果有多个数字，取最大的
            value = int(max(numbers, key=lambda x: int(x)))
        else:
            value = None
        
        return jsonify({
            'success': True,
            'value': value,
            'raw_text': text_lines,
            'label': label,
            'saved_path': filepath,
            'file_size': file_size
        })
        
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
        
    except Exception as e:
        print(f'[OCR Battle Error] {str(e)}')
        return jsonify({'error': f'OCR识别失败: {str(e)}'}), 500


def parse_profile_fields(text):
    """
    解析游戏资料字段
    返回字典包含识别到的字段
    """
    result = {}
    
    # 角色ID (通常是8-10位数字)
    role_id_match = re.search(r'(?:角色ID|ID)[:：\s]*(\d{8,})', text, re.IGNORECASE)
    if role_id_match:
        result['roleId'] = role_id_match.group(1)
    
    # 角色名（通常在"角色名"后面，非数字开头）
    role_name_match = re.search(r'角色名[:：\s]*([^\s\d][^\s]{0,15})', text)
    if role_name_match:
        result['roleName'] = role_name_match.group(1).strip()
    
    # 同盟名（在"同盟"后面）
    alliance_match = re.search(r'同盟[:：\s]*([^\s]{2,20})', text)
    if alliance_match:
        result['allianceName'] = alliance_match.group(1).strip()
    
    # 区服信息（例如：1区、101区）
    zone_match = re.search(r'(\d{1,3})区', text)
    if zone_match:
        result['zone'] = zone_match.group(1)
    
    # 服务器名称（例如：幽州、荆州）
    server_match = re.search(r'(\w+州|\w+郡|\w+服)', text)
    if server_match:
        result['serverInfo'] = server_match.group(1)
    
    # 队伍名
    team_match = re.search(r'队伍[:：\s]*([^\s]{2,20})', text)
    if team_match:
        result['teamName'] = team_match.group(1).strip()
    
    return result


@ocr_bp.route('/api/ocr/stats', methods=['GET'])
def get_ocr_stats():
    """
    获取OCR使用统计
    返回上传图片数量和总大小
    """
    try:
        if not os.path.exists(UPLOAD_FOLDER):
            return jsonify({
                'total_files': 0,
                'total_size': 0,
                'upload_folder': UPLOAD_FOLDER
            })
        
        files = os.listdir(UPLOAD_FOLDER)
        total_size = sum(os.path.getsize(os.path.join(UPLOAD_FOLDER, f)) for f in files if os.path.isfile(os.path.join(UPLOAD_FOLDER, f)))
        
        return jsonify({
            'total_files': len(files),
            'total_size': total_size,
            'total_size_mb': round(total_size / 1024 / 1024, 2),
            'upload_folder': UPLOAD_FOLDER
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@ocr_bp.route('/api/ocr/health', methods=['GET'])
def health_check():
    """
    健康检查接口
    """
    return jsonify({
        'status': 'ok',
        'service': 'tencent_cloud_ocr',
        'upload_folder': UPLOAD_FOLDER,
        'max_file_size_mb': MAX_FILE_SIZE / 1024 / 1024
    })
