#!/usr/bin/env python3
"""
Project Cleanup and Organization Tool
Organizes files into proper folders and removes unnecessary duplicates
"""

import json
import os
import shutil
from pathlib import Path


class ProjectOrganizer:
    def __init__(self):
        self.base_path = Path(".")
        self.created_folders = []
        self.moved_files = []
        self.deleted_files = []

    def create_folder_structure(self):
        """Create organized folder structure."""
        print("📁 CREATING ORGANIZED FOLDER STRUCTURE")
        print("=" * 42)

        folders_to_create = [
            "data/",
            "data/county/",
            "data/government/",
            "data/audit/",
            "data/cob/",
            "data/backups/",
            "extractors/",
            "extractors/cob/",
            "extractors/county/",
            "extractors/government/",
            "apis/",
            "tools/",
            "analysis/",
            "docs/",
        ]

        for folder in folders_to_create:
            folder_path = self.base_path / folder
            if not folder_path.exists():
                folder_path.mkdir(parents=True, exist_ok=True)
                self.created_folders.append(folder)
                print(f"✅ Created: {folder}")
            else:
                print(f"📁 Exists: {folder}")

    def organize_data_files(self):
        """Organize JSON data files into appropriate folders."""
        print("\n📊 ORGANIZING DATA FILES")
        print("=" * 25)

        data_file_mappings = {
            # County data
            "data/county/": [
                "enhanced_county_data.json",
                "enhanced_county_data_REALISTIC.json",
                "official_county_budget_data.json",
            ],
            # Government reports
            "data/government/": [
                "comprehensive_government_reports.json",
                "ultimate_etl_results.json",
                "comprehensive_etl_results.json",
                "data_driven_analytics_results.json",
            ],
            # Audit data
            "data/audit/": ["oag_audit_data.json"],
            # COB data
            "data/cob/": [
                "comprehensive_cob_reports_database.json",
                "cob_budget_implementation_data.json",
                "ultra_patient_cob_reports.json",
                "selenium_cob_reports.json",
                "enhanced_cob_extraction_results.json",
                "live_cob_extraction_results.json",
                "cob_pdf_extraction.json",
            ],
            # Backups and originals
            "data/backups/": [
                "enhanced_county_data_FAKE_BACKUP.json",
                "ultimate_etl_results_ORIGINAL.json",
            ],
        }

        for target_folder, files in data_file_mappings.items():
            for filename in files:
                if os.path.exists(filename):
                    target_path = target_folder + filename
                    shutil.move(filename, target_path)
                    self.moved_files.append(f"{filename} -> {target_path}")
                    print(f"📦 Moved: {filename} -> {target_path}")

    def organize_extractors(self):
        """Organize extractor scripts."""
        print("\n🔧 ORGANIZING EXTRACTORS")
        print("=" * 24)

        extractor_mappings = {
            "extractors/cob/": [
                "ultra_patient_cob_extractor.py",
                "selenium_cob_extractor.py",
                "robust_cob_extractor.py",
                "live_cob_extractor.py",
                "enhanced_cob_extractor.py",
                "cob_report_extractor.py",
                "advanced_cob_dropdown_extractor.py",
            ],
            "extractors/county/": [
                "enhanced_county_extractor.py",
                "official_county_budget_extractor.py",
            ],
            "extractors/government/": [
                "comprehensive_government_extractor.py",
                "comprehensive_report_extractor.py",
                "oag_audit_extractor.py",
            ],
        }

        for target_folder, files in extractor_mappings.items():
            for filename in files:
                if os.path.exists(filename):
                    target_path = target_folder + filename
                    shutil.move(filename, target_path)
                    self.moved_files.append(f"{filename} -> {target_path}")
                    print(f"🔧 Moved: {filename} -> {target_path}")

    def organize_apis(self):
        """Organize API files."""
        print("\n🌐 ORGANIZING APIs")
        print("=" * 17)

        api_files = [
            "enhanced_county_analytics_api.py",
            "county_analytics_api.py",
            "modernized_api.py",
        ]

        for filename in api_files:
            if os.path.exists(filename):
                target_path = f"apis/{filename}"
                shutil.move(filename, target_path)
                self.moved_files.append(f"{filename} -> {target_path}")
                print(f"🌐 Moved: {filename} -> {target_path}")

    def organize_tools_and_analysis(self):
        """Organize analysis and utility tools."""
        print("\n🛠️ ORGANIZING TOOLS & ANALYSIS")
        print("=" * 30)

        tool_mappings = {
            "tools/": [
                "fix_etl_results.py",
                "real_county_data_replacer.py",
                "budget_comparison.py",
                "data_quality_scanner.py",
                "data_quality_analysis.py",
                "show_corrected_data.py",
                "alternative_sources.py",
            ],
            "analysis/": [
                "county_data_analyzer.py",
                "data_driven_analytics.py",
                "DATA_CORRECTION_SUMMARY.py",
                "ARCHITECTURE_IMPROVEMENTS_SUMMARY.py",
            ],
        }

        for target_folder, files in tool_mappings.items():
            for filename in files:
                if os.path.exists(filename):
                    target_path = target_folder + filename
                    shutil.move(filename, target_path)
                    self.moved_files.append(f"{filename} -> {target_path}")
                    print(f"🛠️ Moved: {filename} -> {target_path}")

    def organize_documentation(self):
        """Organize documentation files."""
        print("\n📚 ORGANIZING DOCUMENTATION")
        print("=" * 27)

        doc_files = ["COUNTY_API_README.md", "DATA_SOURCES_COVERAGE.md"]

        for filename in doc_files:
            if os.path.exists(filename):
                target_path = f"docs/{filename}"
                shutil.move(filename, target_path)
                self.moved_files.append(f"{filename} -> {target_path}")
                print(f"📚 Moved: {filename} -> {target_path}")

    def cleanup_unnecessary_files(self):
        """Remove unnecessary duplicate or test files."""
        print("\n🗑️ CLEANING UP UNNECESSARY FILES")
        print("=" * 33)

        # Files to delete (duplicates, test files, etc.)
        files_to_delete = [
            "advanced_cob_dropdown_reports.json",  # Duplicate
            "comprehensive_report_extraction.json",  # Duplicate
            "comprehensive_management_report.json",  # Duplicate
            "etl_test_results.json",  # Test file
            "data_driven_config.json",  # Config file, probably empty
        ]

        for filename in files_to_delete:
            if os.path.exists(filename):
                os.remove(filename)
                self.deleted_files.append(filename)
                print(f"🗑️ Deleted: {filename}")

    def update_imports_in_moved_files(self):
        """Update import statements in moved files to reflect new structure."""
        print("\n🔄 UPDATING IMPORT STATEMENTS")
        print("=" * 29)

        # This would require parsing Python files and updating imports
        # For now, we'll just note which files might need updates
        files_needing_updates = [
            "apis/enhanced_county_analytics_api.py",
            "apis/modernized_api.py",
            "analysis/data_driven_analytics.py",
        ]

        print("⚠️ Files that may need import updates:")
        for filename in files_needing_updates:
            if os.path.exists(filename):
                print(f"   📝 {filename}")

    def generate_organization_summary(self):
        """Generate a summary of the organization changes."""
        print("\n📋 ORGANIZATION SUMMARY")
        print("=" * 23)

        print(f"📁 Folders created: {len(self.created_folders)}")
        for folder in self.created_folders:
            print(f"   + {folder}")

        print(f"\n📦 Files moved: {len(self.moved_files)}")
        for move in self.moved_files:
            print(f"   📦 {move}")

        print(f"\n🗑️ Files deleted: {len(self.deleted_files)}")
        for deleted in self.deleted_files:
            print(f"   🗑️ {deleted}")

        # Create a new structure overview
        print(f"\n🏗️ NEW PROJECT STRUCTURE:")
        print("📁 audit_app/")
        print("├── 📁 data/")
        print("│   ├── 📁 county/           # County budget and demographic data")
        print("│   ├── 📁 government/       # Government reports and ETL results")
        print("│   ├── 📁 audit/           # Audit findings and OAG data")
        print("│   ├── 📁 cob/             # Controller of Budget reports")
        print("│   └── 📁 backups/         # Backup copies of old data")
        print("├── 📁 extractors/")
        print("│   ├── 📁 cob/             # COB data extractors")
        print("│   ├── 📁 county/          # County data extractors")
        print("│   └── 📁 government/      # Government report extractors")
        print("├── 📁 apis/                # FastAPI applications")
        print("├── 📁 tools/               # Utility and cleanup tools")
        print("├── 📁 analysis/            # Data analysis scripts")
        print("├── 📁 docs/                # Documentation")
        print("├── 📁 frontend/            # Next.js frontend (existing)")
        print("├── 📁 backend/             # FastAPI backend (existing)")
        print("└── 📁 etl/                 # ETL pipeline (existing)")

    def run_full_organization(self):
        """Run complete project organization."""
        print("🚀 STARTING PROJECT ORGANIZATION")
        print("=" * 37)

        self.create_folder_structure()
        self.organize_data_files()
        self.organize_extractors()
        self.organize_apis()
        self.organize_tools_and_analysis()
        self.organize_documentation()
        self.cleanup_unnecessary_files()
        self.update_imports_in_moved_files()
        self.generate_organization_summary()

        print("\n✅ PROJECT ORGANIZATION COMPLETE!")


if __name__ == "__main__":
    organizer = ProjectOrganizer()
    organizer.run_full_organization()
