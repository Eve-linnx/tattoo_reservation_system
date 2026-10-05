# Architecture and Decisions

## Zvolený stack
- **Jazyk:** Python 3.11+
- **Framework:** FastAPI
- **ORM / databáze:** SQLAlchemy + SQLite (pro C01 stačí, v případě potřeby
  lze bez velkých změn přepnout na PostgreSQL, protože SQLAlchemy
  abstrahuje konkrétní databázi)
- **Testování:** pytest

## Zdůvodnění
- FastAPI je jednoduché na naučení, má automatickou validaci vstupů
  (pomocí Pydantic) a rovnou generuje API dokumentaci (Swagger UI),
  což se hodí pro walking skeleton (POST /reservations).
- SQLite nevyžaduje žádnou instalaci navíc, takže je ideální pro
  reproducible build (spike C by šel snadno udělat) i pro rychlé
  ověření persistence (spike A).
- SQLAlchemy umožňuje definovat modely jako Python třídy, což je
  přehledné a odpovídá doménovému modelu z Project Frame.

Future pressure (Q/C/R/L) je definována v [intent-and-change.md](intent-and-change.md)
jako součást Project Frame.

---

## Dopad změny C02 (Přechod na Baseline v0.2)

**Změněná podmínka:** 
Některé zdroje (Tatér) vyžadují schválení oprávněnou osobou dříve, než se rezervace může stát CONFIRMED. Schválení může být opožděno, zamítnuto, nebo může vypršet.

**Dotčené požadavky / části specifikace:**
- **OP-01 (Create):** Po vytvoření klientem už rezervace nepřechází do DRAFT, ale do nového stavu `PENDING_APPROVAL` (čeká na vyjádření tatéra).
- **OP-03 (Confirm):** Samostatné potvrzování klientem jakožto operace OP-03 zaniká/slučuje se s procesem schválení. Potvrzení (CONFIRMED) se stává přímým důsledkem úspěšného schválení tatérem.
- **OP-04 (Cancel):** Musí být umožněno zrušit i rezervaci ve stavu `PENDING_APPROVAL`.

**Nedotčené požadavky / části + proč:**
- **OP-02 (Check Availability):** Nemění se. `PENDING_APPROVAL` stav zatím závazně neblokuje dostupnost (stejně jako původní DRAFT), aby systém umožnil souběžný sběr žádostí od vícero klientů pro stejný čas. Kapacitu blokuje až stav `CONFIRMED`.
- **Společná pravidla (BR-01 až BR-05):** Zůstávají stejná. Kolize, pauzy (BR-04) a čas zrušení (BR-03) se nadále počítají stejně.

**Nový aktér / operace, pokud vznikne:**
- Vzniká nová operace **OP-05 Approve Reservation** (Schválení rezervace). Oprávněným aktérem je Tatér. Tatér v ní žádost buď schválí (přejde do CONFIRMED), nebo zamítne (přejde do REJECTED).

**Změněná pravidla / význam stavů:**
- Místo stavu DRAFT se zavádí `PENDING_APPROVAL` (čeká na tatéra, neblokuje kapacitu exkluzivně).
- Přidán stav `REJECTED` (tatér žádost zamítl).
- Přidán stav `EXPIRED` (tatér nestihl zareagovat včas a požadavek vypršel).

**Změna diagramu případů užití:**
- Přibude cíl „Schválit žádost (Approve)“ pro aktéra Tatér.

**Změna stavového diagramu:**
- Místo DRAFT se zavádí PENDING_APPROVAL.
- Přibydou větve pro zamítnutí (REJECTED) a vypršení (EXPIRED).

**Nové příklady ověření:**
- Tatér schválí PENDING_APPROVAL → stav CONFIRMED.
- Tatér zamítne PENDING_APPROVAL → stav REJECTED.
- Uplyne 24 hodin bez reakce tatéra → stav EXPIRED.

**Architektonické drivery pro C03:**
- **Časovač / Background Job:** Systém musí obsahovat asynchronní proces (např. cron job nebo task queue), který bude pravidelně kontrolovat staré `PENDING_APPROVAL` žádosti a automaticky je překlápět do `EXPIRED`.
- **Externí notifikace:** Nutnost asynchronně posílat tatérovi upozornění na novou žádost ke schválení (Notification Service).

---

## C03 — Část A: AS-IS mapování scénáře Approve Reservation

### A1. Jaký scénář sledujeme

