from flask import Blueprint

alliance_bp = Blueprint('alliance', __name__)

@alliance_bp.route('/api/alliance', methods=['GET'])
def index():
    return "Alliance Module"
