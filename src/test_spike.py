"""
Spike A & Baseline v0.2 Demo

Demonstrace operací: Create, Check Availability, Approve, Cancel a Expirace.
"""

from datetime import datetime, timedelta, time
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from models import Base, Resource, ReservationStatus
from reservation_service import (
    create_reservation,
    approve_reservation,
    cancel_reservation,
    check_availability,
    expire_old_reservations,
    ReservationConflictError,
)

DATABASE_URL = "sqlite:///spike_test.db"

def setup_database():
    engine = create_engine(DATABASE_URL)
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    return Session()

def main():
    db = setup_database()

    tatér = Resource(name="Jan Novák", work_start=time(9, 0), work_end=time(18, 0))
    db.add(tatér)
    db.commit()
    db.refresh(tatér)

    simulated_now = datetime(2026, 10, 1, 9, 0)
    base_time = datetime(2026, 10, 10, 10, 0)
    
    print("=== START BASELINE v0.2 DEMO ===\n")

    print("--- OP-01: Create Reservation ---")
    r1 = create_reservation(db, tatér.id, "Klient A", base_time, base_time + timedelta(hours=2))
    r1.created_at = simulated_now
    db.commit()
    print(f"[OK] Žádost vytvořena: ID={r1.id}, Stav={r1.status.value}")

    print("\n--- OP-05: Approve Reservation (Zamítnutí) ---")
    r2 = create_reservation(db, tatér.id, "Klient B", base_time + timedelta(hours=3), base_time + timedelta(hours=5))
    r2 = approve_reservation(db, r2.id, is_approved=False)
    print(f"[OK] Zamítnuto tatérem: ID={r2.id}, Stav={r2.status.value}")

    print("\n--- OP-05: Approve Reservation (Schválení) ---")
    r1 = approve_reservation(db, r1.id, is_approved=True)
    print(f"[OK] Schváleno tatérem: ID={r1.id}, Stav={r1.status.value}")

    print("\n--- Automatická Expirace (REQ-07) ---")
    r3 = create_reservation(db, tatér.id, "Klient C", datetime(2026, 10, 12, 10, 0), datetime(2026, 10, 12, 12, 0))
    r3.created_at = simulated_now
    db.commit()
    
    simulated_future = simulated_now + timedelta(hours=25)
    expired_count = expire_old_reservations(db, simulated_future)
    db.refresh(r3)
    print(f"[OK] Expirováno žádostí: {expired_count}. Stav klienta C: {r3.status.value}")

    print("\n--- OP-04: Cancel Reservation ---")
    simulated_cancel_time = datetime(2026, 10, 5, 10, 0)
    r1 = cancel_reservation(db, r1.id, simulated_cancel_time)
    print(f"[OK] Zrušeno klientem: ID={r1.id}, Stav={r1.status.value}")

if __name__ == "__main__":
    main()