"""
Regresní testy k nálezům C06 (F1–F3).

Oracle každého testu pochází ze specifikace / návrhu, ne ze současného kódu:
- F1: REQ-04 (reservation-confirm.md), BR-02 (reservation-rules.md), ADR-01
- F2: stavový diagram 9b (diagrams.md) – do CANCELLED vede jen PENDING_APPROVAL a CONFIRMED,
      REJECTED/EXPIRED jsou koncové stavy
- F3: BR-03 – zrušit lze jen při now < start, při now == start se zrušení zamítne
"""

import threading
import time as time_module
from datetime import datetime, timedelta, time

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import main
import reservation_service
from models import Base, Resource, Reservation, ReservationStatus
from reservation_service import (
    approve_reservation,
    cancel_reservation,
    ReservationConflictError,
)


# --------------------------------------------------------------------------
# Fixtures
# --------------------------------------------------------------------------

@pytest.fixture
def file_engine(tmp_path):
    """Souborová SQLite – souběžné sessions musí sdílet skutečnou databázi."""
    engine = create_engine(
        f"sqlite:///{tmp_path / 'c06.db'}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture
def SessionFactory(file_engine):
    return sessionmaker(bind=file_engine, autocommit=False, autoflush=False)


@pytest.fixture
def seeded(SessionFactory):
    """Tatér id=1 (9–18) a vrátí helper pro vložení rezervace v libovolném stavu."""
    db = SessionFactory()
    db.add(Resource(id=1, name="Test Tatér", work_start=time(9, 0), work_end=time(18, 0)))
    db.commit()

    def add(start, end, status):
        r = Reservation(resource_id=1, client_name="Klient", start_time=start,
                        end_time=end, status=status)
        db.add(r)
        db.commit()
        db.refresh(r)
        return r.id

    yield add
    db.close()


@pytest.fixture
def api(SessionFactory):
    """TestClient nad skutečnou main.app, DB přesměrovaná do izolované databáze."""
    def override_get_db():
        db = SessionFactory()
        try:
            yield db
        finally:
            db.close()

    main.app.dependency_overrides[main.get_db] = override_get_db
    yield TestClient(main.app)
    main.app.dependency_overrides.clear()


def _status(SessionFactory, reservation_id):
    db = SessionFactory()
    try:
        return db.get(Reservation, reservation_id).status
    finally:
        db.close()


# --------------------------------------------------------------------------
# F1 – souběžné schválení dvou kolidujících žádostí (REQ-04, BR-02, ADR-01)
# --------------------------------------------------------------------------

def test_F1_concurrent_approve_of_colliding_requests_at_most_one_confirmed(
    SessionFactory, seeded, monkeypatch
):
    day = datetime(2030, 10, 1)
    r1 = seeded(day.replace(hour=10), day.replace(hour=12), ReservationStatus.PENDING_APPROVAL)
    r2 = seeded(day.replace(hour=11), day.replace(hour=13), ReservationStatus.PENDING_APPROVAL)

    # Rozšíříme okno mezi kontrolou kolize a zápisem, aby se případný race
    # projevil deterministicky (bez ochrany obě vlákna zkontrolují dřív, než
    # kdokoli zapíše).
    original_overlaps = reservation_service._overlaps

    def slow_overlaps(*args):
        time_module.sleep(0.3)
        return original_overlaps(*args)

    monkeypatch.setattr(reservation_service, "_overlaps", slow_overlaps)

    # Druhé vlákno se zpozdí jen o chvilku, aby obě běžela současně.
    start_barrier = threading.Barrier(2)
    results = {}

    def worker(res_id):
        db = SessionFactory()
        try:
            start_barrier.wait()
            approve_reservation(db, res_id, is_approved=True)
            results[res_id] = "CONFIRMED"
        except ReservationConflictError:
            results[res_id] = "CONFLICT"
        finally:
            db.close()

    threads = [threading.Thread(target=worker, args=(rid,)) for rid in (r1, r2)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=15)

    statuses = [_status(SessionFactory, rid) for rid in (r1, r2)]
    assert statuses.count(ReservationStatus.CONFIRMED) == 1, statuses
    assert sorted(results.values()) == ["CONFIRMED", "CONFLICT"]


def test_F1_adjacent_request_with_pause_can_still_be_approved(SessionFactory, seeded):
    """Regrese: ochrana nesmí zablokovat platné schválení (přesně 30 min pauza, BR-04)."""
    day = datetime(2030, 10, 1)
    seeded(day.replace(hour=10), day.replace(hour=11), ReservationStatus.CONFIRMED)
    r2 = seeded(day.replace(hour=11, minute=30), day.replace(hour=12, minute=30),
                ReservationStatus.PENDING_APPROVAL)

    db = SessionFactory()
    approve_reservation(db, r2, is_approved=True)
    db.close()

    assert _status(SessionFactory, r2) == ReservationStatus.CONFIRMED


# --------------------------------------------------------------------------
# F2 – cancel smí jen z PENDING_APPROVAL / CONFIRMED (diagrams.md 9b)
# --------------------------------------------------------------------------

@pytest.mark.parametrize("terminal", [ReservationStatus.REJECTED, ReservationStatus.EXPIRED])
def test_F2_cancel_of_terminal_state_is_refused(SessionFactory, seeded, terminal):
    start = datetime(2030, 10, 1, 10, 0)
    rid = seeded(start, start + timedelta(hours=1), terminal)

    db = SessionFactory()
    with pytest.raises(ValueError):
        cancel_reservation(db, rid, start - timedelta(days=1))
    db.close()

    assert _status(SessionFactory, rid) == terminal


@pytest.mark.parametrize("source", [ReservationStatus.PENDING_APPROVAL, ReservationStatus.CONFIRMED])
def test_F2_cancel_before_start_from_allowed_state_succeeds(SessionFactory, seeded, source):
    start = datetime(2030, 10, 1, 10, 0)
    rid = seeded(start, start + timedelta(hours=1), source)

    db = SessionFactory()
    cancel_reservation(db, rid, start - timedelta(minutes=1))
    db.close()

    assert _status(SessionFactory, rid) == ReservationStatus.CANCELLED


def test_F2_repeated_cancel_is_idempotent(SessionFactory, seeded):
    start = datetime(2030, 10, 1, 10, 0)
    rid = seeded(start, start + timedelta(hours=1), ReservationStatus.CANCELLED)

    db = SessionFactory()
    result = cancel_reservation(db, rid, start - timedelta(days=1))
    db.close()

    assert result.status == ReservationStatus.CANCELLED


# --------------------------------------------------------------------------
# F3 – jedna časová báze, hranice now == start (BR-03)
# --------------------------------------------------------------------------

def test_F3_service_cancel_exactly_at_start_is_refused(SessionFactory, seeded):
    start = datetime(2030, 10, 1, 10, 0)
    rid = seeded(start, start + timedelta(hours=1), ReservationStatus.CONFIRMED)

    db = SessionFactory()
    with pytest.raises(ValueError):
        cancel_reservation(db, rid, start)  # now == start
    db.close()

    assert _status(SessionFactory, rid) == ReservationStatus.CONFIRMED


def test_F3_api_cancel_after_start_is_refused(api, SessionFactory, seeded):
    """Skutečné hodiny API: rezervace začala před 5 minutami → HTTP 400."""
    start = datetime.now() - timedelta(minutes=5)
    rid = seeded(start, start + timedelta(hours=1), ReservationStatus.CONFIRMED)

    response = api.post(f"/reservations/{rid}/cancel")

    assert response.status_code == 400
    assert _status(SessionFactory, rid) == ReservationStatus.CONFIRMED


def test_F3_api_cancel_before_start_succeeds(api, SessionFactory, seeded):
    start = datetime.now() + timedelta(minutes=5)
    rid = seeded(start, start + timedelta(hours=1), ReservationStatus.CONFIRMED)

    response = api.post(f"/reservations/{rid}/cancel")

    assert response.status_code == 200
    assert _status(SessionFactory, rid) == ReservationStatus.CANCELLED


def test_F3_created_at_uses_same_time_base_as_start_time(SessionFactory, seeded):
    """created_at (pro REQ-07) musí být ve stejné časové bázi jako lokální start_time."""
    before = datetime.now()
    start = datetime(2030, 10, 1, 10, 0)
    rid = seeded(start, start + timedelta(hours=1), ReservationStatus.PENDING_APPROVAL)
    after = datetime.now()

    db = SessionFactory()
    created_at = db.get(Reservation, rid).created_at
    db.close()

    assert before - timedelta(seconds=1) <= created_at <= after + timedelta(seconds=1)
