## OP-05 — Schválení rezervace (Approve)

**Cíl / hodnota pro uživatele:**
Tatér má plnou kontrolu nad svým časem. Může zkontrolovat návrh rezervace a rozhodnout, zda jej přijme (např. motiv je reálný, časový odhad sedí), nebo zamítne.

**Spouštěcí událost:**
Autorizovaný Tatér (Resource) ručně schválí nebo zamítne rezervaci, případně vyprší systémový časovač (např. 24 hodin).

**Pozorovatelný požadavek / požadavky:**
REQ-06: Systém umožní tatérovi schválit (změna na CONFIRMED) nebo zamítnout (změna na REJECTED) existující rezervaci ve stavu PENDING_APPROVAL.
REQ-07: Pokud rezervace zůstane ve stavu PENDING_APPROVAL déle než 24 hodin, systém ji automaticky označí jako EXPIRED.
REQ-08: Při schválení (přechod do CONFIRMED) systém ověří kolize (BR-02) a pauzy (BR-04). Pokud by schválení porušilo pravidla, systém schválení nedovolí.

**Předpoklady:**
- Rezervace existuje.
- Reservation.state = PENDING_APPROVAL.

**Stav po úspěšném provedení (Schválení):**
- Reservation.state = CONFIRMED;
- rezervace začne závazně blokovat kapacitu tatéra.

**Změna stavu:**
PENDING_APPROVAL → CONFIRMED (schváleno)
PENDING_APPROVAL → REJECTED (zamítnuto)
PENDING_APPROVAL → EXPIRED (vypršení času)

**Odkaz na doménová pravidla / invarianty:**
BR-02, BR-04

**Hlavní úspěšný scénář (Schválení):**
1. Tatér požádá o schválení rezervace X.
2. Systém ověří, že rezervace je PENDING_APPROVAL.
3. Systém zkontroluje, že potvrzením nevznikne kolize s jinými CONFIRMED rezervacemi.
4. Systém změní stav na CONFIRMED a alokuje čas.

**Alternativní / chybové výsledky:**
- Tatér žádost zamítne → stav se mění na REJECTED.
- Uplyne 24 hodin od vytvoření → systém změní stav na EXPIRED.
- Kolize při schvalování (např. tatér mezitím potvrdil jinou žádost na stejný čas) → systém schválení zamítne, rezervace může být tatérem rovnou zamítnuta.

**Příklady ověření:**
- PENDING_APPROVAL + tatér schválí + volný čas → CONFIRMED.
- PENDING_APPROVAL + uplyne 25 hodin → EXPIRED.
- PENDING_APPROVAL + tatér zamítne → REJECTED.