## Společná doménová pravidla a invarianty

Tato pravidla platí napříč operacemi Create, Check Availability, Confirm a
Cancel. Jednotlivé operace na ně odkazují pomocí identifikátoru `BR-*` a
pravidla se zde záměrně nedefinují znovu.

### BR-01 — Interval semantics

Časový interval rezervace má podobu `[start, end)`: začátek do intervalu
patří, konec nikoli. Rezervace je platná pouze tehdy, když `start < end`.

Intervaly, které se dotknou pouze v koncovém a počátečním bodě, se tedy
nepřekrývají. Například `[10:00, 12:00)` a `[12:00, 13:00)` nemají
časový překryv. Pravidlo minimální pauzy BR-04 se však posuzuje samostatně.

### BR-02 — Exclusive Resource invariant

V žádném potvrzeném stavu systému nesmí existovat dvě rezervace ve stavu
`CONFIRMED`, které se překrývají a patří ke stejnému výhradnímu zdroji
(`Resource`, v C01 tatér).

`DRAFT` rezervace zdroj závazně neblokuje. Kontrola se provádí při vytvoření
rezervace i znovu při jejím potvrzení, protože mezi těmito operacemi mohl
jiný uživatel potvrdit kolidující rezervaci. Při souběžném potvrzování
kolidujících návrhů může uspět nejvýše jeden pokus.

### BR-03 — Cancellation policy

Rezervaci ve stavu `DRAFT` nebo `CONFIRMED` lze zrušit pouze před jejím
časem začátku (`now < start`). Zrušením se její stav změní na
`CANCELLED` a rezervace přestane blokovat dostupnost zdroje.

Opakované zrušení již `CANCELLED` rezervace je idempotentní a vrací úspěch
beze změny stavu. Po dosažení nebo uplynutí času začátku se zrušení
zamítne. Storno poplatky ani zvláštní pravidla pro zrušení ze strany tatéra
nejsou součástí C01.

### BR-04 — Minimální pauza mezi potvrzenými rezervacemi

Mezi dvěma časově sousedícími rezervacemi ve stavu `CONFIRMED` pro stejný
`Resource` musí být alespoň 30 minut volného času na úklid a přípravu
pracoviště.

Pravidlo platí před i po rezervaci a kontroluje se společně s BR-02. Přesně
30 minut je přípustných; kratší pauza je konflikt. Zrušené a pouze konceptuální
`DRAFT` rezervace se do této kontroly nezapočítávají.

### BR-05 — Pracovní doba zdroje

Rezervace musí celá ležet v pracovní době příslušného `Resource`:
`start >= work_start` a `end <= work_end`. Výchozí pracovní doba tatéra je
09:00–18:00. Rezervace začínající před začátkem nebo končící po konci
pracovní doby se zamítne.

Pracovní doba se kontroluje při vytvoření rezervace. Dostupnost se nemění
stavem žádné existující rezervace.
