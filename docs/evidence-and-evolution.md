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

---

## C02 - Evidence a evoluce (Baseline v0.2)

Tento blok mapuje, jakým způsobem jsou požadavky a doménová pravidla ze specifikací (Baseline v0.2) implementovány v běžícím kódu, a shrnuje evoluci architektury.

### 1. Mapování specifikace na kód (Traceability)
* **BR-01 (Interval semantics):** Implementováno v pomocných funkcích `_overlaps` a `_too_close` a pojistkou na začátku `create_reservation` (konec musí být po začátku).
* **BR-02 (Exclusive Resource) a BR-04 (Minimální pauza):** Implementováno v `check_availability`, `create_reservation` a `approve_reservation` dotazem na stávající `CONFIRMED` rezervace a kontrolou limitu `MIN_PAUSE_MINUTES = 30`.
* **BR-03 (Cancellation policy):** Implementováno uvnitř metody `cancel_reservation`. Metoda kontroluje, zda je `current_time` před časem začátku.
* **BR-05 (Pracovní doba):** Vynuceno pomocí metody `_check_working_hours`, volané při `create_reservation`.
* **REQ-07 (Expirace žádostí):** Implementováno metodou `expire_old_reservations`, která překlápí `PENDING_APPROVAL` žádosti starší než 24 hodin do `EXPIRED`.
* **REQ-08 (Kontrola při schvalování):** Implementováno v metodě `approve_reservation`. Systém těsně před schválením (`is_approved=True`) znovu ověří kolize vůči již potvrzeným rezervacím.

### 2. Evoluce: Změna z v0.1 na v0.2
* **Změna stavů (models.py):** Stav `DRAFT` byl nahrazen za `PENDING_APPROVAL`. Byly přidány nové koncové stavy `REJECTED` (pro zamítnutí) a `EXPIRED` (vypršení).
* **Úprava byznys logiky (reservation_service.py):** Zanikla metoda `confirm_reservation`. Vznikla nová metoda `approve_reservation`, kterou ovládá tatér (parametr `is_approved`).
* **Nový architektonický driver (Časovač):** Pro splnění požadavku REQ-07 byla naprogramována metoda `expire_old_reservations`. Do budoucna (C03) se počítá s jejím automatizovaným spouštěním na pozadí.