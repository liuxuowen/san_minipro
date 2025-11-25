from flask import Blueprint, request, jsonify, current_app, send_from_directory
from extensions import db
from models import UploadRecord, AllianceData
from utils.image_generator import ImageGenerator
import os
from datetime import datetime
import re
import csv

alliance_bp = Blueprint('alliance', __name__)

@alliance_bp.route('/api/alliance/uploads', methods=['GET'])
def get_uploads():
    uploads = UploadRecord.query.order_by(UploadRecord.upload_time.desc()).all()
    return jsonify({
        'uploads': [u.to_dict() for u in uploads]
    })

def parse_int(value):
    """Helper to parse integer from string, handling empty or invalid values."""
    if not value:
        return 0
    try:
        # Remove commas if present (e.g. "1,234")
        if isinstance(value, str):
            value = value.replace(',', '')
        return int(float(value))
    except (ValueError, TypeError):
        return 0

@alliance_bp.route('/api/alliance/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'success': False, 'message': 'No file part'})
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'message': 'No selected file'})

    # 获取前端传递的原始文件名（包含时间信息）
    original_filename = request.form.get('filename', file.filename)

    # 尝试从文件名解析时间戳
    # 格式示例：同盟统计2025年01月25日13时30分12秒.csv
    # 正则匹配：(\d{4})年(\d{1,2})月(\d{1,2})日(\d{1,2})时(\d{1,2})分(\d{1,2})秒
    stats_time = None
    match = re.search(r'(\d{4})年(\d{1,2})月(\d{1,2})日(\d{1,2})时(\d{1,2})分(\d{1,2})秒', original_filename)
    if match:
        try:
            stats_time = datetime(
                int(match.group(1)),
                int(match.group(2)),
                int(match.group(3)),
                int(match.group(4)),
                int(match.group(5)),
                int(match.group(6))
            )
        except ValueError:
            pass

    # 去重逻辑：
    # 1. 如果解析出了 stats_time，则检查数据库中是否存在相同 stats_time 的记录
    # 2. 如果没有解析出 stats_time，则退化为检查 filename
    existing_record = None
    if stats_time:
        existing_record = UploadRecord.query.filter_by(stats_time=stats_time).first()
    else:
        existing_record = UploadRecord.query.filter_by(filename=original_filename).first()

    if existing_record:
        return jsonify({'success': True, 'message': 'File already exists (duplicate timestamp), skipped.', 'skipped': True})
    
    if file:
        # 保存文件
        upload_folder = current_app.config['UPLOAD_FOLDER']
        if not os.path.exists(upload_folder):
            os.makedirs(upload_folder)
            
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        safe_filename = f"{timestamp}_{original_filename}"
        file_path = os.path.join(upload_folder, safe_filename)
        file.save(file_path)
        
        member_count = 0
        data_objects = []
        
        # 尝试不同的编码读取 CSV
        encodings = ['utf-8-sig', 'gb18030', 'utf-8']
        csv_content = None
        used_encoding = None
        
        for enc in encodings:
            try:
                with open(file_path, 'r', encoding=enc) as f:
                    # 尝试读取第一行来验证编码
                    f.readline()
                    used_encoding = enc
                break
            except UnicodeDecodeError:
                continue
        
        if not used_encoding:
            return jsonify({'success': False, 'message': 'Failed to decode file. Unknown encoding.'})

        try:
            with open(file_path, 'r', encoding=used_encoding) as f:
                reader = csv.DictReader(f)
                
                # 映射 CSV 列名到数据库字段
                # 假设 CSV 列名包含：排名, 成员, 贡献, 势力值, 战功, 攻占, 攻城, 拆除
                # 实际列名可能略有不同，这里做简单匹配
                
                first_row = True
                for row in reader:
                    # 清理 key 中的空白字符
                    clean_row = {k.strip(): v for k, v in row.items() if k}
                    
                    if first_row:
                        print(f"CSV Headers detected: {list(clean_row.keys())}")
                        print(f"First row sample: {clean_row}")
                        first_row = False

                    # 查找对应的列值
                    def get_val(keys):
                        for k in keys:
                            if k in clean_row:
                                return clean_row[k]
                        return None

                    name = get_val(['成员', '名字', 'Name'])
                    if not name:
                        continue # 跳过没有名字的行

                    member_count += 1
                    
                    data = AllianceData(
                        rank=parse_int(get_val(['排名', 'Rank', '贡献排行'])),
                        name=name,
                        group_name=get_val(['分组', 'Group']) or '未分组',
                        contribution=parse_int(get_val(['贡献', 'Contribution', '贡献总量'])),
                        power=parse_int(get_val(['势力值', '势力', 'Power'])),
                        battle_achievement=parse_int(get_val(['战功', 'Battle', '战功总量'])),
                        assist=parse_int(get_val(['助攻', 'Assist', '助攻总量'])),
                        donation=parse_int(get_val(['捐献', 'Donation', '捐献总量']))
                    )
                    data_objects.append(data)

        except Exception as e:
            print(f"Error parsing CSV: {e}")
            return jsonify({'success': False, 'message': f'Error parsing CSV: {str(e)}'})

        # 保存记录到数据库
        try:
            # 1. 创建上传记录
            record = UploadRecord(
                filename=original_filename,
                member_count=member_count,
                stats_time=stats_time
            )
            db.session.add(record)
            db.session.flush() # 获取 record.id
            
            # 2. 关联 upload_id 并批量保存详情数据
            for obj in data_objects:
                obj.upload_id = record.id
            
            db.session.bulk_save_objects(data_objects)
            db.session.commit()
            
            return jsonify({'success': True, 'message': 'Upload successful', 'count': member_count})
            
        except Exception as e:
            db.session.rollback()
            print(f"Database error: {e}")
            return jsonify({'success': False, 'message': 'Database error'})

    return jsonify({'success': False, 'message': 'Upload failed'})


