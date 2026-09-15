# C01 Engineering Spike - A – Persistence

## Question / unknown
Umíme rezervaci skutečně uložit do databáze, znovu ji načíst a ověřit,
že business pravidla (žádný překryv + 30minutová pauza mezi rezervacemi
stejného tatéra) fungují tak, jak očekáváme?

## What we did
- Vytvořili jsme SQLAlchemy modely `Resource` a `Reservation` (viz `src/models.py`)
- Napsali jsme funkci `create_reservation`, která před uložením rezervace
  zkontroluje:
  1. že se nepřekrývá s žádnou existující CONFIRMED rezervací stejného tatéra
  2. že je dodržena minimální 30minutová pauza před/po jiné CONFIRMED rezervaci
- Vytvořili jsme testovací skript `src/test_spike.py`, který:
  1. založí testovací SQLite databázi
  2. vytvoří tatéra (Resource)
  3. vytvoří první rezervaci a potvrdí ji (DRAFT → CONFIRMED)
  4. pokusí se vytvořit překrývající se rezervaci → očekáváme chybu
  5. pokusí se vytvořit rezervaci příliš blízko té první (méně než 30 min
     pauza) → očekáváme chybu
  6. vytvoří platnou rezervaci s dostatečným odstupem → očekáváme úspěch
  7. načte všechny rezervace z DB zpět a ověří jejich počet a stavy

## Observed result
Skript proběhl úspěšně (`python src/test_spike.py`), všechny testované
scénáře odpovídaly očekávání:
- překrývající se rezervace byla zamítnuta
- rezervace bez dostatečné pauzy byla zamítnuta
- platná rezervace byla úspěšně uložena a po znovunačtení z DB odpovídala
  vloženým datům


## Decision / what changes because of the result
Business pravidla (overlap + pauza) fungují spolehlivě už na úrovni
persistence vrstvy, takže je nebudeme duplikovat v API vrstvě (FastAPI
endpoint bude pouze volat `create_reservation` a případnou výjimku
převede na HTTP chybu). Tím se pravidlo definuje jen na jednom místě
a walking skeleton (C03/C04) na tuto funkci může přímo navázat.
