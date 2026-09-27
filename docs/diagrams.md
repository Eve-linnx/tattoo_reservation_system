# Diagramy — Baseline v0.1

Tento dokument doplňuje textovou specifikaci (`reservation-create.md`,
`reservation-check-availability.md`, `reservation-confirm.md`,
`reservation-cancel.md`, `reservation-rules.md`) o vizuální pohled na
systém.

---

## 9a — Diagram případů užití

Aktéři:
- **Klient** — vytváří rezervaci, zjišťuje dostupnost, ruší rezervaci.
- **Tatér** — potvrzuje rezervaci, může rezervaci zrušit.
- **Notification Service** — podpůrný externí aktér; dostává podnět po
  potvrzení rezervace. Není to interní komponenta, proto je v diagramu.

```mermaid
flowchart LR
    Klient(["Klient"])
    Tater(["Tatér"])
    Notifikace(["Notification Service\n(externí, podpůrný)"])

    subgraph System["Rezervační systém – tetovací studio"]
        direction TB
        UC1(["Vytvořit rezervaci"])
        UC2(["Zjistit dostupnost"])
        UC3(["Potvrdit rezervaci"])
        UC4(["Zrušit rezervaci"])
    end

    Klient --> UC1
    Klient --> UC2
    Klient --> UC4
    Tater --> UC3
    Tater --> UC4
    UC3 -.notifikace po potvrzení.-> Notifikace
```

Poznámky ke konzistenci:
- Čtyři cíle odpovídají přesně čtyřem operacím OP-01 až OP-04.
- Cancel má oba aktéry (Klient i Tatér), protože specifikace (BR-03)
  neomezuje zrušení jen na klienta — pokud by to tak v doméně nemělo být,
  je potřeba to v textu explicitně říct a diagram podle toho zúžit.
- Notification Service je jen navázaný na Confirm, ne na ostatní operace,
  protože to tak popisuje `intent-and-change.md`. Nejde o `include`/`extend`,
  jen o vazbu na externí systém.

---

## 9b — Stavový diagram životního cyklu Reservation

```mermaid
stateDiagram-v2
    [*] --> DRAFT : create (OP-01)

    DRAFT --> CONFIRMED : confirm [REQ-03: aktivní Resource,\nžádná kolize podle BR-02/BR-04]
    DRAFT --> CANCELLED : cancel [REQ-05: now < start]
    CONFIRMED --> CANCELLED : cancel [REQ-05: now < start]

    note left of DRAFT
        confirm zamítnuto (kolize / neplatný
        zdrojový stav) → stav zůstává DRAFT,
        proto v diagramu není žádná šipka zpět.
    end note

    note right of CANCELLED
        Opakované cancel na již CANCELLED
        rezervaci je dle BR-03 idempotentní
        úspěch — stav se nemění, proto
        v diagramu není smyčka CANCELLED→CANCELLED.
    end note
```

Kontrola konzistence s textem:
- Text (OP-04, BR-03) umožňuje zrušit DRAFT i CONFIRMED před `start` →
  diagram má obě šipky do CANCELLED. 
- Text nedovoluje cancel po/při `start` a nedovoluje confirm zpět do DRAFT
  → diagram žádné takové přechody nekreslí. 
- CANCELLED je koncový stav (žádné další přechody z něj nevedou).

---

## 9c — Diagramy aktivit

### OP-01 — Create Reservation

```mermaid
flowchart TD
    A([Start: Klient zadá tatéra a interval]) --> B{Je uživatel autorizován?}
    B -- Ne --> X1[Zamítnuto — rezervace nevznikne]
    B -- Ano --> C{Tatér existuje?}
    C -- Ne --> X1
    C -- Ano --> D{start < end a interval v pracovní době? BR-05}
    D -- Ne --> X1
    D -- Ano --> Ff{Koliduje s CONFIRMED rezervací? BR-02/BR-04}
    Ff -- Ano --> X1
    Ff -- Ne --> G[Vytvoř rezervaci ve stavu DRAFT]
    G --> H([Vrať ID rezervace a stav DRAFT])
    X1 --> E([Konec])
    H --> E
```

### OP-02 — Check Availability

```mermaid
flowchart TD
    A([Start: dotaz na dostupnost tatéra + interval]) --> B{Tatér existuje a interval je platný?}
    B -- Ne --> X1[Vrať chybu vstupu]
    B -- Ano --> C[Načti CONFIRMED rezervace daného tatéra]
    C --> D{Koliduje interval s některou z nich? BR-02/BR-04}
    D -- Ano --> R1[Vrať UNAVAILABLE]
    D -- Ne --> R2[Vrať AVAILABLE]
    X1 --> E([Konec])
    R1 --> E
    R2 --> E
```

### OP-03 — Confirm Reservation

```mermaid
flowchart TD
    A([Start: žádost o potvrzení rezervace X]) --> B{Rezervace existuje\na je ve stavu DRAFT?}
    B -- Ne --> X1[Zamítnuto — neplatný zdrojový stav]
    B -- Ano --> C[Znovu zkontroluj kolize vůči\nCONFIRMED rezervacím — BR-02/BR-04]
    C --> D{Nalezena kolize?}
    D -- Ano --> X2[Zamítnuto — rezervace zůstává DRAFT]
    D -- Ne --> F[Nastav stav CONFIRMED]
    F --> G([Vrať potvrzení úspěchu])
    X1 --> E([Konec])
    X2 --> E
    G --> E
```

*Poznámka:* souběh (REQ-04) není v tomto lineárním diagramu vidět —
je to vlastnost celého systému při paralelních pokusech, ne jedné
instance běhu operace.

### OP-04 — Cancel Reservation

```mermaid
flowchart TD
    A([Start: žádost o zrušení rezervace X]) --> B{Rezervace existuje?}
    B -- Ne --> X1[Chyba — rezervace neexistuje]
    B -- Ano --> C{Stav = CANCELLED?}
    C -- Ano --> R1[Idempotentní úspěch — stav beze změny]
    C -- Ne --> D{now < Reservation.start?}
    D -- Ne --> X2[Zamítnuto — čas začátku už nastal/uplynul]
    D -- Ano --> F[Nastav stav CANCELLED]
    F --> G[Rezervace přestane blokovat dostupnost tatéra]
    G --> H([Vrať zprávu o úspěšném zrušení])
    X1 --> E([Konec])
    R1 --> E
    X2 --> E
    H --> E
```

---

## Shrnutí kontroly konzistence

| Kontrola | Výsledek |
|---|---|
| Create vs. Confirm | Create nealokuje Resource (jen kontroluje kolizi dopředu), závazná alokace vzniká až v Confirm — shodné s textem i diagramy. |
| Availability vs. Confirm | Obě operace považují za blokující stejné stavy: CONFIRMED + pravidlo pauzy BR-04 (DRAFT neblokuje). |
| Cancel vs. stavový diagram | Text i diagram shodně umožňují cancel z DRAFT i CONFIRMED, jen před `start`. |
| Význam intervalů | Všude `[start, end)` dle BR-01, ověřovací příklady v `reservation-check-availability.md` s tím počítají. |
| Diagram případů užití vs. text | Každý cíl aktéra (UC1–UC4) má odpovídající OP-01–OP-04 v textu; žádný „osiřelý" cíl. |
| Požadavek vs. návrhové rozhodnutí | Diagramy neobsahují technologie ani interní komponenty (žádné DB, třídy) — pouze chování. |
