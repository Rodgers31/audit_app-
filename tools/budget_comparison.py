#!/usr/bin/env python3
"""
Compare realistic vs fake county budget data
"""

import json


def compare_budget_data():
    # Load realistic data
    with open("official_county_budget_data.json", "r") as f:
        official_data = json.load(f)

    # Load current fake data
    with open("enhanced_county_data.json", "r") as f:
        fake_data = json.load(f)

    realistic = official_data["realistic_county_estimates"]
    fake = fake_data["county_data"]

    print("REALISTIC vs FAKE COUNTY BUDGET COMPARISON")
    print("=" * 60)

    print(f"\nTOTAL BUDGETS:")
    print(f'Realistic: KES {official_data["total_estimated_budget"]/1e9:.1f} billion')
    print(
        f'Current (fake): KES {sum(county["budget_2025"] for county in fake.values())/1e9:.1f} billion'
    )

    print(f"\nTOP 10 REALISTIC BUDGETS (Based on 2019 Census):")
    sorted_realistic = sorted(
        realistic.items(), key=lambda x: x[1]["budget_2025_estimate"], reverse=True
    )

    for i, (county, data) in enumerate(sorted_realistic[:10]):
        budget_b = data["budget_2025_estimate"] / 1e9
        population = data["population"]
        factor = data["economic_factor"]

        # Compare with fake data
        fake_budget = fake.get(county, {}).get("budget_2025", 0) / 1e9

        print(
            f"{i+1:2d}. {county:<15} Realistic: KES {budget_b:5.1f}B | Fake: KES {fake_budget:5.1f}B | Pop: {population:7,}"
        )

    print(f"\nMAJOR DISCREPANCIES:")
    print(f"Nairobi Population:")
    print(f'  Realistic: {realistic["Nairobi"]["population"]:,} people')
    print(f'  Fake: {fake["Nairobi"]["population"]:,} people')
    print(
        f'  Difference: {realistic["Nairobi"]["population"] - fake["Nairobi"]["population"]:,} people!'
    )

    print(f"\nNairobi Budget:")
    print(f'  Realistic: KES {realistic["Nairobi"]["budget_2025_estimate"]/1e9:.1f}B')
    print(f'  Fake: KES {fake["Nairobi"]["budget_2025"]/1e9:.1f}B')

    print(f"\nMombasa Budget:")
    print(f'  Realistic: KES {realistic["Mombasa"]["budget_2025_estimate"]/1e9:.1f}B')
    print(f'  Fake: KES {fake["Mombasa"]["budget_2025"]/1e9:.1f}B')


if __name__ == "__main__":
    compare_budget_data()
