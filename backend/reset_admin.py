import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
from auth import hash_password

load_dotenv()

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "3306")
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "attendance_db")

DATABASE_URL = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
engine = create_engine(DATABASE_URL)

new_hash = hash_password("admin123")

with engine.connect() as conn:
    conn.execute(text("UPDATE users SET password_hash = :hp, plain_password = :pp WHERE username = 'admin';"), 
                 {"hp": new_hash, "pp": "admin123"})
    conn.commit()
    print("Admin password reset to admin123 successfully.")
