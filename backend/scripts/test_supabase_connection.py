import os
from urllib.parse import parse_qsl, quote_plus, urlencode, urlparse

import psycopg2
from dotenv import load_dotenv


def build_conn_str() -> str:
    """Prefer DATABASE_URL; otherwise build from DB_* vars for Transaction Pooler.

    Ensures sslmode=require and URL-encodes the password.
    """
    load_dotenv()  # load .env in repo/backends

    url = os.getenv("DATABASE_URL")
    if url:
        # Ensure sslmode=require is present
        parsed = urlparse(url)
        query = dict(parse_qsl(parsed.query))
        if query.get("sslmode") is None:
            query["sslmode"] = "require"
        query_str = urlencode(query)
        return parsed._replace(query=query_str).geturl()

    user = os.getenv("DB_USER")
    password = os.getenv("DB_PASSWORD", "")
    host = os.getenv("DB_HOST")
    port = os.getenv("DB_PORT", "6543")
    name = os.getenv("DB_NAME", "postgres")
    sslmode = os.getenv("DB_SSLMODE", "require")

    if user and host:
        pwd = quote_plus(password) if password else ""
        auth = f"{user}:{pwd}@"
        return f"postgresql://{auth}{host}:{port}/{name}?sslmode={sslmode}"

    # Fallback (local dev)
    return "postgresql://postgres:password@localhost:5432/audit_app"


def main():
    conn_str = build_conn_str()
    print("Connecting with:")
    try:
        redacted = conn_str.replace(parsed_password(conn_str) or "", "***")
        print(redacted)
    except Exception:
        print(conn_str)

    try:
        conn = psycopg2.connect(
            conn_str, connect_timeout=10, options="-c statement_timeout=5000"
        )
        print("Connection successful!")
        cur = conn.cursor()
        cur.execute(
            "select version(), inet_server_addr(), inet_server_port(), current_user;"
        )
        row = cur.fetchone()
        print("Server:", row[0])
        print("Host:", row[1], "Port:", row[2], "User:", row[3])
        cur.execute("select now();")
        print("Current Time:", cur.fetchone()[0])
        cur.close()
        conn.close()
        print("Connection closed.")
    except Exception as e:
        print(f"Failed to connect: {e}")


def parsed_password(url: str) -> str | None:
    p = urlparse(url)
    if p.password:
        return p.password
    return None


if __name__ == "__main__":
    main()
