## OP-04 — Zrušení rezervace (Cancel)

**Cíl / hodnota pro uživatele:**
Rezervace je stažena a přestane blokovat kapacitu tatéra (pokud ji blokovala).

**Spouštěcí událost:**
Uživatel nebo systém požádá o zrušení rezervace.

**Pozorovatelný požadavek / požadavky:**
REQ-05: Systém umožní zrušit PENDING_APPROVAL nebo CONFIRMED rezervaci, pokud ještě nenastal její čas začátku.

**Předpoklady:**
- Rezervace existuje.
- Reservation.state ∈ {PENDING_APPROVAL, CONFIRMED}.
- Aktuální čas < Reservation.start.

**Stav po úspěšném provedení:**
- Reservation.state = CANCELLED;
- rezervace přestane blokovat dostupnost tatéra.

**Změna stavu:**
PENDING_APPROVAL → CANCELLED
CONFIRMED → CANCELLED

**Odkaz na doménová pravidla / invarianty:**
BR-03

**Hlavní úspěšný scénář:**
1. Uživatel zažádá o zrušení rezervace X.
2. Systém zkontroluje, že aktuální čas je menší než čas začátku rezervace.
3. Systém změní stav na CANCELLED.
4. Systém vrátí zprávu o úspěšném zrušení.

**Alternativní / chybové výsledky:**
- rezervace už je CANCELLED → idempotentní úspěch (vrátí OK, stav se nezmění);
- čas začátku už nastal nebo uplynul → zamítnuto, zrušení není možné;
- rezervace je REJECTED nebo EXPIRED (koncový stav) → zamítnuto, stav se nemění.

**Příklady ověření:**
- PENDING_APPROVAL před začátkem → CANCELLED
- CONFIRMED před začátkem → CANCELLED a tatér se pro daný čas uvolní
- CONFIRMED po začátku → zamítnuto
- CONFIRMED přesně v čase začátku (now == start) → zamítnuto
- REJECTED / EXPIRED → zamítnuto, stav beze změny

**Zdůvodnění / zdroj:**
Zjednodušená politika pro C02 (Baseline v0.1). Neřešíme zatím složitější stornopoplatky ani specifické rušení ze strany samotného tatéra.