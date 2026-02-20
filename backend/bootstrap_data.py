"""Bootstrap script to seed essential reference data."""

import sys
from datetime import datetime, timezone
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from database import SessionLocal
from models import Country, Entity, EntityType


def bootstrap_kenya_data():
    """Seed Kenya country and basic entities."""

    session = SessionLocal()
    try:
        # Check if Kenya already exists
        kenya = session.query(Country).filter(Country.iso_code == "KEN").first()

        if not kenya:
            print("Creating Kenya country record...")
            kenya = Country(
                iso_code="KEN",
                name="Kenya",
                currency="KES",
                timezone="Africa/Nairobi",
                default_locale="en_KE",
                meta={},
            )
            session.add(kenya)
            session.flush()
            print(f"✓ Created Kenya (id={kenya.id})")
        else:
            print(f"✓ Kenya already exists (id={kenya.id})")

        # Create National Government entity
        national_gov = (
            session.query(Entity)
            .filter(Entity.slug == "kenya-national-government")
            .first()
        )

        if not national_gov:
            print("Creating National Government entity...")
            national_gov = Entity(
                country_id=kenya.id,
                type=EntityType.NATIONAL,
                canonical_name="National Government",
                slug="kenya-national-government",
                alt_names=["Kenya National Government", "GoK", "Government of Kenya"],
                meta={},
            )
            session.add(national_gov)
            session.flush()
            print(f"✓ Created National Government (id={national_gov.id})")
        else:
            print(f"✓ National Government already exists (id={national_gov.id})")

        # Check if Nairobi exists
        nairobi = session.query(Entity).filter(Entity.slug == "nairobi-county").first()

        if not nairobi:
            print("Creating Nairobi City County entity...")
            nairobi = Entity(
                country_id=kenya.id,
                type=EntityType.COUNTY,
                canonical_name="Nairobi City County",
                slug="nairobi-county",
                alt_names=["Nairobi", "Nairobi County"],
                meta={},
            )
            session.add(nairobi)
            session.flush()
            print(f"✓ Created Nairobi (id={nairobi.id})")
        else:
            print(f"✓ Nairobi already exists (id={nairobi.id})")

        # Create other major counties
        counties = [
            ("mombasa-county", "Mombasa County", ["Mombasa"]),
            ("kisumu-county", "Kisumu County", ["Kisumu"]),
            ("nakuru-county", "Nakuru County", ["Nakuru"]),
            ("kiambu-county", "Kiambu County", ["Kiambu"]),
        ]

        for slug, name, alt_names in counties:
            entity = session.query(Entity).filter(Entity.slug == slug).first()
            if not entity:
                entity = Entity(
                    country_id=kenya.id,
                    type=EntityType.COUNTY,
                    canonical_name=name,
                    slug=slug,
                    alt_names=alt_names,
                    meta={},
                )
                session.add(entity)
                print(f"✓ Created {name}")
            else:
                print(f"✓ {name} already exists")

        session.commit()
        print("\n✅ Bootstrap completed successfully!")

    except Exception as exc:
        session.rollback()
        print(f"\n❌ Bootstrap failed: {exc}")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    bootstrap_kenya_data()
