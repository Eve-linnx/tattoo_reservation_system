## OP-04 — Zrušení rezervace (Cancel)

**Cíl / hodnota pro uživatele:**
Rezervace je stažena a přestane blokovat kapacitu tatéra (pokud ji blokovala).

**Spouštěcí událost:**
Uživatel nebo systém požádá o zrušení rezervace.

**Pozorovatelný požadavek / požadavky:**
REQ-05: Systém umožní zrušit DRAFT nebo CONFIRMED rezervaci, pokud ještě nenastal její čas začátku.

**Předpoklady:**
- Rezervace existuje.
- Reservation.state ∈ {DRAFT, CONFIRMED}.
- Aktuální čas < Reservation.start.

**Stav po úspěšném provedení:**
- Reservation.state = CANCELLED;
- rezervace přestane blokovat dostupnost tatéra.

**Změna stavu:**
DRAFT → CANCELLED
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
- čas začátku už nastal nebo uplynul → zamítnuto, zrušení není možné.

**Příklady ověření:**
- DRAFT před začátkem → CANCELLED
- CONFIRMED před začátkem → CANCELLED a tatér se pro daný čas uvolní
- CONFIRMED po začátku → zamítnuto

**Zdůvodnění / zdroj:**
Zjednodušená politika pro C02 (Baseline v0.1). Neřešíme zatím složitější stornopoplatky ani specifické rušení ze strany samotného tatéra.