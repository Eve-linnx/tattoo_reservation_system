"""
C08 – krokované test cases TC-C08-01 a TC-C08-02 (Approve, BR-02/BR-04).

Úroveň: integrační / systémová – skutečné HTTP API (FastAPI TestClient nad main.app)
a skutečná persistence (izolovaná souborová SQLite). Výsledný stav se ověřuje
NEZÁVISLE přímým SQL dotazem přes modul sqlite3, ne přes ORM ani HTTP odpověď.

Test basis: REQ-06, REQ-08, BR-01, BR-02, BR-04 (docs/spec/*, Baseline v0.2).
Expected je odvozeno ze specifikace před během; actual se vypisuje (pytest -s)
a je zapsané v docs/evidence-and-evolution.md § C08.
Data: lokální čas studia (Europe/Prague), intervaly [start, end), den = dnes + 7 dní.
"""

import sqlite3
import sys
from datetime import datetime, timedelta, time

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import main
from models import Base, Resource


DAY = (datetime.now() + timedelta(days=7)).replace(hour=0, minute=0, second=0, microsecond=0)


def log(msg):
    """Výpis odolný vůči kódování konzole (Windows cp1252 neumí češtinu)."""
    enc = sys.stdout.encoding or "utf-8"
    print(msg.encode(enc, "backslashreplace").decode(enc))


def at(hour, minute=0):
    return DAY.replace(hour=hour, minute=minute)


class Env:
    """Izolované prostředí: soubor DB + API klient + nezávislé čtení stavu."""

    def __init__(self, db_path):
        self.db_path = db_path
        engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
        Base.metadata.drop_all(engine)
        Base.metadata.create_all(engine)
        self.Session = sessionmaker(bind=engine, autocommit=False, autoflush=False)
        self.engine = engine
        db = self.Session()
        db.add(Resource(id=1, name="R1 – Tatér", work_start=time(9, 0), work_end=time(18, 0)))
        db.commit()
        db.close()

        def override_get_db():
            db = self.Session()
            try:
                yield db
            finally:
                db.close()

        main.app.dependency_overrides[main.get_db] = override_get_db
        self.api = TestClient(main.app)

    def create(self, name, start, end):
        r = self.api.post("/reservations", json={
            "resource_id": 1, "client_name": name,
            "start_time": start.isoformat(), "end_time": end.isoformat(),
        })
        assert r.status_code == 200, r.text
        return r.json()["id"]

    def approve(self, res_id):
        return self.api.post(f"/reservations/{res_id}/approve", json={"is_approved": True})

    def persisted(self):
        """Nezávislé čtení committed stavu přímo z DB souboru (ne přes ORM)."""
        con = sqlite3.connect(self.db_path)
        try:
            rows = con.execute(
                "SELECT id, start_time, end_time, status FROM reservations "
                "WHERE resource_id = 1 ORDER BY id"
            ).fetchall()
        finally:
            con.close()
        return [(i, s[11:16], e[11:16], st) for i, s, e, st in rows]

    def close(self):
        main.app.dependency_overrides.clear()
        self.engine.dispose()


def _setup(tmp_path, run, b2_start, b2_end):
    """
    Krok 1: obnovit izolovaná data – B1 CONFIRMED [10:00,11:00), B2 PENDING_APPROVAL.

    Pořadí odpovídá doméně (OP-05): obě žádosti vzniknou jako PENDING_APPROVAL
    a tatér pak schválí B1. Opačné pořadí (nejdřív CONFIRMED B1, pak create
    překrývající B2) nelze – create kolizi s CONFIRMED odmítne (REQ-01).
    """
    env = Env(tmp_path / f"c08_run{run}.db")
    b1 = env.create("B1", at(10), at(11))
    b2 = env.create("B2", b2_start, b2_end)
    assert env.approve(b1).status_code == 200
    return env, b1, b2


def _run_tc01(tmp_path, run):
    env, b1, b2 = _setup(tmp_path, run, at(11, 30), at(12, 30))
    try:
        step2 = env.persisted()
        log(f"\n[TC-C08-01 run {run}] krok 2 - vychozi ulozeny stav: {step2}")
        assert step2 == [(b1, "10:00", "11:00", "CONFIRMED"), (b2, "11:30", "12:30", "PENDING_APPROVAL")]

        resp = env.approve(b2)
        log(f"[TC-C08-01 run {run}] krok 3 - POST /reservations/{b2}/approve -> {resp.status_code} {resp.json()}")
        assert resp.status_code == 200

        step4 = env.persisted()
        log(f"[TC-C08-01 run {run}] krok 4 - committed stav: {step4}")
        assert [r[3] for r in step4] == ["CONFIRMED", "CONFIRMED"]
        return step4
    finally:
        env.close()


def _run_tc02(tmp_path, run):
    env, b1, b2 = _setup(tmp_path, run, at(10, 30), at(11, 30))
    try:
        step2 = env.persisted()
        log(f"\n[TC-C08-02 run {run}] krok 2 - vychozi ulozeny stav: {step2}")
        assert step2 == [(b1, "10:00", "11:00", "CONFIRMED"), (b2, "10:30", "11:30", "PENDING_APPROVAL")]

        resp = env.approve(b2)
        log(f"[TC-C08-02 run {run}] krok 3 - POST /reservations/{b2}/approve -> {resp.status_code} {resp.json()}")
        assert resp.status_code == 400

        step4 = env.persisted()
        log(f"[TC-C08-02 run {run}] krok 4 - committed stav: {step4}")
        assert step4 == [(b1, "10:00", "11:00", "CONFIRMED"), (b2, "10:30", "11:30", "PENDING_APPROVAL")]
        return step4
    finally:
        env.close()


def test_TC_C08_01_approve_with_exact_30min_pause_succeeds(tmp_path):
    """Pozitivní: B2 [11:30,12:30) má přesně 30 min pauzu po B1 → schválení projde (BR-04: přesně 30 min je přípustné)."""
    first = _run_tc01(tmp_path, 1)
    # krok 5 – reset a opakování se stejnými vstupy → stejný výsledek
    second = _run_tc01(tmp_path, 2)
    assert [r[1:] for r in first] == [r[1:] for r in second]


def test_TC_C08_02_approve_of_overlapping_request_is_rejected(tmp_path):
    """Negativní: B2 [10:30,11:30) se překrývá s CONFIRMED B1 → schválení odmítnuto, B1 beze změny, B2 není CONFIRMED."""
    first = _run_tc02(tmp_path, 1)
    second = _run_tc02(tmp_path, 2)
    assert [r[1:] for r in first] == [r[1:] for r in second]
