import os
import sys

from fastapi.testclient import TestClient

ROOT = os.path.dirname(__file__)
ROOT = os.path.abspath(os.path.join(ROOT, ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from backend.main import app

client = TestClient(app)

for path in [
    "/api/v1/counties",
    "/api/v1/counties/001",
    "/api/v1/counties/001/financial",
    "/api/v1/counties/001/audits",
    "/",
]:
    resp = client.get(path)
    print(path, resp.status_code)
    try:
        print(resp.json())
    except Exception:
        print(resp.text)
    print("---")
