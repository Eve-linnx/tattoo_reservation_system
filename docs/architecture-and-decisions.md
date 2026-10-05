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