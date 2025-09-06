#!/usr/bin/env python3
"""
API DIAGNOSTIC SCRIPT
====================

This script tests each API individually to diagnose startup issues.
"""

import os
import subprocess
import sys
import time
from pathlib import Path


def test_api(name, script_path, working_dir):
    """Test a single API and capture any errors"""
    print(f"\n🔍 Testing {name}")
    print("=" * 50)
    print(f"📂 Working Directory: {working_dir}")
    print(f"📜 Script: {script_path}")

    try:
        # Test if the script runs without errors
        result = subprocess.run(
            [sys.executable, script_path],
            cwd=working_dir,
            capture_output=True,
            text=True,
            timeout=10,  # Give it 10 seconds to start
        )

        print(f"🔧 Return Code: {result.returncode}")

        if result.stdout:
            print(f"📝 STDOUT:")
            print(result.stdout)

        if result.stderr:
            print(f"❌ STDERR:")
            print(result.stderr)

        if result.returncode != 0:
            print(f"❌ {name} failed to start properly")
            return False
        else:
            print(f"✅ {name} started successfully (but timed out after 10s)")
            return True

    except subprocess.TimeoutExpired:
        print(f"⏰ {name} is running (timed out after 10s - this is expected)")
        return True
    except FileNotFoundError:
        print(f"❌ Script not found: {script_path}")
        return False
    except Exception as e:
        print(f"❌ Error testing {name}: {e}")
        return False


def check_dependencies():
    """Check if required Python packages are installed"""
    print("🔍 Checking Python Dependencies")
    print("=" * 40)

    required_packages = [
        "fastapi",
        "uvicorn",
        "pandas",
        "requests",
        "sqlalchemy",
        "pydantic",
    ]

    missing_packages = []

    for package in required_packages:
        try:
            __import__(package)
            print(f"✅ {package}")
        except ImportError:
            print(f"❌ {package} - MISSING")
            missing_packages.append(package)

    if missing_packages:
        print(f"\n❌ Missing packages: {', '.join(missing_packages)}")
        print("Install with: pip install " + " ".join(missing_packages))
        return False
    else:
        print("✅ All dependencies found")
        return True


def check_data_files():
    """Check if required data files exist"""
    print("\n🔍 Checking Required Data Files")
    print("=" * 40)

    project_root = Path(__file__).parent.absolute()
    required_files = [
        "data/county/enhanced_county_data.json",
        "data/county/ultimate_etl_results.json",
        "data/government/national_debt_data.json",
        "data/government/national_ministries_data.json",
    ]

    missing_files = []

    for file_path in required_files:
        full_path = project_root / file_path
        if full_path.exists():
            print(f"✅ {file_path}")
        else:
            print(f"❌ {file_path} - MISSING")
            missing_files.append(file_path)

    if missing_files:
        print(f"\n❌ Missing data files: {len(missing_files)}")
        return False
    else:
        print("✅ All data files found")
        return True


def main():
    """Main diagnostic function"""
    print("🔧 KENYA AUDIT API DIAGNOSTIC TOOL")
    print("=" * 50)

    project_root = Path(__file__).parent.absolute()
    print(f"📍 Project Root: {project_root}")
    print(f"🐍 Python: {sys.executable}")

    # Check dependencies
    deps_ok = check_dependencies()

    # Check data files
    data_ok = check_data_files()

    if not deps_ok or not data_ok:
        print("\n❌ Prerequisites not met. Fix issues above before testing APIs.")
        return

    # Test each API
    apis = [
        {
            "name": "Enhanced County Analytics API",
            "script": "enhanced_county_analytics_api.py",
            "directory": "apis",
        },
        {
            "name": "Modernized Data-Driven API",
            "script": "modernized_api.py",
            "directory": "apis",
        },
        {"name": "Main Backend API", "script": "main.py", "directory": "backend"},
    ]

    results = []
    for api in apis:
        script_path = api["script"]
        working_dir = project_root / api["directory"]

        if not working_dir.exists():
            print(f"❌ Directory not found: {working_dir}")
            results.append(False)
            continue

        if not (working_dir / script_path).exists():
            print(f"❌ Script not found: {working_dir / script_path}")
            results.append(False)
            continue

        success = test_api(api["name"], script_path, working_dir)
        results.append(success)

    # Summary
    print("\n📊 DIAGNOSTIC SUMMARY")
    print("=" * 30)

    for i, api in enumerate(apis):
        status = "✅ PASS" if results[i] else "❌ FAIL"
        print(f"{status} {api['name']}")

    success_count = sum(results)
    total_count = len(results)

    if success_count == total_count:
        print(f"\n🎉 All {total_count} APIs passed diagnostics!")
        print("The startup issues might be due to port conflicts or timing.")
        print("Try running the APIs one at a time to isolate the issue.")
    else:
        print(f"\n❌ {total_count - success_count} APIs failed diagnostics")
        print("Fix the issues above before attempting to start all APIs.")


if __name__ == "__main__":
    main()
