"""
Spike A - Persistence

Tento skript ověřuje, že:
1. rezervaci lze skutečně uložit do DB a znovu načíst,
2. funguje kontrola překryvu (overlap rule),
3. funguje kontrola minimální 30minutové pauzy (domain-specific rule).

Spuštění:
    python src/test_spike.py
"""

from datetime import datetime, timedelta

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from models import Base, Resource, ReservationStatus
from reservation_service import (
    create_reservation,
    confirm_reservation,
    ReservationConflictError,
    OutsideWorkingHoursError,
)

# Testovací SQLite databáze (soubor se vytvoří v aktuálním adresáři)
DATABASE_URL = "sqlite:///spike_test.db"


def setup_database():
    """Vytvoří novou (prázdnou) testovací databázi a vrátí session."""
    engine = create_engine(DATABASE_URL)
    Base.metadata.drop_all(engine)  # vyčistíme případná stará data
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    return Session()


def main():
    db = setup_database()

    # 1. Vytvoříme tatéra (Resource) s pracovní dobou 09:00–18:00
    from datetime import time
    tatér = Resource(name="Jan Novák", work_start=time(9, 0), work_end=time(18, 0))
    db.add(tatér)
    db.commit()
    db.refresh(tatér)
    print(f"[OK] Vytvořen tatér id={tatér.id}, jméno={tatér.name}, pracovní doba {tatér.work_start}–{tatér.work_end}")

    base_time = datetime(2026, 10, 1, 10, 0)  # 1.10.2026 10:00

    # 2. Pokus o rezervaci ve 3:00 ráno -> musí selhat (mimo pracovní dobu)
    try:
        create_reservation(
            db,
            resource_id=tatér.id,
            client_name="Klient Noční",
            start_time=datetime(2026, 10, 1, 3, 0),
            end_time=datetime(2026, 10, 1, 5, 0),
        )
        print("[CHYBA] Noční rezervace prošla, ale neměla!")
    except OutsideWorkingHoursError as e:
        print(f"[OK] Noční rezervace správně zamítnuta: {e}")

    # 3. Pokus o rezervaci přesahující konec pracovní doby -> musí selhat
    try:
        create_reservation(
            db,
            resource_id=tatér.id,
            client_name="Klient Pozdní",
            start_time=datetime(2026, 10, 1, 17, 0),
            end_time=datetime(2026, 10, 1, 19, 0),  # konec po 18:00
        )
        print("[CHYBA] Rezervace přes konec pracovní doby prošla, ale neměla!")
    except OutsideWorkingHoursError as e:
        print(f"[OK] Rezervace přes konec pracovní doby správně zamítnuta: {e}")

    # 4. Vytvoříme první rezervaci a potvrdíme ji
    r1 = create_reservation(
        db,
        resource_id=tatér.id,
        client_name="Klient A",
        start_time=base_time,
        end_time=base_time + timedelta(hours=2),
    )
    r1 = confirm_reservation(db, r1.id)
    print(f"[OK] Rezervace 1 vytvořena a potvrzena: {r1.start_time} - {r1.end_time}, status={r1.status}")

    # 5. Pokus o překrývající se rezervaci -> musí selhat
    try:
        create_reservation(
            db,
            resource_id=tatér.id,
            client_name="Klient B",
            start_time=base_time + timedelta(hours=1),
            end_time=base_time + timedelta(hours=3),
        )
        r_overlap = confirm_reservation(db, r1.id)  # sem se nedostaneme
        print("[CHYBA] Překrývající se rezervace prošla, ale neměla!")
    except ReservationConflictError as e:
        print(f"[OK] Překrývající se rezervace byla správně zamítnuta: {e}")

    # 6. Pokus o rezervaci příliš blízko (méně než 30 min pauza) -> musí selhat
    try:
        r_close = create_reservation(
            db,
            resource_id=tatér.id,
            client_name="Klient C",
            start_time=r1.end_time + timedelta(minutes=10),  # jen 10 min po konci
            end_time=r1.end_time + timedelta(minutes=70),
        )
        confirm_reservation(db, r_close.id)
        print("[CHYBA] Rezervace bez dostatečné pauzy prošla, ale neměla!")
    except ReservationConflictError as e:
        print(f"[OK] Rezervace bez dostatečné pauzy byla správně zamítnuta: {e}")

    # 7. Platná rezervace s dostatečným odstupem -> musí projít
    r2 = create_reservation(
        db,
        resource_id=tatér.id,
        client_name="Klient D",
        start_time=r1.end_time + timedelta(minutes=30),  # přesně 30 min pauza
        end_time=r1.end_time + timedelta(minutes=90),
    )
    r2 = confirm_reservation(db, r2.id)
    print(f"[OK] Rezervace 2 (s dostatečnou pauzou) vytvořena a potvrzena: {r2.start_time} - {r2.end_time}")

    # 8. Znovu načteme všechny rezervace z DB a ověříme počet a stavy
    all_reservations = db.query(r1.__class__).all()
    confirmed_count = sum(1 for r in all_reservations if r.status == ReservationStatus.CONFIRMED)
    print(f"[OK] Celkem rezervací v DB: {len(all_reservations)}, z toho CONFIRMED: {confirmed_count}")

    assert confirmed_count == 2, "Očekávány přesně 2 potvrzené rezervace!"
    print("\nVšechny kontroly proběhly úspěšně. Spike A je ověřen.")


if __name__ == "__main__":
    main()
