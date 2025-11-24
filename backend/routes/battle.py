from flask import Blueprint

battle_bp = Blueprint('battle', __name__)

@battle_bp.route('/api/battle', methods=['GET'])
def index():
    return "Battle Module"
