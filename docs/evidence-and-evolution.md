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
* **REQ-07 (Expirace žádostí):** **PARTLY.** Metoda `expire_old_reservations` překlápí `PENDING_APPROVAL` žádosti starší než 24 hodin do `EXPIRED`, ale v běžícím produktu ji nic nevolá (žádný endpoint ani job) – automatická expirace tedy neprobíhá. Řeší C08 CR-01 (`docs/intent-and-change.md`).
* **REQ-08 (Kontrola při schvalování):** Implementováno v metodě `approve_reservation`. Systém těsně před schválením (`is_approved=True`) znovu ověří kolize vůči již potvrzeným rezervacím.

### 2. Evoluce: Změna z v0.1 na v0.2
* **Změna stavů (models.py):** Stav `DRAFT` byl nahrazen za `PENDING_APPROVAL`. Byly přidány nové koncové stavy `REJECTED` (pro zamítnutí) a `EXPIRED` (vypršení).
* **Úprava byznys logiky (reservation_service.py):** Zanikla metoda `confirm_reservation`. Vznikla nová metoda `approve_reservation`, kterou ovládá tatér (parametr `is_approved`).
* **Nový architektonický driver (Časovač):** Pro splnění požadavku REQ-07 byla naprogramována metoda `expire_old_reservations`. Do budoucna (C03) se počítá s jejím automatizovaným spouštěním na pozadí.

## C03 — Architecture Evidence
**Architektonické pravidlo:** Doménová vrstva (`reservation_service.py`) nesmí nijak záviset na HTTP/Webovém frameworku (`FastAPI`).
**Kontrola:** Napsán automatizovaný test `test_architecture_service_does_not_depend_on_web_layer`, který parsuje AST strom souboru `reservation_service.py` a kontroluje, že se v něm nevyskytuje žádný import z FastAPI.
**Výsledek:** Test PASSED. Implementace splňuje návrh.

## C05 DD Verification Evidence

**Tests derived from DD:**
| DD element / decision | What must hold? | Test level | Test case |
|---|---|---|---|
| failure behavior | Rezervace mimo pracovní dobu (9-18) je zamítnuta. | unit | `test_create_outside_working_hours_throws_error` |
| failure behavior | Překryv s CONFIRMED rezervací vyhodí konflikt. | unit | `test_create_overlapping_confirmed_reservation_throws_error` |
| state transition | Úspěšné schválení změní stav na CONFIRMED. | unit | `test_approve_reservation_changes_state_to_confirmed` |
| state transition | Neodbavené žádosti starší 24h přejdou do EXPIRED. | unit | `test_expire_old_reservations_changes_status_to_expired` |
| failure behavior | Nelze zrušit (CANCEL) rezervaci, jejíž start_time již nastal. | unit | `test_cancel_after_start_time_throws_error` |

*Selected level logic:*
Zvolili jsme Unit testy na úrovni Service vrstvy s in-memory SQLite databází. Ověřujeme tím design rozhodnutí vložit veškerou byznys a stavovou logiku do `reservation_service.py` tak, aby byla plně odizolovaná od HTTP vrstvy.

**Unit/component tests executed:**
Ano, 5 testů spuštěno přes `pytest` (vše PASSED) na `v1.0-C05`. Po C06 doplněno 11 regresních testů v `src/test_c06_regression.py` (viz § C06).

**Design ↔ implementation mismatch:**
| DD decision | Implemented? | Evidence | Action |
|---|---|---|---|
| 30min hygienická pauza | YES | `reservation_service.py:_too_close` (pokryto jen kódem, test chybí – C06 D4) | keep, doplnit test |
| Pracovní doba 9:00 - 18:00 | YES | `reservation_service.py:_check_working_hours` | keep |
| Zákaz storna po startu | PARTLY na `v1.0-C05` → YES od `78c4c87` | service OK (`test_cancel_after_start_time_throws_error`), ale API předávalo `utcnow()` – C06 F3; po opravě `test_F3_*` | update code ✅ |
| Bezpečný přechod stavů (lifecycle) | NO na `v1.0-C05` → YES od `78c4c87` | cancel přepisoval `REJECTED`/`EXPIRED` na `CANCELLED` – C06 F2; po opravě `test_F2_*` | update code ✅ |
| Lock při schvalování (ADR-01) | NO na `v1.0-C05` → YES od `78c4c87` | zámek v kódu chyběl – C06 F1; po opravě `test_F1_*` | update code + update DD/ADR ✅ |
| Automatická expirace (REQ-07) | PARTLY | funkce existuje, nic ji nevolá | DEFER → C08 CR-01 |

