from flask import Blueprint

resource_bp = Blueprint('resource', __name__)

@resource_bp.route('/api/resource', methods=['GET'])
def index():
    return "Resource Module"
