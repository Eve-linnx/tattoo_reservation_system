# Project Frame

## Reservation domain
Rezervační systém pro tetovací studio. Klienti si rezervují časové sloty
u tatéra. V C01 pracujeme s jedním tatérem (resource), systém je ale
navržen tak, aby šlo v budoucnu přidat další tatéry.

## Purpose
Systém umožňuje klientům rezervovat si termín u tatéra online, bez nutnosti
telefonovat nebo psát zprávy. Tatérovi pomáhá udržet přehledný rozvrh
a zabránit dvojitým rezervacím nebo příliš těsně navazujícím termínům.

## Users / Stakeholders
- **Klient** – vytváří, případně ruší rezervaci
- **Tatér** – potvrzuje rezervace, spravuje svůj rozvrh
- **(Admin)** – volitelně, správa systému (mimo rozsah C01)

## Core concepts
- **Reservation** – rezervace konkrétního časového slotu u tatéra
- **Resource** – tatér (v C01 jeden konkrétní tatér)
- **User** – klient, který rezervaci vytváří

## Core operations
- Create reservation
- Confirm / approve reservation
- Cancel reservation
- Check availability

## Persistent state
**Reservation:**
- id
- resource_id (odkaz na tatéra)
- client_name / client_id
- start_time
- end_time
- status (DRAFT / CONFIRMED / CANCELLED)
- created_at

**Resource:**
- id
- name (jméno tatéra)

## State-changing operation
DRAFT → CONFIRMED (potvrzení rezervace tatérem)
CONFIRMED → CANCELLED (zrušení rezervace)

## Common business rule
Confirmed reservations for the same resource must not overlap.

## Domain-specific business rules
1. Mezi dvěma CONFIRMED rezervacemi stejného tatéra musí být minimální pauza
   30 minut (čas na úklid a přípravu pracoviště mezi klienty).
2. Rezervaci lze vytvořit pouze v rámci pracovní doby tatéra (work_start–work_end).
   Výchozí pracovní doba je 09:00–18:00. Rezervace začínající nebo končící mimo
   tento rozsah musí být odmítnuta.

## External / system boundary
Notification Service – po potvrzení rezervace se odešle notifikace
(e-mail/SMS) klientovi. V C01 řešeno jako stub/mock, ne reálná integrace.

## Assumption
Předpokládáme, že jeden tatér obsluhuje jednoho klienta najednou
(nejde tedy o studio s více křesly současně).

## Unknown
Zatím nevíme, jak přesně se bude řešit případ, kdy klient zruší rezervaci
na poslední chvíli (zda bude nějaká sankce, nebo jen status CANCELLED).

## Selected future pressure

**Category:** C – Changeability

**Concrete pressure:**
V budoucnu bude potřeba přidat více tatérů (více resources) a případně
i více typů služeb (piercing, konzultace) v rámci stejného systému.

**Why it is relevant to our reservation system:**
Resource je od začátku modelována jako samostatná entita oddělená od
Reservation. Pokud přibudou další tatéři, nebude nutné měnit datový
model – stačí přidat další záznamy do tabulky Resource a rozšířit API
o filtrování podle resource_id. V C01 tuto změnu neimplementujeme,
pouze zajišťujeme, aby ji šlo v budoucnu snadno provést.
