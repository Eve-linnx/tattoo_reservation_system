"""
Business logika rezervačního systému.

Obsahuje kontrolu dvou pravidel:
1. Common rule: dvě CONFIRMED rezervace stejného resource se nesmí překrývat.
2. Domain-specific rule: mezi dvěma CONFIRMED rezervacemi stejného resource
   musí být minimální 30minutová pauza (čas na úklid/přípravu).
"""

from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from models import Reservation, Resource, ReservationStatus

# Minimální pauza mezi dvěma rezervacemi stejného tatéra (v minutách)
MIN_PAUSE_MINUTES = 30


class ReservationConflictError(Exception):
    """Vyhodí se, když nová rezervace poruší business pravidla."""
    pass


class OutsideWorkingHoursError(Exception):
    """Vyhodí se, když rezervace zasahuje mimo pracovní dobu tatéra."""
    pass


def _overlaps(start_a: datetime, end_a: datetime, start_b: datetime, end_b: datetime) -> bool:
    """Vrátí True, pokud se dva časové intervaly překrývají."""
    return start_a < end_b and start_b < end_a


def _too_close(start_a: datetime, end_a: datetime, start_b: datetime, end_b: datetime, pause_minutes: int) -> bool:
    """
    Vrátí True, pokud mezi konci a začátky dvou intervalů není
    dostatečná pauza (a intervaly se zároveň nepřekrývají).
    """
    pause = timedelta(minutes=pause_minutes)
    # Pokud rezervace A končí příliš blízko před začátkem B
    gap_after_a = start_b - end_a
    # Pokud rezervace B končí příliš blízko před začátkem A
    gap_after_b = start_a - end_b

    if gap_after_a >= timedelta(0):
        return gap_after_a < pause
    if gap_after_b >= timedelta(0):
        return gap_after_b < pause
    return False  # tento případ by měl zachytit už _overlaps


def _check_working_hours(resource: Resource, start_time: datetime, end_time: datetime) -> None:
    """Ověří, že rezervace spadá do pracovní doby tatéra."""
    if start_time.time() < resource.work_start or end_time.time() > resource.work_end:
        raise OutsideWorkingHoursError(
            f"Rezervace musí být v pracovní době tatéra "
            f"({resource.work_start.strftime('%H:%M')}–{resource.work_end.strftime('%H:%M')}). "
            f"Požadovaný slot: {start_time.strftime('%H:%M')}–{end_time.strftime('%H:%M')}."
        )


def create_reservation(
    db: Session,
    resource_id: int,
    client_name: str,
    start_time: datetime,
    end_time: datetime,
) -> Reservation:
    """
    Vytvoří novou rezervaci ve stavu DRAFT.

    Kontrola business pravidel (overlap, pauza, pracovní doba) probíhá vůči
    existujícím CONFIRMED rezervacím stejného resource.
    """
    if end_time <= start_time:
        raise ValueError("Konec rezervace musí být po jejím začátku.")

    resource = db.query(Resource).get(resource_id)
    if resource is None:
        raise ValueError(f"Resource id={resource_id} neexistuje.")
    _check_working_hours(resource, start_time, end_time)

    existing_confirmed = (
        db.query(Reservation)
        .filter(
            Reservation.resource_id == resource_id,
            Reservation.status == ReservationStatus.CONFIRMED,
        )
        .all()
    )

    for existing in existing_confirmed:
        if _overlaps(start_time, end_time, existing.start_time, existing.end_time):
            raise ReservationConflictError(
                f"Rezervace se překrývá s existující rezervací id={existing.id}."
            )
        if _too_close(start_time, end_time, existing.start_time, existing.end_time, MIN_PAUSE_MINUTES):
            raise ReservationConflictError(
                f"Mezi rezervacemi musí být alespoň {MIN_PAUSE_MINUTES} minut pauza "
                f"(konflikt s rezervací id={existing.id})."
            )

    reservation = Reservation(
        resource_id=resource_id,
        client_name=client_name,
        start_time=start_time,
        end_time=end_time,
        status=ReservationStatus.DRAFT,
    )
    db.add(reservation)
    db.commit()
    db.refresh(reservation)
    return reservation


def confirm_reservation(db: Session, reservation_id: int) -> Reservation:
    """
    Potvrdí rezervaci (DRAFT -> CONFIRMED).

    Znovu kontroluje pravidla, protože mezi vytvořením DRAFT rezervace
    a jejím potvrzením mohla vzniknout jiná CONFIRMED rezervace.
    """
    reservation = db.query(Reservation).get(reservation_id)
    if reservation is None:
        raise ValueError(f"Rezervace id={reservation_id} neexistuje.")

    other_confirmed = (
        db.query(Reservation)
        .filter(
            Reservation.resource_id == reservation.resource_id,
            Reservation.status == ReservationStatus.CONFIRMED,
            Reservation.id != reservation.id,
        )
        .all()
    )

    for other in other_confirmed:
        if _overlaps(reservation.start_time, reservation.end_time, other.start_time, other.end_time):
            raise ReservationConflictError(
                f"Rezervaci nelze potvrdit, překrývá se s id={other.id}."
            )
        if _too_close(reservation.start_time, reservation.end_time, other.start_time, other.end_time, MIN_PAUSE_MINUTES):
            raise ReservationConflictError(
                f"Rezervaci nelze potvrdit, chybí {MIN_PAUSE_MINUTES}min pauza vůči id={other.id}."
            )

    reservation.status = ReservationStatus.CONFIRMED
    db.commit()
    db.refresh(reservation)
    return reservation


def cancel_reservation(db: Session, reservation_id: int) -> Reservation:
    """Zruší rezervaci (status -> CANCELLED)."""
    reservation = db.query(Reservation).get(reservation_id)
    if reservation is None:
        raise ValueError(f"Rezervace id={reservation_id} neexistuje.")

    reservation.status = ReservationStatus.CANCELLED
    db.commit()
    db.refresh(reservation)
    return reservation


def check_availability(db: Session, resource_id: int, start_time: datetime, end_time: datetime) -> bool:
    """Vrátí True, pokud je daný slot volný (bez porušení pravidel)."""
    existing_confirmed = (
        db.query(Reservation)
        .filter(
            Reservation.resource_id == resource_id,
            Reservation.status == ReservationStatus.CONFIRMED,
        )
        .all()
    )
    for existing in existing_confirmed:
        if _overlaps(start_time, end_time, existing.start_time, existing.end_time):
            return False
        if _too_close(start_time, end_time, existing.start_time, existing.end_time, MIN_PAUSE_MINUTES):
            return False
    return True
