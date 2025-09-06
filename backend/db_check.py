import os
from dotenv import load_dotenv
from sqlalchemy import text
from database import engine

load_dotenv()

def main():
    try:
        with engine.connect() as conn:
            res = conn.execute(text("SELECT now()"))
            print("DB connected. Current time:", res.scalar())
    except Exception as e:
        print("DB connection failed:", e)

if __name__ == "__main__":
    main()
