# Diagramy — Baseline v0.2

Tento dokument doplňuje textovou specifikaci (`reservation-create.md`,
`reservation-check-availability.md`, `reservation-approve.md`,
`reservation-cancel.md`, `reservation-rules.md`) o vizuální pohled na
systém, zohledňující změnu C02 (schvalovací proces).

---

## 9a — Diagram případů užití

Aktéři:
- **Klient** — vytváří rezervaci, zjišťuje dostupnost, ruší rezervaci.
- **Tatér** — schvaluje/zamítá rezervaci, zjišťuje dostupnost, může rezervaci zrušit.
- **Notification Service** — podpůrný externí aktér; dostává podnět po
  schválení nebo zrušení rezervace. Není to interní komponenta, proto je v diagramu.

```mermaid
flowchart LR
    Klient(["Klient"])
    Tater(["Tatér"])
    Notifikace(["Notification Service\n(externí, podpůrný)"])

    subgraph System["Rezervační systém – tetovací studio"]
        direction TB
        UC1(["Vytvořit rezervaci"])
        UC2(["Zjistit dostupnost"])
        UC3(["Schválit / Zamítnout (Approve)"])
        UC4(["Zrušit rezervaci"])
    end

    Klient --> UC1
    Klient --> UC2
    Klient --> UC4
    Tater --> UC2
    Tater --> UC3
    Tater --> UC4
    UC3 -.notifikace po schválení.-> Notifikace
    UC4 -.notifikace po zrušení.-> Notifikace
```

Poznámky ke konzistenci:
- Operace Confirm zanikla jako samostatný uživatelský případ a stala se součástí procesu Approve (OP-05).
- Cancel má oba aktéry (Klient i Tatér), protože specifikace (BR-03) neomezuje zrušení jen na klienta.

---

## 9b — Stavový diagram životního cyklu Reservation

```mermaid
stateDiagram-v2
    [*] --> PENDING_APPROVAL : create (OP-01)

    PENDING_APPROVAL --> CONFIRMED : approve [REQ-08: schváleno tatérem,\nžádná kolize podle BR-02/BR-04]
    PENDING_APPROVAL --> REJECTED : approve [zamítnuto tatérem]
    PENDING_APPROVAL --> EXPIRED : expire [REQ-07: uplynulo 24h bez reakce]
    
    PENDING_APPROVAL --> CANCELLED : cancel [REQ-05: now < start]
    CONFIRMED --> CANCELLED : cancel [REQ-05: now < start]

    note right of PENDING_APPROVAL
        Stav PENDING_APPROVAL neblokuje
        kapacitu závazně.
    end note

    note left of CANCELLED
        CANCELLED, REJECTED a EXPIRED
        jsou koncové stavy.
    end note
```

Kontrola konzistence s textem:
- Text nově počítá s tím, že rezervace po vytvoření čeká na schválení tatérem (přechod z Create do PENDING_APPROVAL).
- Text (OP-04, BR-03) umožňuje zrušit PENDING_APPROVAL i CONFIRMED před start → diagram má obě šipky do CANCELLED.

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
    Ff -- Ne --> G[Vytvoř rezervaci ve stavu PENDING_APPROVAL]
    G --> H([Vrať ID rezervace a stav PENDING_APPROVAL])
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

### OP-05 —  Approve Reservation

```mermaid
flowchart TD
    A([Start: Tatér reaguje na rezervaci X]) --> B{Zvolil tatér schválení?}
    
    B -- Ne --> Rej[Nastav stav na REJECTED]
    
    B -- Ano --> C{Rezervace je PENDING_APPROVAL?}
    C -- Ne --> X1[Zamítnuto — neplatný zdrojový stav]
    C -- Ano --> D[Znovu zkontroluj kolize vůči\nCONFIRMED rezervacím — BR-02/BR-04]
    
    D --> E{Nalezena kolize?}
    E -- Ano --> X2[Zamítnuto — rezervaci nelze potvrdit,\nnabídnuto zamítnutí]
    E -- Ne --> F[Nastav stav CONFIRMED]
    
    F --> G([Vrať potvrzení úspěchu])
    Rej --> G
    X1 --> End([Konec])
    X2 --> End
    G --> End
```

---

## Shrnutí kontroly konzistence

| Kontrola | Výsledek |
|---|---|
| Create vs. Approve | Create nealokuje Resource, závazná alokace vzniká až po kladném schválení v Approve — shodné s textem i diagramy. |
| Availability vs. Approve | PENDING_APPROVAL neblokuje dostupnost, blokuje ji až CONFIRMED. |
| Cancel vs. stavový diagram | Text i diagram shodně umožňují cancel z PENDING_APPROVAL i CONFIRMED před `start`. |
| Význam intervalů | Všude `[start, end)` dle BR-01. |
| Diagram případů užití vs. text | Nová operace OP-05 (Approve) je korektně zastoupena jako cíl tatéra, původní Confirm byl z Use Case diagramu odstraněn. |
