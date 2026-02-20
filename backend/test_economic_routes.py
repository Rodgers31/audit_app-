"""Test script to verify economic router registration."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

try:
    from main import app

    print("✅ Backend imported successfully")

    # Check registered routes
    routes = [r.path for r in app.routes if hasattr(r, "path")]
    econ_routes = [r for r in routes if "economic" in r]

    print(f"\n📊 Found {len(econ_routes)} economic routes:")
    for route in sorted(econ_routes):
        print(f"  {route}")

    if len(econ_routes) > 0:
        print("\n✅ Economic router registered successfully!")
    else:
        print("\n⚠️ No economic routes found")

except Exception as e:
    print(f"❌ Error: {e}")
    import traceback

    traceback.print_exc()
