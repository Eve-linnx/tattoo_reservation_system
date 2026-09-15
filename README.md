# Rezervační systém – Tetovací studio

Tým: Tetovačky
Členové: Česlárová, Rechbergová, Běčáková, Veselá 
Repozitář: https://github.com/Eve-linnx/tattoo_reservation_system.git

## O projektu
Rezervační systém pro tetovací studio. V C01 pracujeme s jedním tatérem
(resource), u kterého si klienti rezervují časové sloty. Detailní popis
domény je v [docs/intent-and-change.md](docs/intent-and-change.md).

## Stack
- Python 3.11+
- FastAPI (API vrstva – bude doplněna)
- SQLAlchemy + SQLite (persistence)
- pytest (testování)

Zdůvodnění výběru stacku je v [docs/architecture-and-decisions.md](docs/architecture-and-decisions.md).

## Instalace a spuštění

```bash
pip install -r requirements.txt
```

### Spuštění spike testu (persistence)

```bash
cd src
python test_spike.py
```

Skript vytvoří testovací SQLite databázi, uloží do ní rezervace, ověří
business pravidla (overlap + 30min pauza) a načte data zpět z DB.
Detaily a výsledky jsou zapsané v [docs/evidence-and-evolution.md](docs/evidence-and-evolution.md).

## Struktura repozitáře

```
README.md
docs/
  intent-and-change.md          # Project Frame
  architecture-and-decisions.md # stack, future pressure
  evidence-and-evolution.md     # spike evidence
src/
  models.py                 # SQLAlchemy modely (Resource, Reservation)
  reservation_service.py    # business logika (create/confirm/cancel/availability)
  test_spike.py             # spike A - ověření persistence
```

## CP1 walking skeleton

Následující end-to-end cesta bude skutečně runnable po C03 / před C04:

```
POST /reservations
  → validate (vstupní data, formát času)
  → persist (uložení do DB přes reservation_service.create_reservation)
  → return reservation ID
  → automated check (test, který ověří, že rezervace skutečně existuje v DB)
```

V C01 tato cesta ještě není implementovaná jako FastAPI endpoint –
persistence vrstva a business logika jsou ale již hotové a otestované
(viz spike A)
