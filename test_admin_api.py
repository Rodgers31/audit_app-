"""Test admin API endpoints for ingestion jobs."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "backend"))

import requests

BASE_URL = "http://localhost:8000"


def test_admin_endpoints():
    """Test all admin API endpoints."""
    print("=" * 60)
    print("Testing Admin API - Ingestion Jobs")
    print("=" * 60)

    # Test 1: List ingestion jobs
    print("\n1. List all ingestion jobs (last 7 days):")
    response = requests.get(f"{BASE_URL}/api/v1/admin/ingestion-jobs")
    if response.status_code == 200:
        data = response.json()
        print(f"   ✓ Found {data['total']} jobs")
        print(f"   Page {data['page']}/{data['page_size']} items per page")
        print(f"   Has more: {data['has_more']}")
        if data["jobs"]:
            print("\n   Recent jobs:")
            for job in data["jobs"][:3]:
                duration = (
                    f"{job['duration_seconds']:.1f}s"
                    if job["duration_seconds"]
                    else "N/A"
                )
                print(
                    f"   - #{job['id']}: {job['domain']} - {job['status']} "
                    f"({job['items_processed']} processed, {job['items_created']} created) "
                    f"Duration: {duration}"
                )
    else:
        print(f"   ✗ Failed: {response.status_code} - {response.text}")

    # Test 2: Filter by domain
    print("\n2. Filter jobs by domain (counties_budget):")
    response = requests.get(
        f"{BASE_URL}/api/v1/admin/ingestion-jobs", params={"domain": "counties_budget"}
    )
    if response.status_code == 200:
        data = response.json()
        print(f"   ✓ Found {data['total']} counties_budget jobs")
    else:
        print(f"   ✗ Failed: {response.status_code}")

    # Test 3: Filter by status
    print("\n3. Filter jobs by status (completed):")
    response = requests.get(
        f"{BASE_URL}/api/v1/admin/ingestion-jobs", params={"status": "completed"}
    )
    if response.status_code == 200:
        data = response.json()
        print(f"   ✓ Found {data['total']} completed jobs")
    else:
        print(f"   ✗ Failed: {response.status_code}")

    # Test 4: Get specific job details
    print("\n4. Get details for latest job:")
    response = requests.get(f"{BASE_URL}/api/v1/admin/ingestion-jobs")
    if response.status_code == 200:
        jobs = response.json()["jobs"]
        if jobs:
            job_id = jobs[0]["id"]
            response = requests.get(f"{BASE_URL}/api/v1/admin/ingestion-jobs/{job_id}")
            if response.status_code == 200:
                job = response.json()
                print(f"   ✓ Job #{job['id']} details:")
                print(f"     Domain: {job['domain']}")
                print(f"     Status: {job['status']}")
                print(f"     Dry run: {job['dry_run']}")
                print(f"     Started: {job['started_at']}")
                print(f"     Finished: {job['finished_at']}")
                print(f"     Processed: {job['items_processed']}")
                print(f"     Created: {job['items_created']}")
                print(f"     Updated: {job['items_updated']}")
                if job["errors"]:
                    print(f"     Errors: {len(job['errors'])} error(s)")
                if job["metadata"]:
                    print(f"     Metadata: {job['metadata']}")
            else:
                print(f"   ✗ Failed to get job details: {response.status_code}")
        else:
            print("   ✓ No jobs found yet")
    else:
        print(f"   ✗ Failed: {response.status_code}")

    # Test 5: Get statistics
    print("\n5. Get ingestion statistics (last 30 days):")
    response = requests.get(f"{BASE_URL}/api/v1/admin/ingestion-jobs/stats/summary")
    if response.status_code == 200:
        stats = response.json()
        print(f"   ✓ Statistics:")
        print(f"     Total jobs: {stats['total_jobs']}")
        print(f"     Completed: {stats['completed']}")
        print(f"     Failed: {stats['failed']}")
        print(f"     Running: {stats['running']}")
        print(f"     Pending: {stats['pending']}")
        print(f"     With errors: {stats['completed_with_errors']}")
        print(f"     Total processed: {stats['total_items_processed']}")
        print(f"     Total created: {stats['total_items_created']}")
        print(f"     Total updated: {stats['total_items_updated']}")
        if stats["domains"]:
            print("     By domain:")
            for domain, count in stats["domains"].items():
                print(f"       - {domain}: {count} job(s)")
    else:
        print(f"   ✗ Failed: {response.status_code} - {response.text}")

    # Test 6: Pagination
    print("\n6. Test pagination (page_size=2):")
    response = requests.get(
        f"{BASE_URL}/api/v1/admin/ingestion-jobs", params={"page_size": 2, "page": 1}
    )
    if response.status_code == 200:
        data = response.json()
        print(f"   ✓ Page 1: {len(data['jobs'])} jobs")
        print(f"     Has more: {data['has_more']}")
    else:
        print(f"   ✗ Failed: {response.status_code}")

    # Test 7: Date range filter
    print("\n7. Filter by date range (last 1 day):")
    response = requests.get(
        f"{BASE_URL}/api/v1/admin/ingestion-jobs", params={"days": 1}
    )
    if response.status_code == 200:
        data = response.json()
        print(f"   ✓ Found {data['total']} jobs in last 24 hours")
    else:
        print(f"   ✗ Failed: {response.status_code}")

    print("\n" + "=" * 60)
    print("Testing complete!")
    print("=" * 60)


if __name__ == "__main__":
    try:
        test_admin_endpoints()
    except requests.exceptions.ConnectionError:
        print("Error: Could not connect to backend API at http://localhost:8000")
        print(
            "Make sure the backend is running with: python -m uvicorn main:app --reload"
        )
    except Exception as e:
        print(f"Error: {e}")
        import traceback

        traceback.print_exc()
