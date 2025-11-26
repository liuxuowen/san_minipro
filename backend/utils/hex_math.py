import math

def hex_distance(x1, y1, x2, y2):
    """
    Calculate distance between two points in a hexagonal grid (Offset Coordinates).
    Assuming "Odd-r" horizontal layout (common in games like RoK, etc.) or similar.
    However, for standard "Three Kingdoms Tactics" (San Guo Zhi Zhan Lue Ban),
    the map is often treated as a simple grid for distance, or a specific offset.
    
    Let's use the standard cubic conversion for offset coordinates.
    We will assume "Odd-Y" (odd rows shifted right) or "Even-Y".
    
    Actually, a robust way for many of these games is:
    dy = abs(y1 - y2)
    dx = abs(x1 - x2)
    dist = dx + max(0, (dy - dx) // 2)  <-- This is for one specific type.
    
    Let's try to be generic.
    Convert offset (col, row) to cube (x, y, z).
    
    For "Odd-R" (shoves odd rows right):
    x = col - (row - (row&1)) / 2
    z = row
    y = -x - z
    
    For "Even-R" (shoves even rows right):
    x = col - (row + (row&1)) / 2
    z = row
    y = -x - z
    
    Since we don't know the exact system, we will use a standard Euclidean approximation 
    for large distances, but for "game distance", we need to be precise.
    
    Let's assume the standard "Axial" system where distance is:
    (abs(x1 - x2) + abs(y1 - y2) + abs(x1 + y1 - x2 - y2)) / 2
    BUT this applies to axial coordinates.
    
    If the input X,Y are from the game map (Offset), we need to convert.
    Let's assume "Odd-R" (common).
    """
    # Convert Odd-R offset to cube
    q1 = x1 - (y1 - (y1 & 1)) / 2
    r1 = y1
    
    q2 = x2 - (y2 - (y2 & 1)) / 2
    r2 = y2
    
    return (abs(q1 - q2) + abs(r1 - r2) + abs(q1 + r1 - q2 - r2)) / 2

def get_nearest_points(target_x, target_y, points, limit=10):
    """
    points: list of dict or objects with 'x' and 'y' attributes
    """
    # Calculate distances
    with_dist = []
    for p in points:
        # Handle both dict and object
        px = p.get('x') if isinstance(p, dict) else p.x
        py = p.get('y') if isinstance(p, dict) else p.y
        
        dist = hex_distance(target_x, target_y, px, py)
        with_dist.append((dist, p))
    
    # Sort by distance
    with_dist.sort(key=lambda x: x[0])
    
    return with_dist[:limit]
