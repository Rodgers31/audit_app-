#!/usr/bin/env python3
"""
Data Quality Analysis for County Budget Data
"""

import json


def analyze_data_quality():
    print("COUNTY BUDGET DATA QUALITY ANALYSIS")
    print("=" * 50)

    with open("enhanced_county_data.json", "r") as f:
        data = json.load(f)

    print("\n🚨 MAJOR RED FLAGS IDENTIFIED:")
    print("-" * 30)

    # Check for unrealistic budgets
    high_budget_counties = []
    for county, info in data["county_data"].items():
        budget_billions = info["budget_2025"] / 1e9
        if budget_billions > 15:  # Unrealistically high
            high_budget_counties.append((county, budget_billions))

    print(f"1. UNREALISTIC BUDGETS:")
    for county, budget in high_budget_counties:
        print(f"   {county}: KES {budget:.1f}B (TOO HIGH)")

    # Check for population issues
    print(f"\n2. POPULATION DISCREPANCIES:")
    nairobi_pop = data["county_data"]["Nairobi"]["population"]
    print(f"   Nairobi shows: {nairobi_pop:,} people")
    print(f"   Reality: ~4,400,000 people (4.4x higher!)")

    # Check for uniform patterns
    print(f"\n3. SUSPICIOUS UNIFORM PATTERNS:")
    per_capita_3000 = sum(
        1
        for info in data["county_data"].values()
        if info["per_capita_budget"] == 3000.0
    )
    execution_75 = sum(
        1
        for info in data["county_data"].values()
        if info["budget_execution_rate"] == 75.0
    )

    print(f"   Counties with exactly KES 3,000 per capita: {per_capita_3000}/47")
    print(f"   Counties with exactly 75% execution rate: {execution_75}/47")
    print(f"   This suggests algorithmic generation, not real data")

    print(f"\n📊 REALISTIC EXPECTATIONS:")
    print("-" * 25)
    print(f"• Nairobi (capital): KES 40-50 billion")
    print(f"• Mombasa (port city): KES 15-20 billion")
    print(f"• Large counties: KES 8-15 billion")
    print(f"• Medium counties: KES 5-8 billion")
    print(f"• Small counties: KES 3-5 billion")

    print(f"\n🔍 DATA SOURCE VERIFICATION:")
    print("-" * 28)
    sources = data.get("data_sources", {})
    print(f"• Authentic APIs found: {len(sources.get('open_county_apis', {}))}")
    print(f"• Fallback sources: {sources.get('fallback_sources', [])}")
    print(f"• Issue: No verified government budget documents linked")

    print(f"\n💡 CONCLUSION:")
    print("-" * 12)
    print("This appears to be largely SYNTHETIC/PLACEHOLDER data")
    print("Real county budget data needs to be sourced from:")
    print("• Controller of Budget (COB) official reports")
    print("• National Treasury county allocation documents")
    print("• Individual county budget documents")
    print("• Kenya Open Data portal (opendata.go.ke)")


if __name__ == "__main__":
    analyze_data_quality()
