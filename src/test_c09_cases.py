"""C09 – integrační testy CR-01 (líná expirace při schvalování)."""

import sqlite3
from datetime import datetime, timedelta, time

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import main
from models import Base, Resource, Reservation, ReservationStatus
from reservation_service import (
    ReservationExpiredError,
    approve_reservation,
    create_reservation,
)


@pytest.fixture
def environment(tmp_path):
    db_path = tmp_path / "c09.db"
    engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    db = session_factory()
    db.add(Resource(id=1, name="Test Tatér", work_start=time(9, 0), work_end=time(18, 0)))
    db.commit()
    db.close()

    def override_get_db():
        session = session_factory()
        try:
            yield session
        finally:
            session.close()

    main.app.dependency_overrides[main.get_db] = override_get_db
    yield db_path, session_factory, TestClient(main.app)
    main.app.dependency_overrides.clear()
    engine.dispose()


def _create_pending(session_factory, created_at):
    db = session_factory()
    try:
        reservation = create_reservation(
            db,
            resource_id=1,
            client_name="C09",
            start_time=datetime(2030, 10, 1, 10, 0),
            end_time=datetime(2030, 10, 1, 11, 0),
        )
        reservation.created_at = created_at
        db.commit()
        return reservation.id
    finally:
        db.close()


def _persisted_status(db_path, reservation_id):
    connection = sqlite3.connect(db_path)
    try:
        return connection.execute(
            "SELECT status FROM reservations WHERE id = ?", (reservation_id,)
        ).fetchone()[0]
    finally:
        connection.close()


def test_AC01_request_younger_than_24_hours_is_confirmed(environment):
    _, session_factory, _ = environment
    current_time = datetime(2030, 10, 2, 10, 0)
    reservation_id = _create_pending(session_factory, current_time - timedelta(hours=23, minutes=59))

    db = session_factory()
    try:
        reservation = approve_reservation(db, reservation_id, True, current_time)
        assert reservation.status == ReservationStatus.CONFIRMED
    finally:
        db.close()


@pytest.mark.parametrize("age", [timedelta(hours=24), timedelta(hours=24, minutes=1)])
def test_AC02_AC03_expired_request_is_persisted_and_rejected(environment, age):
    db_path, session_factory, _ = environment
    current_time = datetime(2030, 10, 2, 10, 0)
    reservation_id = _create_pending(session_factory, current_time - age)

    db = session_factory()
    try:
        with pytest.raises(ReservationExpiredError):
            approve_reservation(db, reservation_id, True, current_time)
    finally:
        db.close()

    assert _persisted_status(db_path, reservation_id) == ReservationStatus.EXPIRED.value


def test_AC02_api_returns_400_and_commits_expired_state(environment):
    db_path, session_factory, api = environment
    reservation_id = _create_pending(session_factory, datetime.now() - timedelta(hours=24, minutes=1))

    response = api.post(
        f"/reservations/{reservation_id}/approve",
        json={"is_approved": True},
    )

    assert response.status_code == 400
    assert "vypršela" in response.json()["detail"]
    assert _persisted_status(db_path, reservation_id) == ReservationStatus.EXPIRED.value


def test_AC05_rejecting_younger_request_is_unchanged(environment):
    _, session_factory, _ = environment
    current_time = datetime(2030, 10, 2, 10, 0)
    reservation_id = _create_pending(session_factory, current_time - timedelta(hours=1))

    db = session_factory()
    try:
        reservation = approve_reservation(db, reservation_id, False, current_time)
        assert reservation.status == ReservationStatus.REJECTED
    finally:
        db.close()
