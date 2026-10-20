import pytest
from datetime import datetime, timedelta, time
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from models import Base, Resource, Reservation, ReservationStatus
from reservation_service import (
    create_reservation,
    approve_reservation,
    cancel_reservation,
    expire_old_reservations,
    ReservationConflictError,
    OutsideWorkingHoursError
)

# Testovací in-memory databáze izolovaná od produkční SQLite
@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()

@pytest.fixture
def setup_resource(db_session):
    resource = Resource(id=1, name="Test Tatér", work_start=time(9, 0), work_end=time(18, 0))
    db_session.add(resource)
    db_session.commit()
    return resource

# TEST 1: Failure behavior (Pravidlo mimo pracovní dobu)
def test_create_outside_working_hours_throws_error(db_session, setup_resource):
    start_time = datetime(2030, 10, 1, 8, 0) # Začátek v 8:00 (mimo dobu)
    end_time = datetime(2030, 10, 1, 10, 0)
    
    with pytest.raises(OutsideWorkingHoursError):
        create_reservation(db_session, setup_resource.id, "Klient", start_time, end_time)

# TEST 2: Failure behavior (Konflikt s potvrzenou rezervací)
def test_create_overlapping_confirmed_reservation_throws_error(db_session, setup_resource):
    base_time = datetime(2030, 10, 1, 10, 0)
    # Vytvoření a schválení první rezervace
    r1 = create_reservation(db_session, setup_resource.id, "Klient 1", base_time, base_time + timedelta(hours=2))
    approve_reservation(db_session, r1.id, is_approved=True)
    
    # Pokus o vytvoření překrývající se rezervace
    with pytest.raises(ReservationConflictError):
        create_reservation(db_session, setup_resource.id, "Klient 2", base_time + timedelta(hours=1), base_time + timedelta(hours=3))

# TEST 3: State transition (Schválení rezervace)
def test_approve_reservation_changes_state_to_confirmed(db_session, setup_resource):
    base_time = datetime(2030, 10, 1, 14, 0)
    r = create_reservation(db_session, setup_resource.id, "Klient", base_time, base_time + timedelta(hours=1))
    
    assert r.status == ReservationStatus.PENDING_APPROVAL
    approve_reservation(db_session, r.id, is_approved=True)
    assert r.status == ReservationStatus.CONFIRMED

# TEST 4: State transition (Expirace starých rezervací)
def test_expire_old_reservations_changes_status_to_expired(db_session, setup_resource):
    base_time = datetime(2030, 10, 1, 10, 0)
    r = create_reservation(db_session, setup_resource.id, "Klient", base_time, base_time + timedelta(hours=1))
    
    # Uměle posuneme created_at do minulosti
    r.created_at = datetime.utcnow() - timedelta(hours=25)
    db_session.commit()
    
    expired_count = expire_old_reservations(db_session, datetime.utcnow())
    
    assert expired_count == 1
    assert r.status == ReservationStatus.EXPIRED

# TEST 5: Failure behavior (Zrušení po začátku rezervace)
def test_cancel_after_start_time_throws_error(db_session, setup_resource):
    base_time = datetime(2030, 10, 1, 10, 0)
    r = create_reservation(db_session, setup_resource.id, "Klient", base_time, base_time + timedelta(hours=1))
    
    # Simulace zrušení až POTÉ, co rezervace začala
    simulated_now = base_time + timedelta(minutes=10)
    
    with pytest.raises(ValueError, match="již nastal nebo uplynul"):
        cancel_reservation(db_session, r.id, simulated_now)

# TEST 6: Architecture Conformance (C03)
# Pravidlo: Doménová vrstva (reservation_service) nesmí záviset na webovém frameworku (FastAPI)
def test_architecture_service_does_not_depend_on_web_layer():
    import ast
    with open("reservation_service.py", "r", encoding="utf-8") as file:
        tree = ast.parse(file.read())
    
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                assert "fastapi" not in alias.name, "Architektonické pravidlo porušeno: Service importuje FastAPI"
        elif isinstance(node, ast.ImportFrom):
            assert node.module is None or "fastapi" not in node.module, "Architektonické pravidlo porušeno: Service importuje FastAPI"