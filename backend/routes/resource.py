from flask import Blueprint, request, jsonify
from extensions import db
from models import ResourcePoint
from utils.hex_math import hex_distance, get_nearest_points
from sqlalchemy import func

resource_bp = Blueprint('resource', __name__)

@resource_bp.route('/api/resource/seasons', methods=['GET'])
def get_seasons():
    # Get distinct seasons from ResourcePoint
    seasons = db.session.query(ResourcePoint.season).distinct().all()
    # seasons is a list of tuples [('S1',), ('S2',)]
    season_list = [s[0] for s in seasons]
    season_list.sort()
    return jsonify({'seasons': season_list})

@resource_bp.route('/api/resource/nearest', methods=['POST'])
def find_nearest_copper():
    data = request.json
    target_x = int(data.get('x', 0))
    target_y = int(data.get('y', 0))
    copper_type = data.get('type', '6铜') # e.g. "6铜", "7铜"
    season = data.get('season', 'S1')
    
    # 1. Determine County (所属郡)
    # Find the closest resource point (any type) to determine the county of the input coordinate
    # Optimization: Query a small box around the target first to find *any* point
    # If not found, expand search or just query all.
    # Since we need "Same County", we must know the county.
    
    # Try to find a point within 50 radius to guess county
    # Simple box query first for speed
    nearby_point = ResourcePoint.query.filter(
        ResourcePoint.season == season,
        ResourcePoint.x.between(target_x - 50, target_x + 50),
        ResourcePoint.y.between(target_y - 50, target_y + 50)
    ).first()
    
    county = None
    if nearby_point:
        county = nearby_point.county
    else:
        # Fallback: find the absolute nearest point in the whole DB
        # This might be slow if DB is huge, but for ~10k points it's fine to fetch all?
        # Better: Order by distance (approximate with SQL)
        # SQLite doesn't support sqrt easily, use simple abs sum
        closest = ResourcePoint.query.filter_by(season=season).order_by(
            func.abs(ResourcePoint.x - target_x) + func.abs(ResourcePoint.y - target_y)
        ).first()
        if closest:
            county = closest.county
            
    if not county:
        return jsonify({'error': '无法确定所属郡，请检查坐标是否在资源州内'}), 404
        
    # 2. Find nearest copper of specified type in that county
    candidates = ResourcePoint.query.filter_by(
        season=season, 
        county=county, 
        level=copper_type
    ).all()
    
    results = get_nearest_points(target_x, target_y, candidates, limit=40)
    
    response_data = []
    for dist, p in results:
        response_data.append({
            'id': p.id,
            'county': p.county,
            'level': p.level,
            'x': p.x,
            'y': p.y,
            'distance': int(dist)
        })
        
    return jsonify({
        'county': county,
        'points': response_data
    })

