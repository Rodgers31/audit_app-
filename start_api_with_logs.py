#!/usr/bin/env python3
"""
ENHANCED API STARTUP SCRIPT WITH LOGGING
=======================================

This script starts all APIs with enhanced logging and monitoring.
Shows detailed logs for debugging endpoint issues.
"""

import os
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path


def start_api_with_logging(api_config, project_root):
    """Start an API and display its logs in real-time"""
    script_path = project_root / api_config["directory"] / api_config["script"]
    working_dir = project_root / api_config["directory"]

    print(f"\n🚀 Starting {api_config['name']}...")
    print(f"📂 Directory: {working_dir}")
    print(f"📜 Script: {api_config['script']}")
    print(f"🌐 URL: {api_config['url']}")
    print("=" * 60)

    try:
        # Start the process with real-time output
        process = subprocess.Popen(
            [sys.executable, api_config["script"]],
            cwd=working_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,  # Merge stderr with stdout
            text=True,
            bufsize=1,
            universal_newlines=True,
        )

        print(f"✅ {api_config['name']} started (PID: {process.pid})")
        print("📝 Live logs (press Ctrl+C to stop):")
        print("-" * 60)

        # Read and display output in real-time
        while True:
            output = process.stdout.readline()
            if output == "" and process.poll() is not None:
                break
            if output:
                # Add timestamp and color coding
                timestamp = datetime.now().strftime("%H:%M:%S")
                if "ERROR" in output or "❌" in output:
                    print(f"[{timestamp}] 🔴 {output.strip()}")
                elif "WARNING" in output or "⚠️" in output:
                    print(f"[{timestamp}] 🟡 {output.strip()}")
                elif "INFO" in output or "✅" in output:
                    print(f"[{timestamp}] 🟢 {output.strip()}")
                else:
                    print(f"[{timestamp}] ⚪ {output.strip()}")

        # Check if process ended unexpectedly
        if process.poll() is not None:
            print(f"\n❌ {api_config['name']} stopped unexpectedly!")
            print(f"Exit code: {process.returncode}")
            return False

        return True

    except KeyboardInterrupt:
        print(f"\n🛑 Stopping {api_config['name']}...")
        process.terminate()
        return False
    except Exception as e:
        print(f"❌ Failed to start {api_config['name']}: {e}")
        return False


def main():
    """Main function to start APIs one by one with logging"""
    project_root = Path(__file__).parent.absolute()

    apis = [
        {
            "name": "Enhanced County Analytics API",
            "script": "enhanced_county_analytics_api.py",
            "directory": "apis",
            "port": 8003,
            "url": "http://localhost:8003",
        },
        {
            "name": "Modernized Data-Driven API",
            "script": "modernized_api.py",
            "directory": "apis",
            "port": 8004,
            "url": "http://localhost:8004",
        },
        {
            "name": "Main Backend API",
            "script": "main.py",
            "directory": "backend",
            "port": 8000,
            "url": "http://localhost:8000",
        },
    ]

    print("🔧 ENHANCED KENYA AUDIT API LAUNCHER WITH LOGGING")
    print("=" * 55)
    print(f"📍 Project Root: {project_root}")
    print(f"🐍 Python: {sys.executable}")
    print(f"⏰ Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    # Ask user which API to start
    print("\nSelect API to start (with detailed logging):")
    for i, api in enumerate(apis, 1):
        print(f"{i}. {api['name']} ({api['url']})")
    print("4. Start all APIs (basic mode)")

    try:
        choice = input("\nEnter choice (1-4): ").strip()

        if choice in ["1", "2", "3"]:
            selected_api = apis[int(choice) - 1]
            print(f"\n🎯 Starting {selected_api['name']} with detailed logging...")
            start_api_with_logging(selected_api, project_root)

        elif choice == "4":
            print("\n🚀 Starting all APIs in basic mode...")
            # Use the original start_all_apis script
            subprocess.run([sys.executable, "start_all_apis.py"], cwd=project_root)

        else:
            print("❌ Invalid choice. Exiting.")

    except KeyboardInterrupt:
        print("\n🛑 Interrupted by user")
    except Exception as e:
        print(f"❌ Error: {e}")


if __name__ == "__main__":
    main()
