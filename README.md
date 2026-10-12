# Rezervační systém – Tetovací studio

Tým: Tetovačky
Členové: Česlárová, Rechbergová, Běčáková, Veselá 
Repozitář: https://github.com/Eve-linnx/tattoo_reservation_system.git

## O projektu
Systém podporuje více tatérů (resources). Klienti si při vytváření žádosti volí konkrétního tatéra, u kterého si rezervují časový slot. Detailní popis domény je v [docs/intent-and-change.md](docs/intent-and-change.md).

## Stack
- **Backend:** Python 3.11+, FastAPI (API vrstva), SQLAlchemy + SQLite (persistence)
- **Frontend:** React (Vite), JavaScript
- **Testování:** pytest

Zdůvodnění výběru stacku je v [docs/architecture-and-decisions.md](docs/architecture-and-decisions.md).

## Instalace a spuštění (Lokální vývoj)

Projekt se skládá ze dvou oddělených částí, které musí běžet současně: backend API a frontendové UI.

### 1. Spuštění Backend API (FastAPI)
Z kořenové složky projektu nainstalujte závislosti, přejděte do složky src a spusťte uvicorn server:

    pip install -r requirements.txt
    cd src
    uvicorn main:app --reload

API poběží na http://localhost:8000 (dokumentace k API je dostupná na http://localhost:8000/docs).
Při prvním spuštění se automaticky vytvoří databáze tattoo_studio.db.

### 2. Spuštění Frontendu (React)
Přejděte do složky frontend, nainstalujte balíčky a spusťte vývojový server:

    cd frontend
    npm install
    npm run dev

Aplikace poběží typicky na http://localhost:5173 (přesný port vypíše konzole).

### Testování / Spike test
Pro spuštění demonstračního skriptu (ověření persistence), použijte:

    cd src
    python test_spike.py

Skript vytvoří testovací SQLite databázi, uloží do ní rezervace, ověří business pravidla a načte data zpět z DB. Detaily a výsledky jsou zapsané v [docs/evidence-and-evolution.md](docs/evidence-and-evolution.md).

## Struktura repozitáře

    README.md
    docs/
      intent-and-change.md          # Project Frame
      architecture-and-decisions.md # Architektura, C03 AS-IS a rozhodnutí
      evidence-and-evolution.md     # Spike evidence a evoluce
      diagrams.md                   # Diagramy případů užití a stavů
      spec/                         # Detailní textové specifikace OP-01 až OP-05
    frontend/                       # React SPA klient (UI)
    src/
      main.py                       # FastAPI aplikace (Controller/API)
      models.py                     # SQLAlchemy modely (Resource, Reservation)
      reservation_service.py        # Business logika (create/approve/cancel/availability)
      test_spike.py                 # Spike A - ověření persistence

## CP1 walking skeleton

Následující end-to-end cesta je plně funkční a runnable pro CP1:

1. **Uživatelská akce:** Klient v React UI vybere tatéra, časový slot a odešle formulář.
2. **API volání:** Frontend odešle POST /reservations na běžící FastAPI backend.
3. **Validace a business logika:** Backend zkontroluje formát, pracovní dobu a ověří databázové kolize vůči již potvrzeným rezervacím.
4. **Persistence:** Systém uloží novou rezervaci do databáze (tattoo_studio.db) s výchozím stavem PENDING_APPROVAL.
5. **Odpověď a UI:** Backend vrátí HTTP 200/201 s ID rezervace. Frontend uživateli zobrazí potvrzení o zaevidování žádosti.