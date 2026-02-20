from __future__ import annotations

import asyncio

try:
    from .database_loader import DatabaseLoader  # type: ignore
except Exception:
    from etl.database_loader import DatabaseLoader  # type: ignore


COUNTIES = [
    "Mombasa",
    "Kwale",
    "Kilifi",
    "Tana River",
    "Lamu",
    "Taita Taveta",
    "Garissa",
    "Wajir",
    "Mandera",
    "Marsabit",
    "Isiolo",
    "Meru",
    "Tharaka Nithi",
    "Embu",
    "Kitui",
    "Machakos",
    "Makueni",
    "Nyandarua",
    "Nyeri",
    "Kirinyaga",
    "Murang'a",
    "Kiambu",
    "Turkana",
    "West Pokot",
    "Samburu",
    "Trans Nzoia",
    "Uasin Gishu",
    "Elgeyo Marakwet",
    "Nandi",
    "Baringo",
    "Laikipia",
    "Nakuru",
    "Narok",
    "Kajiado",
    "Kericho",
    "Bomet",
    "Kakamega",
    "Vihiga",
    "Bungoma",
    "Busia",
    "Siaya",
    "Kisumu",
    "Homa Bay",
    "Migori",
    "Kisii",
    "Nyamira",
    "Nairobi",
]


async def main():
    loader = DatabaseLoader()
    country_id = await loader.ensure_country_exists("KEN")
    for name in COUNTIES:
        await loader.ensure_entity_exists(
            {"canonical_name": f"{name} County", "type": "county", "confidence": 1.0},
            country_id,
        )


if __name__ == "__main__":
    asyncio.run(main())
