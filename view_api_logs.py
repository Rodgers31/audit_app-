#!/usr/bin/env python3
"""
API LOG VIEWER
==============

Utility to view and monitor API logs in real-time.
Shows endpoint calls, errors, and performance metrics.
"""

import os
import threading
import time
from datetime import datetime
from pathlib import Path


def tail_log_file(file_path, label):
    """Tail a log file and display new lines"""
    if not os.path.exists(file_path):
        print(f"📁 {label}: Log file not found - {file_path}")
        return

    print(f"📊 Monitoring {label}: {file_path}")

    with open(file_path, "r") as file:
        # Go to end of file
        file.seek(0, 2)

        while True:
            line = file.readline()
            if line:
                timestamp = datetime.now().strftime("%H:%M:%S")
                # Color code based on log level
                if "ERROR" in line:
                    print(f"[{timestamp}] 🔴 {label}: {line.strip()}")
                elif "WARNING" in line:
                    print(f"[{timestamp}] 🟡 {label}: {line.strip()}")
                elif "INFO" in line:
                    print(f"[{timestamp}] 🟢 {label}: {line.strip()}")
                else:
                    print(f"[{timestamp}] ⚪ {label}: {line.strip()}")
            else:
                time.sleep(0.1)


def main():
    """Main function to monitor all API logs"""
    project_root = Path(__file__).parent.absolute()

    log_files = [
        {"path": project_root / "apis" / "enhanced_api.log", "label": "Enhanced API"},
        {
            "path": project_root / "apis" / "modernized_api.log",
            "label": "Modernized API",
        },
        {
            "path": project_root / "backend" / "main_backend.log",
            "label": "Main Backend",
        },
    ]

    print("📈 API LOG MONITOR")
    print("=" * 30)
    print(f"📍 Project Root: {project_root}")
    print(f"⏰ Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("\n🔍 Monitoring log files (press Ctrl+C to stop):")

    # Start monitoring threads
    threads = []
    for log_config in log_files:
        thread = threading.Thread(
            target=tail_log_file,
            args=(log_config["path"], log_config["label"]),
            daemon=True,
        )
        thread.start()
        threads.append(thread)

    try:
        # Keep main thread alive
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n🛑 Log monitoring stopped")


if __name__ == "__main__":
    main()