**Resolution:**
~~Nebyly nalezeny žádné neshody mezi návrhovým záměrem a skutečnou implementací.~~ Toto tvrzení na `v1.0-C05` neplatilo – C06 assessment potvrdil tři neshody (F1–F3). Opraveny v `78c4c87`, DD aktualizováno (`architecture-and-decisions.md` § C05, revize). Podrobnosti viz § C06 níže.

**Remaining design risk:**
Kód currently neřeší notifikace klientovi (např. e-mail po změně stavu na CONFIRMED), což bude vyžadovat budoucí implementaci Observer patternu nebo event fronty, aby to neblokovalo hlavní HTTP thread.

**Commit/tag:**
v1.0-C05 (`592ec1b`) – původní stav; opravy `78c4c87` (větev `fix/c06-findings`).

---

## C06 Internal Evidence Assessment

**Assessed baseline:** `v1.0-C05` → `592ec1b` (Merge PR #11). Hodnotil tým Cinema Seat Reservation (Procházka, Ševeček, Adámek, Urban), formulář: `SWI_C06_Assessment_Form.md`.
**Fix baseline:** `78c4c87` (větev `fix/c06-findings`), reporting tag bude `v1.1-C08`.

**Verified findings:**
| ID | Source | Claim | Expected | Observed na `592ec1b` |
|---|---|---|---|---|
| F1 | C03 ADR-01, H1 + C02 REQ-04/BR-02 | Při souběžném schvalování kolidujících žádostí uspěje nejvýše jedna; zajišťuje DB lock | 1× `CONFIRMED`, 1× `ReservationConflictError` | obě `CONFIRMED`, `with_for_update` v kódu není (a na SQLite by nic nezamkl) |
| F2 | C02 stavový diagram 9b, OP-04 + C05 „Bezpečný přechod stavů“ | Do `CANCELLED` vede jen `PENDING_APPROVAL`/`CONFIRMED`; `REJECTED`/`EXPIRED` jsou koncové | cancel `REJECTED`/`EXPIRED` → zamítnuto | stav přepsán na `CANCELLED` |
| F3 | C02 BR-03, OP-04 | Zrušit lze jen při `now < start` | API cancel po začátku → HTTP 400 | API porovnávalo `utcnow()` s lokálním `start_time` → zrušení prošlo až 1 h (CET) / 2 h (CEST) po začátku |

**Owner disposition:**
| Finding | Disposition | Reason / evidence | Action / closure evidence |
|---|---|---|---|
| F1 | **ACCEPTED — change required** | Reprodukováno vlastním testem `test_F1_concurrent_approve_of_colliding_requests_at_most_one_confirmed` na `592ec1b`: FAIL (`[CONFIRMED, CONFIRMED]`). Souhlasíme i s doplňkem hodnotitele, že `with_for_update()` na SQLite nezamyká. | `78c4c87`: zámek řádku tatéra `_lock_resource()` + re-read stavu + rollback při chybě; ADR-01 revidováno, H1 a C05 DD aktualizovány. Test PASS; s vypnutým zámkem FAIL (test opravdu ověřuje zámek). |
| F2 | **ACCEPTED — change required** | Reprodukováno: `test_F2_cancel_of_terminal_state_is_refused[REJECTED/EXPIRED]` na `592ec1b` FAIL. | `78c4c87`: `CANCELLABLE_STATES` guard v `cancel_reservation()`; C05 decision table; activity diagram OP-04 doplněn. Testy PASS (+ pozitivní a idempotentní případy). |
| F3 | **ACCEPTED — change required** | Reprodukováno: `test_F3_api_cancel_after_start_is_refused` (TestClient nad `main.app`) na `592ec1b` FAIL; navíc `created_at` byl v UTC, ale `create` porovnával s lokálním časem. | `78c4c87`: všude lokální čas (`main.py` cancel, `models.py` `created_at`); rozhodnutí zapsáno v G4 a BR-*. Testy PASS včetně hranice `now == start`. |

**Actions / justified no-change decisions:**
- Vedle F1–F3 jsme z checklistu převzali i tato PARTLY/NO zjištění:
  - B2 (demo `test_spike.py` padá na pevném datu) → opraveno v `78c4c87`, viz § C07/C08 Ověření čistého spuštění;
  - R3/R4 (spec stále mluví o `DRAFT`) → spec aktualizována na `PENDING_APPROVAL`, OP-03 označena jako superseded;
  - D1 (DD neobsahuje Cancel/Expire, odkaz na zaniklou OP-03) → C05 DD revidováno;
  - odkazy na řádky v C03 Části A → nahrazeny odkazy na funkce.
- **A2 – Check Availability ve frontendu:** ACCEPTED — no immediate change. Backend pravidla BR-02/BR-04 vynucuje při create i approve, invariant tedy není ohrožen; frontend je jen přísnější (blokuje i `PENDING_APPROVAL`, 24 h předstih). Zapsáno jako známá odchylka (`architecture-and-decisions.md` § N) a riziko.
- **Q1–Q3 (C04 N/A):** souhlasíme – zadání C04 Quality & Measurement nebylo; sekce „C04 — Část B–M“ přejmenována na pokračování C03.

**Remaining evidence gaps:**
- REQ-07: automatická expirace v produktu neprobíhá → C08 CR-01.
- D4: `_too_close` (pauza), `end <= start`, rezervace v minulosti, neznámý tatér a reject větev nemají vlastní unit test (kód je podle hodnotitele správně, chybí evidence).
- D5: `test_cancel_after_start_time_throws_error` testuje `start + 10 min` a `PENDING_APPROVAL`; hranici `now == start` a `CONFIRMED` nyní pokrývá `test_F3_service_cancel_exactly_at_start_is_refused`.
- Autorizace: schválit/zrušit může kdokoli se znalostí ID (spec předpokládá autorizovaného tatéra) – známé omezení mimo rozsah CP1.
- Zámek z ADR-01 je ověřen na SQLite; na PostgreSQL ověřen není (runtime projektu je SQLite).

---

## C07/C08 — Ověření čistého spuštění podle README (P4)

**Baseline:** `78c4c87` (větev `fix/c06-findings`), datum 2026-11-05.
**Postup:** kopie repozitáře (jen soubory sledované gitem, bez `*.db`, `venv`, `node_modules`) do prázdného adresáře + nové virtuální prostředí, pak kroky README v pořadí.
**Prostředí:** Windows 11, Python 3.14.3, Node 24.15.0 / npm 11.12.1. Nainstalováno z `requirements.txt` (bez pinů): fastapi 0.162.0, starlette 1.10.0, SQLAlchemy 2.1.8, pydantic 2.14.3, uvicorn 0.54.0, pytest 9.2.0, httpx 0.28.1.

| # | Krok README | Příkaz | Výsledek |
|---|---|---|---|
| 1 | Instalace závislostí (z kořene) | `pip install -r requirements.txt` | PASS |
| 2 | Testy | `cd src && pytest -v` | PASS – 17/17 (6 C03/C05 + 11 C06) |
| 3 | Demo | `cd src && python test_spike.py` | PASS – create → reject → approve → expire → cancel |
| 4 | Backend | `cd src && uvicorn main:app` | PASS – `GET /resources` vrací 2 tatéry; `POST /reservations` → `PENDING_APPROVAL`; `/approve` → `CONFIRMED`; `/cancel` → `CANCELLED`; opakovaný `/cancel` → `CANCELLED` (idempotence) |
| 5 | Frontend | `cd frontend && npm install && npm run build` | PASS – build bez chyb (`npm run dev` ověřen nebyl, jde o dlouhodobě běžící server) |

**Nalezené problémy a opravy (vše v `78c4c87`):**
| Problém | Dopad | Oprava |
|---|---|---|
| `test_spike.py` mělo natvrdo datum 10. 10. 2026 (v minulosti) | demo padalo `ValueError: Nelze vytvořit rezervaci v minulosti` (C06 B2) | data relativní k dnešku (+7 dní) |
| Demo padalo `UnicodeEncodeError` na Windows konzoli s kódováním cp1252 | demo nešlo spustit v běžném terminálu / při přesměrování výstupu | `sys.stdout.reconfigure(encoding="utf-8")` |
| README sekce 3: `pip install` uvedeno „ve složce src“ (soubor je v kořeni), chyběl konec bloku kódu | instalace podle README selže, zbytek README se vykreslil jako kód | přepsáno, demo přesunuto do sekce 4 |
| Chyběla závislost `httpx` | API testy (FastAPI `TestClient`) na čistém prostředí nejdou spustit | přidáno do `requirements.txt` |

**Zbývající riziko:** `requirements.txt` nemá pevné verze – čisté prostředí nainstalovalo novější verze než vývojové (FastAPI 0.162 vs. 0.141) a testy prošly, ale budoucí verze mohou chování změnit (např. zastaralé `@app.on_event`).
