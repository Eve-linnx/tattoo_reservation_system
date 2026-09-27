## OP-03 — Potvrzení rezervace (Confirm)

**Cíl / hodnota pro uživatele:**
Platný DRAFT návrh se stane závaznou alokací času tatéra.

**Spouštěcí událost:**
Autorizovaný uživatel požádá o potvrzení existující rezervace ve stavu DRAFT.

**Pozorovatelný požadavek / požadavky:**
REQ-03: Systém potvrdí DRAFT rezervaci pouze tehdy, pokud její interval stále nekoliduje (překryv ani chybějící pauza) s jinou existující CONFIRMED rezervací.
REQ-04: Při souběžném pokusu o potvrzení dvou kolidujících rezervací se do stavu CONFIRMED dostane maximálně jedna z nich.

**Předpoklady:**
- Rezervace existuje.
- Reservation.state = DRAFT.

**Stav po úspěšném provedení:**
- Reservation.state = CONFIRMED;
- rezervace nyní blokuje tatéra pro daný čas (a vyžaduje dodržení pauzy před a po);
- BR-02 a BR-04 zůstávají pravdivé.

**Změna stavu:**
DRAFT → CONFIRMED

**Odkaz na doménová pravidla / invarianty:**
BR-02, BR-04

**Hlavní úspěšný scénář:**
1. Uživatel požádá o potvrzení rezervace X.
2. Systém načte rezervaci a ověří její stav (DRAFT).
3. Systém provede finální kontrolu kolizí s ostatními CONFIRMED rezervacemi.
4. Systém změní stav na CONFIRMED.
5. Systém vrátí potvrzení o úspěchu.

**Alternativní / chybové výsledky:**
- nalezena kolize (vznikla v mezidobí od vytvoření DRAFTu) → zamítnuto, rezervace zůstává DRAFT;
- neplatný výchozí stav (už je zrušena/potvrzena) → zamítnuto, stav se nemění.

**Příklady ověření:**
- DRAFT + žádná kolize → CONFIRMED
- dva souběžné potvrzovací pokusy o stejný čas → právě jeden projde (CONFIRMED), druhý je zamítnut (zůstane DRAFT).

**Zdůvodnění / zdroj:**
Potvrzení (Confirm) je skutečný moment alokace. Do té doby může mít o stejný čas zájem (DRAFT) více uživatelů, např. když dlouho vyplňují formulář, ale blokaci získá ten, kdo první potvrdí.