@resource_bp.route('/api/resource/relocate', methods=['POST'])
def recommend_relocation():
    data = request.json
    start_x = int(data.get('x', 0))
    start_y = int(data.get('y', 0))
    season = data.get('season', 'S1')
    
    # 1. Determine County
    nearby_point = ResourcePoint.query.filter(
        ResourcePoint.season == season,
        ResourcePoint.x.between(start_x - 50, start_x + 50),
        ResourcePoint.y.between(start_y - 50, start_y + 50)
    ).first()
    
    county = None
    if nearby_point:
        county = nearby_point.county
    else:
        closest = ResourcePoint.query.filter_by(season=season).order_by(
            func.abs(ResourcePoint.x - start_x) + func.abs(ResourcePoint.y - start_y)
        ).first()
        if closest:
            county = closest.county
            
    if not county:
        return jsonify({'error': '无法确定所属郡'}), 404

    # 2. Get all "8 Copper" (or higher?) in the county
    # Prompt says "8铜数量最多" (Most 8-Copper). Let's assume exactly "8铜" or maybe "8铜" and above?
    # Usually "8铜" means level 8.
    # Let's fetch all level 8 coppers.
    coppers = ResourcePoint.query.filter(
        ResourcePoint.season == season,
        ResourcePoint.county == county,
        ResourcePoint.level.like('%8铜%')
    ).all()
    
    if not coppers:
        return jsonify({'county': county, 'points': []})

    # 3. Heatmap Algorithm
    # We want to find a coordinate (cx, cy) within distance 20 of (start_x, start_y)
    # that maximizes count of coppers within 5 (primary) and 20 (secondary).
    
    # Instead of scanning all pixels, we scan the area around each copper.
    # A copper at (cx, cy) contributes to the score of any candidate point within range 20.
    
    # Candidate points must be within 20 of start.
    # We can use a dictionary to store scores for candidate points.
    # candidate_scores = { (x,y): {'score5': 0, 'score20': 0} }
    
    candidate_scores = {}
    
    # Optimization: Only consider coppers that are within 20 + 20 = 40 of start.
    # If a copper is further than 40, it cannot be within 20 of any point that is within 20 of start.
    relevant_coppers = []
    for c in coppers:
        dist_to_start = hex_distance(start_x, start_y, c.x, c.y)
        if dist_to_start <= 40:
            relevant_coppers.append(c)
            
    # Now, for each relevant copper, "splat" its influence onto the grid.
    # But the grid is continuous/large.
    # Iterating all points within 20 of a copper is expensive (radius 20 ~ 1200 points).
    # If we have 100 coppers, that's 120k operations. Feasible.
    
    # However, we only care about points that are valid candidates (dist to start <= 50).
    # So we can iterate candidate points?
    # Area 50 radius ~ 7500 points.
    # For each candidate point, check distance to all relevant coppers.
    # 7500 * (num_coppers). If num_coppers is small (<100), this is fast (750k ops).
    # Python might be slow for 1M ops in a web request.
    
    # Let's try the "Candidate Points" approach but optimized.
    # We only care about "peaks".
    # The optimal location is likely near a cluster of coppers.
    # So we can just check points "near" the coppers?
    # Or just scan the 50-radius area around start?
    
    # Let's scan the 20-radius area around start.
    # To generate points in a hex grid within radius N is complex.
    # Simple approach: Scan bounding box [start_x-20, start_x+20] x [start_y-20, start_y+20]
    # Check hex distance <= 20.
    
    candidates = []
    
    # Bounding box scan
    for dx in range(-20, 21):
        for dy in range(-20, 21):
            cx = start_x + dx
            cy = start_y + dy
            
            # Check map bounds (0-1500)
            if not (0 <= cx <= 1500 and 0 <= cy <= 1500):
                continue
                
            if hex_distance(start_x, start_y, cx, cy) <= 20:
                candidates.append((cx, cy))
                
    # Calculate scores
    # To optimize, pre-calculate copper coordinates
    copper_coords = [(c.x, c.y) for c in relevant_coppers]
    
    scored_candidates = []
    
    for cx, cy in candidates:
        score5 = 0
        score20 = 0
        
        for cop_x, cop_y in copper_coords:
            d = hex_distance(cx, cy, cop_x, cop_y)
            if d <= 5:
                score5 += 1
            if d <= 20:
                score20 += 1
                
        if score20 > 0: # Only keep interesting points
            dist_to_start = hex_distance(start_x, start_y, cx, cy)
            scored_candidates.append({
                'x': cx,
                'y': cy,
                'score5': score5,
                'score20': score20,
                'distance': int(dist_to_start)
            })
            
    # Sort: Primary score5 desc, Secondary score20 desc
    scored_candidates.sort(key=lambda item: (-item['score5'], -item['score20']))
    
    return jsonify({
        'county': county,
        'top_locations': scored_candidates[:40]
    })

@resource_bp.route('/api/resource', methods=['GET'])
def index():
    return "Resource Module"

