from __future__ import annotations

import asyncio

try:
    from .database_loader import DatabaseLoader  # type: ignore
except Exception:
    from etl.database_loader import DatabaseLoader  # type: ignore


MINISTRIES = [
    "Ministry of Interior and National Administration",
    "Ministry of Defence",
    "Ministry of Foreign and Diaspora Affairs",
    "National Treasury and Economic Planning",
    "Ministry of Education",
    "Ministry of Health",
    "Ministry of Agriculture and Livestock Development",
    "Ministry of Roads and Transport",
    "Ministry of Energy and Petroleum",
    "Ministry of Water, Sanitation and Irrigation",
    "Ministry of Environment, Climate Change and Forestry",
    "Ministry of Lands, Public Works, Housing and Urban Development",
    "Ministry of Information, Communications and the Digital Economy",
    "Ministry of Labour and Social Protection",
    "Ministry of Tourism and Wildlife",
    "Ministry of Youth Affairs, Sports and The Arts",
    "Ministry of East African Community, ASALs and Regional Development",
    "Ministry of Mining, Blue Economy and Maritime Affairs",
    "Ministry of Co-operatives and Micro, Small and Medium Enterprises (MSMEs)",
    "Ministry of Public Service, Gender and Affirmative Action",
    "The State Department for Correctional Services",
]


async def main():
    loader = DatabaseLoader()
    country_id = await loader.ensure_country_exists("KEN")
    for name in MINISTRIES:
        await loader.ensure_entity_exists(
            {"canonical_name": name, "type": "ministry", "confidence": 1.0},
            country_id,
        )


if __name__ == "__main__":
    asyncio.run(main())
