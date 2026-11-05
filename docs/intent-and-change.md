# Project Frame

## Reservation domain
Rezervační systém pro tetovací studio. Klienti si rezervují časové sloty u tatéra. Systém spravuje více tatérů, každý má svůj vlastní kalendář.

## Purpose
Systém umožňuje klientům rezervovat si termín u tatéra online, bez nutnosti telefonovat nebo psát zprávy. Tatérovi pomáhá udržet přehledný rozvrh a zabránit dvojitým rezervacím nebo příliš těsně navazujícím termínům.

## Users / Stakeholders
- **Klient** – vytváří, případně ruší rezervaci
- **Tatér** – schvaluje rezervace (Approve/Reject), spravuje svůj rozvrh
- **(Admin)** – volitelně, správa systému (mimo rozsah C01)

## Core concepts
- **Reservation** – rezervace konkrétního časového slotu u tatéra
- **Resource** – tatér 
- **User** – klient, který rezervaci vytváří

## Core operations
- Create reservation
- Approve / reject reservation (schválení tatérem)
- Cancel reservation
- Check availability

## Persistent state
**Reservation:**
- id
- resource_id (odkaz na tatéra)
- client_name / client_id
- start_time
- end_time
- status (PENDING_APPROVAL / CONFIRMED / CANCELLED / REJECTED / EXPIRED)
- created_at

**Resource:**
- id
- name (jméno tatéra)

## State-changing operation
PENDING_APPROVAL → CONFIRMED (schválení rezervace tatérem)
PENDING_APPROVAL / CONFIRMED → CANCELLED (zrušení rezervace klientem nebo tatérem)

## Common business rule
Confirmed reservations for the same resource must not overlap.

## Domain-specific business rules
1. Mezi dvěma CONFIRMED rezervacemi stejného tatéra musí být minimální pauza 30 minut (čas na úklid a přípravu pracoviště mezi klienty).
2. Rezervaci lze vytvořit pouze v rámci pracovní doby tatéra (work_start–work_end). Výchozí pracovní doba je 09:00–18:00. Rezervace začínající nebo končící mimo tento rozsah musí být odmítnuta.

## External / system boundary
Notification Service – po schválení nebo zrušení rezervace se odešle notifikace (e-mail/SMS) klientovi. V C01 řešeno jako stub/mock, ne reálná integrace.

## Assumption
Předpokládáme, že jeden tatér obsluhuje jednoho klienta najednou (nejde tedy o studio s více křesly současně).

## Unknown
Zatím nevíme, jak přesně se bude řešit případ, kdy klient zruší rezervaci na poslední chvíli (zda bude nějaká sankce, nebo jen status CANCELLED).

## Selected future pressure

**Category:** C – Changeability

**Concrete pressure:**
V budoucnu bude potřeba přidat více tatérů (více resources) a případně i více typů služeb (piercing, konzultace) v rámci stejného systému.

**Why it is relevant to our reservation system:**
Resource je od začátku modelována jako samostatná entita oddělená od Reservation. Pokud přibudou další tatéři, nebude nutné měnit datový model – stačí přidat další záznamy do tabulky Resource a rozšířit API o filtrování podle resource_id. Tento tlak na změnu (přidání více tatérů) byl již úspěšně realizován a integrován do aktuální verze. Architektura potvrdila svou flexibilitu.

---

## C08 / CR-01 — Controlled Change Card: automatické vypršení nevyřízené žádosti (REQ-07)

**Request source and concrete project need:**
Tatér (stakeholder) a C06 assessment / vlastní ověření P4: REQ-07 slibuje, že žádost, kterou tatér neposoudí do 24 hodin, vyprší (`EXPIRED`). V běžícím produktu se to neděje – `expire_old_reservations()` nic nevolá. Důsledek: tatér může schválit žádost stará několik dní, kterou klient už nečeká, a klient dostane závazný termín, se kterým nepočítá.

**Before commit/tag + spec/BR/ADR + schema/config:**
- baseline: `230c45b` (větev `docs/c06-c08-sync`; kód = `78c4c87`), detail v `docs/evidence-and-evolution.md` § C08 Krok 0;
- spec: REQ-07 (`docs/spec/reservation-approve.md`), stavový diagram 9b (`PENDING_APPROVAL → EXPIRED`), BR-02/BR-04, BR-03;
- architektura: G2/G3 (Expiration trigger = PLÁNOVÁNO), J (Expirace = DEFER → CR-01), ADR-01 (zámek tatéra v `approve_reservation`);
- schéma: tabulka `reservations` se sloupcem `created_at` (DateTime, lokální čas od `78c4c87`), bez migrací (`Base.metadata.create_all`);
- konfigurace: limit 24 h natvrdo v `expire_old_reservations()` (`timedelta(hours=24)`).

**Old accepted behavior / observable limitation:**
`PENDING_APPROVAL` žádost zůstává čekající neomezeně dlouho a lze ji kdykoli schválit (pokud nekoliduje). `expire_old_reservations()` existuje a je pokrytá unit testem, ale v produktu ji nikdo nespouští.

