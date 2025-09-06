import json
import sys

from fastapi.testclient import TestClient

try:
    # Support running from repo root or backend folder
    sys.path.append(".")
    sys.path.append("backend")
    from main import app
except Exception as e:
    print(f"IMPORT_FAIL: {e}")
    sys.exit(2)

client = TestClient(app)

failures = []

# Test root endpoint
r = client.get("/")
if r.status_code != 200:
    failures.append(f"/ status {r.status_code}")
else:
    data = r.json()
    if not isinstance(data, dict):
        failures.append("/ not JSON object")

# Test counties list (should fallback even if enhanced API is down)
r = client.get("/api/v1/counties")
if r.status_code != 200:
    failures.append(f"/api/v1/counties status {r.status_code}")
else:
    data = r.json()
    if not isinstance(data, list) or len(data) == 0:
        failures.append("/api/v1/counties empty or wrong type")

if failures:
    print("SMOKE_TEST: FAIL")
    for f in failures:
        print(" -", f)
    sys.exit(1)
else:
    print("SMOKE_TEST: PASS")
    sys.exit(0)