Sledujeme operaci **Approve Reservation (OP-05)**, konkrétně schvalovací větev, kdy tatér žádost potvrdí (`is_approved=True`). Týká se požadavků **REQ-06** a **REQ-08**, vynucuje pravidla **BR-02** a **BR-04**, vše v rámci **Baseline v0.2**.

### A2. Jak hlavní průchod scénáře vypadá v kódu

Celý scénář se odehrává v jediné funkci `approve_reservation()` v `src/reservation_service.py`. Žádná API/controller vrstva v projektu zatím neexistuje — v aktuální implementaci se funkce volá přímo z kódu, konkrétně z demo skriptu `src/test_spike.py` (řádek 55: `approve_reservation(db, r1.id, is_approved=True)`).

Jednotlivé kroky scénáře probíhají takto:

1. **Přijetí požadavku na schválení** — zavolá se `approve_reservation(db, reservation_id, is_approved=True)` (`reservation_service.py:112`).
2. **Načtení rezervace** — `db.query(Reservation).get(reservation_id)` (řádek 116).
3. **Ověření, že přechod je povolený** — funkce zkontroluje, že rezervace existuje a je ve stavu `PENDING_APPROVAL`; jinak vyhodí `ValueError` (řádky 117–121).
4. **Vyhodnocení konfliktu (BR-02/BR-04)** — najdou se všechny `CONFIRMED` rezervace stejného tatéra a porovnají se pomocí `_overlaps()` a `_too_close()` (řádky 130–140).
5. **Změna stavu** — pokud žádný konflikt nenastal, `reservation.status` se přepíše na `CONFIRMED` (řádek 142).
6. **Uložení výsledku** — `db.commit()` a `db.refresh(reservation)` (řádky 143–144).

### A3. Jedna důležitá chybová větev: konflikt při schvalování

Co se stane, když tatér chce schválit žádost, ale mezitím už potvrdil jinou rezervaci na stejný/kolidující čas?

- **Co k tomu říká v0.2:** při kolizi se schválení zamítne (OP-05, alternativní výsledky).
- **Kde se to pozná:** přímo v `approve_reservation()` — dotaz na existující `CONFIRMED` rezervace a test `_overlaps()`/`_too_close()` (řádky 130–140).
- **Kde se rozhodne výsledek:** na stejném místě — jakmile se najde konflikt, hned se vyhodí `raise ReservationConflictError(...)`, ještě před jakýmkoliv zápisem do databáze.
- **Co dostane volající:** Python výjimku `ReservationConflictError`. Rezervace samotná zůstane ve stavu `PENDING_APPROVAL`, protože k `db.commit()` se vůbec nedostane.

**Rozdíl mezi specifikací a implementací, který jsme při tom objevili:**
Specifikace (`docs/spec/reservation-approve.md`, řádek 39) píše, že při kolizi "rezervace **může být tatérem rovnou zamítnuta**" — tedy že po neúspěšném schválení by mohlo/mělo logicky následovat zamítnutí (přechod do `REJECTED`). Kód to ale takhle nedělá: po vyhození výjimky se nic automaticky nezmění, rezervace zůstává viset v `PENDING_APPROVAL`. Aby se dostala do `REJECTED`, musí někdo zavolat `approve_reservation()` znovu, tentokrát s `is_approved=False` (řádky 123–127). Automatická návaznost mezi "konflikt" a "zamítnuto" v kódu chybí.

### A4. Hlavní části implementace, které scénář realizují

Scénář prochází čtyřmi částmi kódu (žádná API vrstva zatím neexistuje, takže jich je méně než v typickém webovém projektu):

- **Approve Entry Point** — v tuto chvíli jen přímé volání funkce z `test_spike.py: main()` (řádky 49–56). Spouští schválení/zamítnutí.
- **Reservation Service** — modul `reservation_service.py`, funkce `approve_reservation`, `_overlaps`, `_too_close` (řádky 25–45, 112–145). Ověří přechod, zkontroluje konflikt a rozhodne o výsledku.
- **Reservation Domain Model** — třídy `Reservation` a `ReservationStatus` v `models.py` (řádky 25–31, 46–58). Nesou stav a data rezervace, které se v tomto scénáři mění.
- **Persistence (SQLAlchemy Session)** — objekt `db: Session`, který service používá přímo (`db.query`, `db.commit`, `db.refresh`, řádky 116, 130–134, 143–144). Žádná samostatná repository třída v projektu není.