**New intended behavior, scope, out of scope:**
- Žádost, od jejíhož vytvoření (`created_at`) uplynulo 24 h a více, **nesmí být schválena** a je uložena jako `EXPIRED`.
- Klient i tatér uvidí `EXPIRED` v seznamu rezervací (`GET /reservations`) poté, co se o schválení někdo pokusí.
- **Mimo rozsah:** notifikace klientovi o vypršení; konfigurovatelný limit; nový worker proces (není rozhodnuto, viz Options).

**Acceptance conditions:**
| AC | Typ | Podmínka |
|---|---|---|
| AC-01 | pozitivní | Schválení žádosti stáří 23:59 h, která nekoliduje, uspěje → `CONFIRMED`. |
| AC-02 | negativní | Pokus o schválení žádosti stáří 24:01 h nevytvoří `CONFIRMED`; žádost je po pokusu uložena jako `EXPIRED` a volající dostane odmítnutí (HTTP 400 s důvodem). |
| AC-03 | hranice | Přesně `created_at + 24:00:00` = **vypršeno** (shodně se současným `expire_old_reservations`: `created_at <= now - 24 h`). Pozn.: REQ-07 říká „déle než 24 hodin“ → text REQ-07 se upraví na „24 hodin a déle“. |
| AC-04 | regrese | BR-02/BR-04 dál platí: TC-C08-01/02 PASS; souběžné schválení (F1) dál nejvýše jedno `CONFIRMED`. |
| AC-05 | regrese | Zamítnutí (`REJECTED`) a zrušení (`CANCELLED`) čekající žádosti mladší než 24 h fungují beze změny. |
| AC-06 | časová báze | Stáří se počítá v lokálním čase studia, stejně jako `created_at` a „now“ v API (rozhodnutí k F3). |

**Impact analysis method / evidence reviewed:**
Od pozorovatelného pravidla AC-02 jsme šli k vlastníkovi rozhodnutí (G3: Reservation Service), pak po volání a datech: `main.api_approve_reservation` → `reservation_service.approve_reservation` → `Reservation.created_at` / `status` → konzumenti stavu (`GET /reservations`, frontend admin sekce, `cancel_reservation`, `check_availability`). Prošli jsme všechny writer paths stavu: `create_reservation`, `approve_reservation`, `cancel_reservation`, `expire_old_reservations` (`grep "status =" src/`). Worker, import ani admin DB nástroj v projektu nejsou.

| Dimension / exact artifact | CHANGE/CHECK/NO IMPACT + why | Needed delta/verification | Owner/evidence |
|---|---|---|---|
| Spec/BR/state: REQ-07, `reservation-approve.md`, diagram 9b | **CHANGE** – upřesnit hranici (AC-03) a že vypršení se projeví nejpozději při pokusu o schválení | text REQ-07 „24 h a déle“; poznámka u přechodu `expire` v 9b | Rechbergová / review spec |
| Architecture/ownership/interfaces: G2, G3, J | **CHANGE** – Expiration trigger = guard v `approve_reservation` (ne samostatný job); owner zůstává Reservation Service | aktualizovat G2/G3/J | Rechbergová / review architektury |
| ADR-01 (zámek) | **CHECK** – guard musí běžet pod stejným zámkem, aby nevznikl race schválení × vypršení | ověřit pořadí: zámek → refresh → guard stáří → guard stavu | test AC-02 + F1 regrese |
| Detailed design/code: `approve_reservation` | **CHANGE** – nový parametr `current_time`, guard stáří, zápis `EXPIRED` + commit, nová výjimka `ReservationExpiredError` | kontrakt v C05 DD; API předá `datetime.now()` | unit testy 23:59 / 24:00 / 24:01 |
| API: `main.py` approve endpoint | **CHANGE** – předat `datetime.now()`, převést `ReservationExpiredError` na HTTP 400 | integrační test přes TestClient | test AC-02 |
| `expire_old_reservations` | **CHECK** – zůstává (demo, budoucí worker); musí používat stejnou definici hranice | sdílet podmínku stáří (jedna helper funkce) | unit test 4 dál PASS |
| `cancel_reservation` | **CHECK** – čekající žádost starší 24 h lze dnes zrušit; podle 9b je to `PENDING_APPROVAL → CANCELLED`, což je přípustné | NO CHANGE (rozhodnutí: storno vypršelé žádosti nevadí) | test AC-05 |
| `check_availability` / frontend | **CHECK** – backend: `PENDING_APPROVAL` ani `EXPIRED` kapacitu neblokují → NO IMPACT. Frontend ale blokuje sloty i kvůli `PENDING_APPROVAL` (odchylka § N) → **stará nevyřízená žádost bude v UI blokovat slot, dokud ji někdo nezkusí schválit**; `EXPIRED` už neblokuje | přijmout jako důsledek Option A, nebo v UI ignorovat `PENDING_APPROVAL` starší 24 h (mimo rozsah CR-01) | kód `App.jsx` `isColliding` |
| Data/schema/migration | **CHECK** – schéma beze změny; **řádky vytvořené před `78c4c87` mají `created_at` v UTC** → v CET vypadají o 1 h starší a vyprší o 1 h dřív | přijmout (demo data) nebo jednorázově přičíst offset; rozhodnutí: přijmout, zapsat do release poznámky | release záznam C09 |
| Configuration/CI/release | **CHECK** – limit 24 h zůstává konstanta; časová zóna serveru = Europe/Prague (předpoklad G4) | zdokumentovat konstantu v README/DD | README |
| Tests/integration/risks | **CHANGE** – nové testy AC-01..03 před implementací; regrese TC-C08-01/02, F1–F3 | test oracle z AC, ne z kódu | `src/test_c08_cases.py`, `src/test_c06_regression.py` |
| Operation/recovery | **CHECK** – změna je reverzibilní (revert commitu); `EXPIRED` je koncový stav, vypršelou žádost nelze obnovit | rollback = revert; omylem vypršelá žádost → klient vytvoří novou | release záznam C09 |
| Uživatel | **CHECK** – stará žádost nezmizí sama, změní se až při pokusu o schválení | akceptovat stakeholderem (Options) | rozhodnutí níže |

