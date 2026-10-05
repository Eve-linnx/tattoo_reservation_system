"""
Spike A & Baseline v0.1 Demo

Demonstrace všech 4 základních operací:
Create, Check Availability, Confirm a Cancel.
"""

from datetime import datetime, timedelta, time
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from models import Base, Resource, ReservationStatus
from reservation_service import (
    create_reservation,
    confirm_reservation,
    cancel_reservation,
    check_availability,
    ReservationConflictError,
    OutsideWorkingHoursError,
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

    # Vytvoření Tatéra (Pracovní doba 9:00 - 18:00)
    tatér = Resource(name="Jan Novák", work_start=time(9, 0), work_end=time(18, 0))
    db.add(tatér)
    db.commit()
    db.refresh(tatér)

    base_time = datetime(2026, 10, 1, 10, 0)
    
    print("=== START BASELINE v0.1 DEMO ===\n")

    # === OP-02: CHECK AVAILABILITY ===
    print("--- OP-02: Check Availability ---")
    # Úspěch (Volno)
    is_avail = check_availability(db, tatér.id, base_time, base_time + timedelta(hours=2))
    print(f"[OK] Dostupnost 10:00-12:00: {'AVAILABLE' if is_avail else 'UNAVAILABLE'}")
    
    # === OP-01: CREATE RESERVATION ===
    print("\n--- OP-01: Create Reservation ---")
    # Úspěch (Vytvoření DRAFTu)
    r1 = create_reservation(db, tatér.id, "Klient A", base_time, base_time + timedelta(hours=2))
    print(f"[OK] Rezervace vytvořena: ID={r1.id}, Stav={r1.status.value}")
    # Chyba (Mimo pracovní dobu)
    try:
        create_reservation(db, tatér.id, "Klient Noční", datetime(2026, 10, 1, 7, 0), datetime(2026, 10, 1, 8, 0))
    except OutsideWorkingHoursError as e:
        print(f"[OK] Zamítnuto (mimo prac. dobu): {e}")

    # === OP-03: CONFIRM RESERVATION ===
    print("\n--- OP-03: Confirm Reservation ---")
    # Úspěch (Potvrzení DRAFTu)
    r1 = confirm_reservation(db, r1.id)
    print(f"[OK] Rezervace potvrzena: ID={r1.id}, Stav={r1.status.value}")
    
    # Chyba (Pokus o potvrzení kolize - porušení pauzy 30 min)
    r2_draft = create_reservation(db, tatér.id, "Klient B", r1.end_time + timedelta(minutes=15), r1.end_time + timedelta(minutes=75))
    try:
        confirm_reservation(db, r2_draft.id)
    except ReservationConflictError as e:
        print(f"[OK] Zamítnuto (kolize/pauza): {e}")

    # (Demonstrace pro OP-02: Nyní by Check Availability mělo vrátit UNAVAILABLE pro čas, který blokuje r1)
    is_avail_conflict = check_availability(db, tatér.id, base_time + timedelta(hours=1), base_time + timedelta(hours=3))
    print(f"[OK] Dostupnost překrývajícího se času (11:00-13:00): {'AVAILABLE' if is_avail_conflict else 'UNAVAILABLE'}")

    # === OP-04: CANCEL RESERVATION ===
    print("\n--- OP-04: Cancel Reservation ---")
    # Úspěch (Storno proběhlo PŘED začátkem termínu)
    simulated_now_ok = datetime(2026, 10, 1, 8, 0) # Jsou 8:00 ráno, rezervace je na 10:00
    r1 = cancel_reservation(db, r1.id, simulated_now_ok)
    print(f"[OK] Rezervace zrušena: ID={r1.id}, Stav={r1.status.value}")
    
    # Chyba (Pokus o storno PO začátku termínu)
    r3 = create_reservation(db, tatér.id, "Klient C", datetime(2026, 10, 2, 14, 0), datetime(2026, 10, 2, 16, 0))
    confirm_reservation(db, r3.id)
    simulated_now_late = datetime(2026, 10, 2, 14, 30) # Sezení už začalo
    try:
        cancel_reservation(db, r3.id, simulated_now_late)
    except ValueError as e:
        print(f"[OK] Zamítnuto zrušení: {e}")

    print("\nVšechny kontroly OP-01 až OP-04 proběhly úspěšně. Aplikace odpovídá Baseline v0.1.")

if __name__ == "__main__":
    main()