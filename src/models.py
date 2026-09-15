"""
Databázové modely pro rezervační systém tetovacího studia.

V C01 máme jen jednoho tatéra, ale Resource je oddělená entita,
aby šlo v budoucnu snadno přidat další tatéry.
"""

import enum
from datetime import datetime, time

from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    Time,
    Enum,
    ForeignKey,
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class ReservationStatus(str, enum.Enum):
    """Možné stavy rezervace."""
    DRAFT = "DRAFT"
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"


class Resource(Base):
    """Resource = tatér, u kterého se rezervuje."""
    __tablename__ = "resources"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    work_start = Column(Time, nullable=False, default=time(9, 0))
    work_end = Column(Time, nullable=False, default=time(18, 0))

    reservations = relationship("Reservation", back_populates="resource")


class Reservation(Base):
    """Reservation = jeden konkrétní časový slot rezervovaný klientem."""
    __tablename__ = "reservations"

    id = Column(Integer, primary_key=True)
    resource_id = Column(Integer, ForeignKey("resources.id"), nullable=False)
    client_name = Column(String, nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    status = Column(Enum(ReservationStatus), default=ReservationStatus.DRAFT, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    resource = relationship("Resource", back_populates="reservations")