**Alternatives and comparable criteria:**
| Option | Meets AC? | Benefit | Cost/failure/rollback | Verification |
|---|---|---|---|---|
| **A: líná expirace při schvalování** – guard stáří v `approve_reservation` pod zámkem ADR-01, uloží `EXPIRED` | AC-01..06 ano; seznam ukazuje `PENDING_APPROVAL`, dokud se o schválení nikdo nepokusí | malá změna v existujícím ownerovi; žádný nový proces; žádný race (stejný zámek) | stará žádost „visí“ v seznamu; rollback = revert jednoho commitu | unit 23:59/24:00/24:01 + API test + regrese F1, TC-C08-01/02 |
| **B: worker + guard** – periodické volání `expire_old_reservations` (FastAPI background task / scheduler) + guard z A | ano, a seznam je aktuální i bez interakce | fronta tatéra se čistí sama | nový provozní prvek (scheduler v procesu uvicornu, restart, chyby jobu), race job × approve (nutný stejný zámek), testování času | A + test jobu s injektovaným časem + restart scénář |
| **C: bez automatické expirace** – REQ-07 jen ručním rozhodnutím tatéra (zamítnout staré) | ne – AC-02 nesplní | nulová změna kódu | stará žádost jde dál schválit (původní problém); vyžaduje změnu REQ-07 a souhlas stakeholdera | review procesu |

**Inaction consequences / feasible compensation:**
Tatér může potvrdit dávno nečekaný termín → klient nepřijde, tatér přijde o slot. Kompenzace bez kódu: tatér ručně zamítá žádosti starší než 24 h (Option C) – nespolehlivé.

**Peer reviewer and challenged assumption:**
[doplnit jméno spolužáka mimo tým] – zpochybněný předpoklad: „stačí líná expirace, protože jediný konzument rozhodnutí je schválení“. Ověřit, že žádný jiný konzument (seznam pro klienta) nepotřebuje `EXPIRED` dřív.

**Decision ACCEPT / REJECT / DEFER / NO_CHANGE, owner, date, reason:**
**ACCEPT – Option A**, owner: Rechbergová, 2026-11-05. Důvod: splňuje pozorovatelný kontrakt REQ-07 („nesmí být potvrzena“) nejmenší změnou v existujícím ownerovi rozhodnutí a pod stejným zámkem jako F1, takže nevzniká nový race ani nový provozní prvek. Za podmínky, že tým (role tatéra) přijme, že žádost se v seznamu změní na `EXPIRED` až při pokusu o schválení (neproaktivně). Option B zůstává kandidátem, pokud bude potřeba proaktivní čištění fronty.

**If ACCEPT: smallest change and acceptance tests to perform in C09:**
- delta: `approve_reservation(db, id, is_approved, current_time)` – po zámku a refresh: je-li `PENDING_APPROVAL` a `created_at <= current_time - 24 h` → `status = EXPIRED`, `commit`, `raise ReservationExpiredError`; `main.py` předá `datetime.now()` a vrátí HTTP 400; podmínku stáří sdílet s `expire_old_reservations`; upravit REQ-07, 9b, G2/G3/J, C05 DD.
- nové testy (napsat před implementací): stáří 23:59 → `CONFIRMED`; přesně 24:00 → `EXPIRED` + odmítnutí; 24:01 → `EXPIRED` + odmítnutí; API: approve vypršelé → 400 a v DB `EXPIRED`; zamítnutí (`is_approved=False`) vypršelé žádosti → `EXPIRED` (ne `REJECTED`).
- regrese: TC-C08-01/02, `test_c06_regression.py` (F1–F3), `test_reservation_service.py`.
- C09 handoff: commit/PR změny, integrační běh, clean checkout podle README, rozhodnutí o releasu (`v1.2-C09`).

**If NO_CHANGE/REJECT:** N/A.

**Open uncertainty and next trigger:**
- Řádky s `created_at` v UTC z doby před `78c4c87` vyprší o 1 h dřív – trigger: produkční data (zatím jen demo).
- Pokud stakeholder bude chtít, aby vypršelé žádosti zmizely ze seznamu bez interakce → znovu otevřít, Option B.
