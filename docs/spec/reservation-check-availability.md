## OP-02 — Zjištění dostupnosti tatéra (Check Availability)

**Cíl / hodnota pro uživatele:**
Uživatel může zjistit, zda je tatér v požadovaném intervalu volný pro nové sezení.

**Spouštěcí událost:**
Uživatel vznese dotaz na dostupnost tatéra pro konkrétní časový interval.

**Pozorovatelný požadavek / požadavky:**
REQ-02: Pro platný interval systém ohlásí tatéra jako nedostupného (UNAVAILABLE), pokud interval koliduje s jakoukoliv CONFIRMED rezervací (překryv) nebo porušuje pravidlo 30minutové pauzy. V opačném případě ohlásí, že je dostupný (AVAILABLE).

**Předpoklady:**
- Tatér existuje.
- Požadovaný interval je platný a je v rámci pracovní doby.

**Stav po úspěšném provedení:**
- je vrácen výsledek dostupnosti;
- stav žádné rezervace se nemění.

**Změna stavu:**
[žádná]

**Odkaz na doménová pravidla / invarianty:**
BR-01, BR-02, BR-04

**Hlavní úspěšný scénář:**
1. Uživatel zašle dotaz na dostupnost s ID tatéra a intervalem.
2. Systém vyhledá všechny CONFIRMED rezervace daného tatéra.
3. Systém ověří, zda nedochází ke kolizi nebo porušení pauzy.
4. Systém vrátí výsledek AVAILABLE.

**Alternativní / chybové výsledky:**
- nalezena kolize (překryv nebo chybí pauza) → systém vrátí UNAVAILABLE.

**Příklady ověření:**
Existuje CONFIRMED rezervace: [10:00, 12:00)
- dotaz [09:00, 09:30) → AVAILABLE (přesně 30 min pauza je dodržena)
- dotaz [09:00, 09:45) → UNAVAILABLE (porušení pauzy, zbývá jen 15 min)
- dotaz [12:30, 14:00) → AVAILABLE

**Zdůvodnění / zdroj:**
Tato operace je zásadní pro kalendář v uživatelském rozhraní, aby uživatel viděl volné sloty před tím, než se pokusí o rezervaci.