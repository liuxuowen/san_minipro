import sqlite3
import os
from app import app, db
from sqlalchemy import text

def update_schema():
    print("Starting database schema update...")
    
    with app.app_context():
        # 1. Update battle_merits table
        try:
            # Check if column exists
            with db.engine.connect() as conn:
                # Try to select the column to see if it exists
                try:
                    conn.execute(text("SELECT file_md5 FROM battle_merits LIMIT 1"))
                    print("Column 'file_md5' already exists in 'battle_merits'.")
                except Exception:
                    print("Adding 'file_md5' column to 'battle_merits'...")
                    conn.execute(text("ALTER TABLE battle_merits ADD COLUMN file_md5 VARCHAR(32)"))
                    conn.commit()
                    print("Success.")
        except Exception as e:
            print(f"Error updating battle_merits: {e}")

        # 2. Update users table
        new_columns = [
            ('role_name', 'VARCHAR(64)'),
            ('role_id', 'VARCHAR(64)'),
            ('server_info', 'VARCHAR(64)'),
            ('zone', 'VARCHAR(64)'),
            ('team_name', 'VARCHAR(64)')
        ]

        for col_name, col_type in new_columns:
            try:
                with db.engine.connect() as conn:
                    try:
                        conn.execute(text(f"SELECT {col_name} FROM users LIMIT 1"))
                        print(f"Column '{col_name}' already exists in 'users'.")
                    except Exception:
                        print(f"Adding '{col_name}' column to 'users'...")
                        conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"))
                        conn.commit()
                        print("Success.")
            except Exception as e:
                print(f"Error updating users table for column {col_name}: {e}")

    print("Database schema update completed.")

if __name__ == '__main__':
    update_schema()
