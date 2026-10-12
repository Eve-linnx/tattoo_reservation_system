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