from datetime import datetime, time
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from models import Base, Resource, Reservation, ReservationStatus
from reservation_service import (
    create_reservation,
    approve_reservation,
    cancel_reservation,
    check_availability,
    ReservationConflictError,
    OutsideWorkingHoursError,
)

DATABASE_URL = "sqlite:///./tattoo_studio.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Tattoo Reservation System API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.on_event("startup")
def startup_populate():
    db = SessionLocal()
    if not db.query(Resource).filter(Resource.id == 1).first():
        jan = Resource(id=1, name="Jan Novák", work_start=time(9, 0), work_end=time(18, 0))
        db.add(jan)
    if not db.query(Resource).filter(Resource.id == 2).first():
        elena = Resource(id=2, name="Elena Křížová", work_start=time(9, 0), work_end=time(18, 0))
        db.add(elena)
    db.commit()
    db.close()

@app.get("/resources")
def api_get_resources(db: Session = Depends(get_db)):
    resources = db.query(Resource).all()
    return [{"id": r.id, "name": r.name, "work_start": str(r.work_start), "work_end": str(r.work_end)} for r in resources]

class ReservationCreateSchema(BaseModel):
    resource_id: int = 1
    client_name: str
    start_time: datetime
    end_time: datetime

class ApproveSchema(BaseModel):
    is_approved: bool

@app.post("/reservations")
def api_create_reservation(data: ReservationCreateSchema, db: Session = Depends(get_db)):
    try:
        res = create_reservation(db, data.resource_id, data.client_name, data.start_time, data.end_time)
        return {"id": res.id, "status": res.status.value, "client_name": res.client_name}
    except (ReservationConflictError, OutsideWorkingHoursError, ValueError) as err:
        raise HTTPException(status_code=400, detail=str(err))

@app.get("/reservations")
def api_list_reservations(db: Session = Depends(get_db)):
    items = db.query(Reservation).order_by(Reservation.start_time.asc()).all()
    return [
        {
            "id": r.id,
            "client_name": r.client_name,
            "start_time": r.start_time.isoformat(),
            "end_time": r.end_time.isoformat(),
            "status": r.status.value,
        }
        for r in items
    ]

@app.post("/reservations/{res_id}/approve")
def api_approve_reservation(res_id: int, data: ApproveSchema, db: Session = Depends(get_db)):
    try:
        res = approve_reservation(db, res_id, data.is_approved)
        return {"id": res.id, "status": res.status.value}
    except (ReservationConflictError, ValueError) as err:
        raise HTTPException(status_code=400, detail=str(err))

@app.post("/reservations/{res_id}/cancel")
def api_cancel_reservation(res_id: int, db: Session = Depends(get_db)):
    try:
        res = cancel_reservation(db, res_id, datetime.utcnow())
        return {"id": res.id, "status": res.status.value}
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err))