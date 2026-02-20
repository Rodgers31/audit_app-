"""
Test database connection with Supabase
"""

import os
import sys

import psycopg2
from dotenv import load_dotenv

# Load environment variables
load_dotenv("backend/.env")

DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_SSLMODE = os.getenv("DB_SSLMODE", "require")

print(f"Testing connection to: {DB_USER}@{DB_HOST}:{DB_PORT}/{DB_NAME}")
print("-" * 80)

# Test 1: Transaction Pooler (port 6543)
print("\n[Test 1] Transaction Pooler (port 6543)...")
try:
    conn = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        sslmode=DB_SSLMODE,
        connect_timeout=10,
    )
    print("✅ Transaction Pooler connection successful!")

    cursor = conn.cursor()
    cursor.execute("SELECT version();")
    version = cursor.fetchone()
    print(f"PostgreSQL version: {version[0][:80]}")

    # Check if tables exist
    cursor.execute(
        """
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name 
        LIMIT 10;
    """
    )
    tables = cursor.fetchall()
    print(f"\nExisting tables ({len(tables)}):")
    for table in tables:
        print(f"  - {table[0]}")

    cursor.close()
    conn.close()
    sys.exit(0)

except Exception as e:
    print(f"❌ Transaction Pooler failed: {e}")

# Test 2: Session Pooler (port 5432)
print("\n[Test 2] Session Pooler (port 5432)...")
try:
    # Remove '.pooler' from hostname for direct connection
    session_host = DB_HOST.replace(".pooler.", ".")

    conn = psycopg2.connect(
        host=session_host,
        port="5432",
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        sslmode=DB_SSLMODE,
        connect_timeout=10,
    )
    print("✅ Session Pooler connection successful!")
    print(f"Connected to: {session_host}:5432")

    cursor = conn.cursor()
    cursor.execute("SELECT version();")
    version = cursor.fetchone()
    print(f"PostgreSQL version: {version[0][:80]}")

    # Check if tables exist
    cursor.execute(
        """
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name 
        LIMIT 10;
    """
    )
    tables = cursor.fetchall()
    print(f"\nExisting tables ({len(tables)}):")
    for table in tables:
        print(f"  - {table[0]}")

    cursor.close()
    conn.close()
    sys.exit(0)

except Exception as e:
    print(f"❌ Session Pooler also failed: {e}")

# Test 3: Direct connection without pooler
print("\n[Test 3] Direct connection...")
try:
    direct_host = DB_HOST.replace(".pooler", "").replace(
        ".supabase.com", ".supabase.co"
    )

    conn = psycopg2.connect(
        host=direct_host,
        port="5432",
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        sslmode=DB_SSLMODE,
        connect_timeout=10,
    )
    print("✅ Direct connection successful!")
    print(f"Connected to: {direct_host}:5432")

    conn.close()
    sys.exit(0)

except Exception as e:
    print(f"❌ Direct connection failed: {e}")

print("\n" + "=" * 80)
print("All connection attempts failed.")
print("Possible issues:")
print("  1. Supabase project may be paused or deleted")
print("  2. Credentials may have expired")
print("  3. IP address may be blocked (check Supabase firewall)")
print("  4. Network connectivity issues")
print("\nRecommendation: Use local PostgreSQL via Docker")
print("=" * 80)
sys.exit(1)