### A5. Kde je stav, kde se mění a kde se vynucuje pravidlo

**Stav rezervace** je trvale uložen ve sloupci `status` (typ `Enum(ReservationStatus)`) v tabulce `reservations` v SQLite databázi (`models.py:55`, `test_spike.py:21`). O přechod `PENDING_APPROVAL → CONFIRMED` se stará jen jedna funkce — `approve_reservation()` v `reservation_service.py` (řádky 130–144), která zároveň rozhoduje (kontroluje konflikt) i provádí zápis.

**Pravidlo BR-02** (dvě `CONFIRMED` rezervace stejného tatéra se nesmí překrývat) se v tomto scénáři zjišťuje a vyhodnocuje na stejném místě — v `approve_reservation()`, řádky 130–138. Důležité zjištění: **stejná kontrola konfliktu je v kódu duplikovaná na třech místech** — kromě `approve_reservation()` ještě v `create_reservation()` (řádky 88–92) a v `check_availability()` (řádky 195–197, tam jen informativně, bez zápisu). Výsledná změna stavu (zápis `CONFIRMED`) se ale provádí jen v `approve_reservation()`, řádek 142.

### A6. Jaké závislosti scénář skutečně používá

- **Databáze (SQLite):** service dostává `db: Session` jako parametr a pracuje s ním přímo (`db.query/.commit/.refresh`); mapování na tabulky definuje `models.py`. Žádná vlastní vrstva repository mezi service a SQLAlchemy není.
- **Notification Service:** v kódu tohoto scénáře se **nikde nevolá** — je to jen plánovaný budoucí driver zmíněný výše v tomto dokumentu, reálně zatím neimplementovaný.
- **IdP / autentizace:** také **se nepoužívá** — `approve_reservation()` nijak nekontroluje, kdo volání dělá; kdokoliv se znalostí `reservation_id` může schválení/zamítnutí provést.

### A7. AS-IS strukturální diagram

```
+---------------------------- Application code -----------------------------+
|                                                                            |
|  [Approve Entry Point]                           (module / script)       |
|  role: spouští approve/reject; žádná HTTP/API vrstva neexistuje          |
|          | approve_reservation(id, is_approved)                         |
|          v                                                                |
|  [Reservation Service]                            (module)               |
|  role: ověří přechod, zkontroluje konflikt (BR-02/BR-04), rozhodne       |
|          | load/save Reservation (via Session)                          |
|          v                                                                |
|  [Reservation Domain Model]                        (class)               |
|  role: nese stav (ReservationStatus) a data rezervace                   |
|          |                                                                |
|          v                                                                |
|  [Persistence: SQLAlchemy Session]                 (framework object)    |
|  role: provádí SQL dotazy, commit, refresh                               |
|                                                                            |
+----------------------------------------------------------------------------+
        | SQL read/write (SELECT / UPDATE)
        v
 [SQLite DB: spike_test.db]                          (database)
```

```
Approve Entry Point:
- test_spike.py: main()

Reservation Service:
- reservation_service.approve_reservation
- reservation_service._overlaps
- reservation_service._too_close

Reservation Domain Model:
- models.Reservation
- models.ReservationStatus

Persistence:
- sqlalchemy.orm.Session (db)
- sqlalchemy.create_engine (test_spike.py setup)
```

### A8. Otázka pro další C03

**Otázka:** Mohou dva souběžné požadavky na schválení dvou kolidujících `PENDING_APPROVAL` rezervací stejného tatéra oba projít kontrolou konfliktu a oba skončit jako `CONFIRMED`?

**Doklad:** V `approve_reservation()` jsou kontrola kolize (dotaz na `CONFIRMED` rezervace, řádky 130–134) a zápis nového stavu (`commit`, řádky 142–144) dva oddělené kroky. Mezi nimi není žádný zámek, transakční izolace typu "SELECT ... FOR UPDATE" ani verzovací sloupec, které by druhému souběžnému volání zabránily proklouznout mezitím.

**Proč je důležitá:** BR-02 musí platit i při souběžném schvalování dvou kolidujících žádostí na stejný čas. Samotná specifikace pravidel (`docs/spec/reservation-rules.md`, řádky 24–25) tuto situaci přímo zmiňuje — "při souběžném potvrzování kolidujících návrhů může uspět nejvýše jeden pokus" — ale implementace žádný mechanismus, který by to zaručil, zatím neobsahuje.