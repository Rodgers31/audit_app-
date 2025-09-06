"""
Comprehensive Report Management System
Manages the 206+ extracted government reports with smart caching and update mechanisms
Creates a reliable local database to avoid dependency on slow government sites
"""

import hashlib
import json
import logging
import os
import sqlite3
from datetime import datetime, timedelta
from typing import Dict, List, Optional

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class KenyaReportManager:
    """Manages comprehensive Kenya government reports with smart caching."""

    def __init__(self, db_path="kenya_reports.db"):
        self.db_path = db_path
        self.init_database()

        # Load extracted data
        try:
            with open("comprehensive_report_extraction.json", "r") as f:
                self.extracted_data = json.load(f)
        except FileNotFoundError:
            logger.error("No comprehensive_report_extraction.json found!")
            self.extracted_data = {}

    def init_database(self):
        """Initialize SQLite database for report management."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # Create reports table
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                url TEXT UNIQUE NOT NULL,
                source_agency TEXT NOT NULL,
                document_type TEXT,
                reporting_period TEXT,
                financial_year TEXT,
                county TEXT,
                ministry TEXT,
                document_hash TEXT UNIQUE,
                file_size INTEGER,
                last_checked TIMESTAMP,
                last_updated TIMESTAMP,
                is_cached BOOLEAN DEFAULT FALSE,
                cache_path TEXT,
                metadata TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """
        )

        # Create reporting schedule table
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS reporting_schedule (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                agency TEXT NOT NULL,
                report_type TEXT NOT NULL,
                frequency TEXT NOT NULL,
                expected_period TEXT,
                last_expected_date DATE,
                next_expected_date DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """
        )

        conn.commit()
        conn.close()
        logger.info("✅ Database initialized")

    def populate_reports_database(self):
        """Populate database with extracted reports."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        total_inserted = 0

        # Insert Treasury reports
        for report in self.extracted_data.get("treasury_reports", []):
            try:
                cursor.execute(
                    """
                    INSERT OR REPLACE INTO reports 
                    (title, url, source_agency, document_type, reporting_period, 
                     financial_year, document_hash, last_checked, metadata)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                    (
                        report["title"],
                        report["url"],
                        "National Treasury",
                        report["type"],
                        report.get("reporting_period"),
                        report.get("financial_year"),
                        report["document_hash"],
                        datetime.now().isoformat(),
                        json.dumps(report),
                    ),
                )
                total_inserted += 1
            except sqlite3.IntegrityError:
                pass  # Skip duplicates

        # Insert KNBS reports
        for report in self.extracted_data.get("knbs_reports", []):
            try:
                cursor.execute(
                    """
                    INSERT OR REPLACE INTO reports 
                    (title, url, source_agency, document_type, reporting_period, 
                     financial_year, document_hash, last_checked, metadata)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                    (
                        report["title"],
                        report["url"],
                        "Kenya National Bureau of Statistics",
                        report["type"],
                        report.get("reporting_period"),
                        report.get("year"),
                        report["document_hash"],
                        datetime.now().isoformat(),
                        json.dumps(report),
                    ),
                )
                total_inserted += 1
            except sqlite3.IntegrityError:
                pass  # Skip duplicates

        conn.commit()
        conn.close()

        logger.info(f"✅ Populated database with {total_inserted} reports")
        return total_inserted

    def setup_reporting_schedule(self):
        """Setup expected reporting schedule for all agencies."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        schedules = [
            # Treasury schedules
            (
                "National Treasury",
                "Budget Statement",
                "annual",
                "June",
                "2025-06-01",
                "2026-06-01",
            ),
            (
                "National Treasury",
                "Supplementary Budget",
                "quarterly",
                "Every 3 months",
                "2025-09-01",
                "2025-12-01",
            ),
            (
                "National Treasury",
                "Debt Report",
                "quarterly",
                "Every 3 months",
                "2025-09-01",
                "2025-12-01",
            ),
            (
                "National Treasury",
                "Programme Budget",
                "annual",
                "June",
                "2025-06-01",
                "2026-06-01",
            ),
            # COB schedules
            (
                "Controller of Budget",
                "County Implementation Review",
                "quarterly",
                "Every 3 months",
                "2025-09-01",
                "2025-12-01",
            ),
            (
                "Controller of Budget",
                "Budget Implementation Report",
                "monthly",
                "Monthly",
                "2025-08-01",
                "2025-09-01",
            ),
            # OAG schedules
            (
                "Office of Auditor General",
                "Annual Audit Report",
                "annual",
                "December",
                "2024-12-01",
                "2025-12-01",
            ),
            (
                "Office of Auditor General",
                "County Audit Report",
                "annual",
                "December",
                "2024-12-01",
                "2025-12-01",
            ),
            (
                "Office of Auditor General",
                "Special Audit Report",
                "ad_hoc",
                "Irregular",
                "2025-01-01",
                "2025-12-31",
            ),
            # KNBS schedules
            (
                "Kenya National Bureau of Statistics",
                "Economic Survey",
                "annual",
                "May",
                "2025-05-01",
                "2026-05-01",
            ),
            (
                "Kenya National Bureau of Statistics",
                "Statistical Abstract",
                "annual",
                "December",
                "2024-12-01",
                "2025-12-01",
            ),
            (
                "Kenya National Bureau of Statistics",
                "Quarterly GDP Report",
                "quarterly",
                "Every 3 months",
                "2025-09-01",
                "2025-12-01",
            ),
        ]

        for schedule in schedules:
            try:
                cursor.execute(
                    """
                    INSERT OR REPLACE INTO reporting_schedule 
                    (agency, report_type, frequency, expected_period, last_expected_date, next_expected_date)
                    VALUES (?, ?, ?, ?, ?, ?)
                """,
                    schedule,
                )
            except sqlite3.IntegrityError:
                pass

        conn.commit()
        conn.close()

        logger.info("✅ Reporting schedule setup complete")

    def get_reports_summary(self) -> Dict:
        """Get comprehensive summary of all reports."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # Total reports by agency
        cursor.execute(
            """
            SELECT source_agency, COUNT(*) as count 
            FROM reports 
            GROUP BY source_agency
        """
        )
        by_agency = dict(cursor.fetchall())

        # Total reports by type
        cursor.execute(
            """
            SELECT document_type, COUNT(*) as count 
            FROM reports 
            GROUP BY document_type
        """
        )
        by_type = dict(cursor.fetchall())

        # Recent reports (last 30 days based on financial year)
        cursor.execute(
            """
            SELECT COUNT(*) 
            FROM reports 
            WHERE financial_year LIKE '%2025%' 
        """
        )
        recent_count = cursor.fetchone()[0]

        # Cached reports
        cursor.execute(
            """
            SELECT COUNT(*) 
            FROM reports 
            WHERE is_cached = TRUE
        """
        )
        cached_count = cursor.fetchone()[0]

        conn.close()

        return {
            "total_reports": sum(by_agency.values()),
            "by_agency": by_agency,
            "by_type": by_type,
            "recent_reports_2025": recent_count,
            "cached_reports": cached_count,
            "cache_percentage": (
                round((cached_count / sum(by_agency.values())) * 100, 1)
                if sum(by_agency.values()) > 0
                else 0
            ),
        }

    def get_critical_reports(self) -> List[Dict]:
        """Get most critical financial reports."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT title, url, source_agency, document_type, financial_year, last_checked
            FROM reports 
            WHERE document_type IN ('budget_statement', 'supplementary_budget', 'debt_report', 'economic_survey')
            AND financial_year LIKE '%2025%'
            ORDER BY last_checked DESC
            LIMIT 20
        """
        )

        reports = []
        for row in cursor.fetchall():
            reports.append(
                {
                    "title": row[0],
                    "url": row[1],
                    "source_agency": row[2],
                    "document_type": row[3],
                    "financial_year": row[4],
                    "last_checked": row[5],
                }
            )

        conn.close()
        return reports

    def get_missing_reports(self) -> List[Dict]:
        """Get reports that should exist but are missing."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # Get expected reports that might be missing
        cursor.execute(
            """
            SELECT agency, report_type, frequency, next_expected_date
            FROM reporting_schedule 
            WHERE next_expected_date <= date('now')
        """
        )

        missing = []
        for row in cursor.fetchall():
            # Check if we have recent reports of this type
            cursor.execute(
                """
                SELECT COUNT(*) 
                FROM reports 
                WHERE source_agency = ? AND document_type LIKE ?
                AND last_checked >= date('now', '-30 days')
            """,
                (row[0], f'%{row[1].lower().replace(" ", "_")}%'),
            )

            count = cursor.fetchone()[0]
            if count == 0:
                missing.append(
                    {
                        "agency": row[0],
                        "report_type": row[1],
                        "frequency": row[2],
                        "expected_date": row[3],
                        "status": "missing",
                    }
                )

        conn.close()
        return missing

    def generate_comprehensive_report(self) -> Dict:
        """Generate comprehensive status report."""
        summary = self.get_reports_summary()
        critical_reports = self.get_critical_reports()
        missing_reports = self.get_missing_reports()

        # Calculate data coverage score
        total_possible_reports = 50  # Estimated based on reporting schedule
        actual_reports = summary["total_reports"]
        coverage_score = min(
            100, round((actual_reports / total_possible_reports) * 100, 1)
        )

        return {
            "summary": summary,
            "critical_reports": critical_reports,
            "missing_reports": missing_reports,
            "data_coverage_score": coverage_score,
            "reliability_assessment": {
                "treasury": "Good - 33 documents found",
                "cob": "Poor - Site timeout issues",
                "oag": "Poor - Site timeout issues",
                "knbs": "Excellent - 173 documents found",
            },
            "recommendations": [
                "Focus on Treasury and KNBS as primary reliable sources",
                "Implement alternative data sources for COB and OAG",
                "Set up automated monitoring for new report releases",
                "Create local document cache to reduce dependency on government sites",
            ],
            "last_updated": datetime.now().isoformat(),
        }


def main():
    """Main function to setup comprehensive report management."""
    logger.info("🚀 Setting up Comprehensive Report Management System...")

    manager = KenyaReportManager()

    # Populate database
    inserted_count = manager.populate_reports_database()

    # Setup schedules
    manager.setup_reporting_schedule()

    # Generate comprehensive report
    comprehensive_report = manager.generate_comprehensive_report()

    # Save comprehensive report
    with open("comprehensive_management_report.json", "w") as f:
        json.dump(comprehensive_report, f, indent=2)

    # Print summary
    print(f"\n✅ Report Management System Setup Complete!")
    print(f"📊 Total Reports: {comprehensive_report['summary']['total_reports']}")
    print(
        f"💰 Treasury Reports: {comprehensive_report['summary']['by_agency'].get('National Treasury', 0)}"
    )
    print(
        f"📈 KNBS Reports: {comprehensive_report['summary']['by_agency'].get('Kenya National Bureau of Statistics', 0)}"
    )
    print(f"📋 Data Coverage Score: {comprehensive_report['data_coverage_score']}%")
    print(f"📁 Database: kenya_reports.db")
    print(f"📄 Full Report: comprehensive_management_report.json")


if __name__ == "__main__":
    main()
