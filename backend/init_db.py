import os
import csv
from extensions import db
from models import User, UploadRecord, ResourcePoint

def init_db_data(app):
    with app.app_context():
        print("Initializing database...")
        db.create_all()
        
        # Load maps
        maps_dir = os.path.join(app.root_path, 'maps')
        if os.path.exists(maps_dir):
            for filename in os.listdir(maps_dir):
                if filename.endswith('.csv'):
                    season = os.path.splitext(filename)[0]
                    
                    # Check if data exists
                    if ResourcePoint.query.filter_by(season=season).first():
                        print(f"INFO: Data for {season} already exists. Skipping.")
                        continue
                        
                    print(f"INFO: Loading data for {season}...")
                    file_path = os.path.join(maps_dir, filename)
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            # Check if file has header
                            sample = f.read(1024)
                            f.seek(0)
                            has_header = csv.Sniffer().has_header(sample)
                            
                            if has_header:
                                reader = csv.DictReader(f)
                                points = []
                                for row in reader:
                                    # Handle potential BOM or whitespace in keys
                                    clean_row = {k.strip().replace('\ufeff', ''): v for k, v in row.items() if k}
                                    
                                    try:
                                        point = ResourcePoint(
                                            season=season,
                                            county=clean_row.get('所属郡'),
                                            level=clean_row.get('等级'),
                                            x=int(clean_row.get('X')),
                                            y=int(clean_row.get('Y'))
                                        )
                                        points.append(point)
                                    except (ValueError, TypeError) as e:
                                        print(f"WARNING: Skipping invalid row in {filename}: {row} - {e}")
                                        continue
                                    
                                    # Batch commit every 1000 records
                                    if len(points) >= 1000:
                                        db.session.bulk_save_objects(points)
                                        db.session.commit()
                                        points = []
                                        
                                if points:
                                    db.session.bulk_save_objects(points)
                                    db.session.commit()
                                    
                            print(f"INFO: Loaded {season} successfully.")
                    except Exception as e:
                        print(f"ERROR: Failed to load {season}: {e}")
                        db.session.rollback()
        
        print("Database initialized successfully!")

if __name__ == '__main__':
    from app import app
    init_db_data(app)
