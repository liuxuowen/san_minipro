from flask import Blueprint, request, jsonify
import time
import datetime
import os
import uuid
from extensions import db
from models import BattleMerit

battle_bp = Blueprint('battle', __name__)

@battle_bp.route('/api/battle/submit', methods=['POST'])
def submit_battle_merit():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file part'}), 400
        
        file = request.files['file']
        merit = request.form.get('merit')
        openid = request.form.get('openid')
        image_create_time_str = request.form.get('image_create_time')
        file_md5 = request.form.get('md5')
        
        if not file or not merit or not openid:
            return jsonify({'error': 'Missing required fields'}), 400
            
        # Check for duplicate submission (same user, same file md5)
        if file_md5:
            existing = BattleMerit.query.filter_by(openid=openid, file_md5=file_md5).first()
            if existing:
                return jsonify({'error': 'Duplicate image submission', 'is_duplicate': True}), 409

        # Save file
        filename = str(uuid.uuid4()) + os.path.splitext(file.filename)[1]
        upload_folder = os.path.join('static', 'uploads', 'battle')
        if not os.path.exists(upload_folder):
            os.makedirs(upload_folder)
            
        filepath = os.path.join(upload_folder, filename)
        file.save(filepath)
        
        # Parse time
        image_create_time = None
        if image_create_time_str:
            try:
                # Expecting timestamp (seconds or milliseconds) or ISO string
                # If it's a timestamp number
                if image_create_time_str.isdigit():
                    ts = float(image_create_time_str)
                    # Check if ms
                    if ts > 10000000000: 
                        ts = ts / 1000
                    image_create_time = datetime.datetime.fromtimestamp(ts)
                else:
                    image_create_time = datetime.datetime.fromisoformat(image_create_time_str)
            except:
                image_create_time = datetime.datetime.now()
        
        # Save to DB
        record = BattleMerit(
            openid=openid,
            merit_value=int(merit),
            image_filename=filename,
            image_create_time=image_create_time,
            file_md5=file_md5
        )
        db.session.add(record)
        db.session.commit()
        
        return jsonify({'success': True, 'id': record.id})
        
    except Exception as e:
        print(f"Submit Error: {e}")
        return jsonify({'error': str(e)}), 500

@battle_bp.route('/api/battle', methods=['GET'])
def index():
    return "Battle Module"
