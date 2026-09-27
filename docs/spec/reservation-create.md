## OP-01 — Vytvoření rezervace (Create)

**Cíl / hodnota pro uživatele:**
Uživatel vytvoří návrh rezervace (žádost) na tetování, kterou lze později potvrdit.

**Spouštěcí událost:**
Autorizovaný uživatel požádá o rezervaci pro konkrétního tatéra (Resource) a vybraný časový interval [start, konec).

**Pozorovatelný požadavek / požadavky:**
REQ-01: Systém vytvoří rezervaci ve stavu DRAFT pro existujícího tatéra, pokud je požadovaný interval platný, splňuje pracovní dobu a nekoliduje (překryv ani chybějící 30minutová pauza) s již existujícími CONFIRMED rezervacemi.

**Předpoklady:**
- Uživatel má oprávnění vytvářet rezervace.
- Tatér (Resource) existuje.
- start < konec.

**Stav po úspěšném provedení:**
- existuje jedna nová rezervace;
- Reservation.state = DRAFT;
- zatím nedošlo k závazné alokaci tatéra.

**Změna stavu:**
[žádný] → DRAFT

**Odkaz na doménová pravidla / invarianty:**
BR-01, BR-02, BR-04, BR-05

**Hlavní úspěšný scénář:**
1. Uživatel odešle ID tatéra a časový interval.
2. Systém ověří, že je interval v pracovní době (BR-05).
3. Systém zkontroluje, že nedochází k překryvu (BR-02) a je dodržena pauza (BR-04) vůči potvrzeným rezervacím.
4. Systém vytvoří rezervaci ve stavu DRAFT.
5. Systém vrátí ID vytvořené rezervace a aktuální stav.

**Alternativní / chybové výsledky:**
- neznámý tatér → zamítnuto, rezervace nevznikne;
- neplatný interval nebo mimo pracovní dobu → zamítnuto, rezervace nevznikne;
- existuje kolize (překryv nebo chybí pauza) → zamítnuto, rezervace nevznikne.

**Příklady ověření:**
- platný tatér + [10:00, 12:00) + žádná kolize → vytvořen 1 DRAFT
- platný tatér + [03:00, 05:00) → zamítnuto (mimo prac. dobu)
- start == konec → zamítnuto

**Zdůvodnění / zdroj:**
V naší doméně kontrolujeme kolize a pauzy už při vytváření DRAFTu. Tím sice DRAFT ještě plně neblokuje kapacitu (tu blokuje až CONFIRMED), ale zabraňujeme uživatelům vytvářet návrhy, které by kvůli kolizi už nešly potvrdit.

**Předpoklad / neznámá / TBD:**
Zatím neřešíme, jestli se DRAFT po nějaké době sám zruší (vyprší), pokud ho uživatel nepotvrdí.