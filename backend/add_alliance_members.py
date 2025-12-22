"""
Migration script to create alliance_members table and populate with existing alliance creators
"""
from app import app
from extensions import db
from models import Alliance, AllianceMember

def migrate():
    with app.app_context():
        # Create alliance_members table
        db.create_all()
        print("✓ Created alliance_members table")
        
        # Get all existing alliances
        alliances = Alliance.query.all()
        
        if not alliances:
            print("No existing alliances found")
            return
        
        # Add creators as members for existing alliances
        added_count = 0
        for alliance in alliances:
            # Check if creator is already a member
            existing = AllianceMember.query.filter_by(
                alliance_id=alliance.alliance_id,
                openid=alliance.creator_openid
            ).first()
            
            if not existing:
                member = AllianceMember(
                    alliance_id=alliance.alliance_id,
                    openid=alliance.creator_openid
                )
                db.session.add(member)
                added_count += 1
                print(f"✓ Added creator {alliance.creator_openid} as member of alliance {alliance.alliance_name}")
        
        if added_count > 0:
            db.session.commit()
            print(f"\n✓ Migration complete! Added {added_count} alliance members")
        else:
            print("\nNo new members to add - all creators are already members")

if __name__ == '__main__':
    migrate()