@alliance_bp.route('/api/alliance/delete', methods=['POST'])
def delete_upload():
    data = request.get_json()
    upload_id = data.get('upload_id')
    
    if not upload_id:
        return jsonify({'success': False, 'message': 'Missing upload_id'})
        
    record = UploadRecord.query.get(upload_id)
    if record:
        db.session.delete(record)
        db.session.commit()
        return jsonify({'success': True})
    
    return jsonify({'success': False, 'message': 'Record not found'})


@alliance_bp.route('/api/alliance/compare', methods=['POST'])
def compare_uploads():
    data = request.get_json()
    upload_id_1 = data.get('upload_id_1')
    upload_id_2 = data.get('upload_id_2')
    metric = data.get('metric', 'battle') # battle, power, contribution

    if not upload_id_1 or not upload_id_2:
        return jsonify({'success': False, 'message': 'Missing upload IDs'})

    record1 = UploadRecord.query.get(upload_id_1)
    record2 = UploadRecord.query.get(upload_id_2)

    if not record1 or not record2:
        return jsonify({'success': False, 'message': 'Upload record not found'})

    # Determine order by stats_time or upload_time
    t1 = record1.stats_time or record1.upload_time
    t2 = record2.stats_time or record2.upload_time

    if t1 > t2:
        early_record, late_record = record2, record1
        early_ts, late_ts = t2, t1
    else:
        early_record, late_record = record1, record2
        early_ts, late_ts = t1, t2

    # Fetch data
    early_data = AllianceData.query.filter_by(upload_id=early_record.id).all()
    late_data = AllianceData.query.filter_by(upload_id=late_record.id).all()

    print(f"Comparing Upload {early_record.id} ({len(early_data)}) vs {late_record.id} ({len(late_data)})")
    if early_data:
        print(f"Sample Early: {early_data[0].name} - Battle: {early_data[0].battle_achievement}")
    if late_data:
        print(f"Sample Late: {late_data[0].name} - Battle: {late_data[0].battle_achievement}")

    # Helper to get metric value
    def get_metric_value(item, metric_name):
        if metric_name == 'battle':
            return item.battle_achievement
        elif metric_name == 'power':
            return item.power
        elif metric_name == 'contribution':
            return item.contribution
        elif metric_name == 'assist':
            return item.assist
        elif metric_name == 'donation':
            return item.donation
        return 0

    # Build dicts
    early_map = {item.name: {'val': get_metric_value(item, metric), 'group': item.group_name} for item in early_data}
    
    results = []
    
    # Compare
    for item in late_data:
        name = item.name
        late_val = get_metric_value(item, metric)
        late_group = item.group_name
        
        if name in early_map:
            early_val = early_map[name]['val']
            diff = late_val - early_val
            # Use late group if available, else early group
            group = late_group if late_group != '未分组' else early_map[name]['group']
            
            results.append({
                'name': name,
                'group': group,
                'diff': diff,
                'early_val': early_val,
                'late_val': late_val
            })
    
    # Sort by group then diff descending
    results.sort(key=lambda x: (x['group'], -x['diff']))

    # Generate Images
    try:
        resource_dir = os.path.join(current_app.root_path, 'resources')
        output_dir = os.path.join(current_app.root_path, 'static', 'generated')
        generator = ImageGenerator(resource_dir)
        
        metric_label = {
            'battle': '战功',
            'power': '势力值',
            'contribution': '贡献',
            'assist': '助攻',
            'donation': '捐献'
        }.get(metric, metric)
        
        image_paths = generator.generate_comparison_images(
            results, 
            early_ts.strftime('%Y-%m-%d %H:%M'), 
            late_ts.strftime('%Y-%m-%d %H:%M'), 
            metric_label, 
            output_dir
        )
        
        # Add image URLs to response
        base_url = request.host_url.rstrip('/')
        images = []
        for img in image_paths:
            img_url = f"{base_url}/api/alliance/images/{img['filename']}"
            images.append({
                'group': img['group'],
                'url': img_url
            })
    except Exception as e:
        print(f"Image generation failed: {e}")
        images = []

    return jsonify({
        'success': True,
        'results': results,
        'early_ts': early_ts.strftime('%Y-%m-%d %H:%M'),
        'late_ts': late_ts.strftime('%Y-%m-%d %H:%M'),
        'metric': metric,
        'images': images
    })


@alliance_bp.route('/api/alliance/images/<filename>')
def get_image(filename):
    output_dir = os.path.join(current_app.root_path, 'static', 'generated')
    return send_from_directory(output_dir, filename)

