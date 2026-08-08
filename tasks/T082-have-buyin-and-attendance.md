# T082 — Christian Haves efterbetaling, og en uafklaret fremmødehistorik

**Status: PARKERET 2026-08-08.** Findings skrevet ned og handed off til en anden
session med mere kontekst. **Intet er implementeret, og intet er skrevet til
produktion for nogen af de to punkter herunder.** Det eneste, der er skrevet til
prod i dag, er T081 (augustkontoudtoget) — se `tasks/done/T081-...md`.

---

## 1. Repoet modsiger sig selv om Haves efterbetaling, og T076 er den forkerte

**Lukas, 2026-08-08:** *"Der er jo så også de udeståender på Christian Haves
manglende kontingent. Ikke sandt?"* … *"Vi har talt om det tidligere."*

Han har ret. Repoet indeholder begge påstande:

| Sted | Siger |
|---|---|
| `docs/finance-reconciliation.md` §14.5 (T070, **2026-07-29**, Lukas's egen beslutning) | *"the ninth must still buy in retroactively … That is a **receivable** — money owed to the club and not in the bank — and nothing in the schema can hold it."* |
| `docs/finance-reconciliation.md` §16 + `docs/STATUS.md` (T076, **2026-07-30**) | *"**Nobody owes a buy-in**, so no receivable concept is needed."* |

**T076 rakte for langt, og fejlen er værd at forstå frem for bare at rette.**
Kontoudtoget beviste, at Have har betalt **præcis det, klubben har opkrævet ham**
— fra maj 2026. Derfra konkluderede T076, at han ikke skylder noget. Men banken
kan per konstruktion ikke se et krav, klubben aldrig har sendt. Fraværet af en
regning blev læst som fraværet af en gæld. Det er samme fejltype som §15.1's
730 kr.: penge klubben er berettiget til, som aldrig nåede regnearket, findes
ikke i regnearket.

### Beløbet er afgrænset opad af klubbens eget kontingent

Kontingent begynder **juni 2025** for alle — det er, hvad de otte førstes
400 kr.-overførsler 30.08–25.09.2025 dokumenterer (§16.3). Uanset hvor længe Have
har deltaget, kan der ikke opkræves før klubben selv begyndte at opkræve. Så
spørgsmålet har kun ét realistisk svar, og det er også det Lukas valgte i dag:

```
juni 2025 – april 2026   11 mdr. à 100 kr.  =  1.100 kr.
maj 2026 og frem         betalt af ham selv     (700 kr., 100 + 3 × 200)
                                                ----------
efterbetaling                                    1.100 kr.
```

Det stiller ham nøjagtig som **Mads**, der skyldte et år og betalte 1.200 kr. den
01.05.2026. Forskellen på 100 kr. er kun, at Have selv har betalt maj 2026.

**Lukas' valg, 2026-08-08: fra juni 2025 — 1.100 kr.**

### Sådan implementeres det, hvis den anden session tager det

**Ingen skemaændring er nødvendig.** `members.dues_from` betyder allerede
"første måned klubben opkræver dette medlem", og beslutningen er netop, at
klubben opkræver Have fra juni 2025.

1. `update public.members set dues_from = '2025-06-01' where name = 'Have';`
   (guardet migration i samme stil som `20260730160000_bank_reconciliation.sql`)
2. `src/data/allocation.test.ts` → `DUES_FROM.Have = '2025-06'`.
3. Konsekvenser i testens påstande:
   - `a.settled` **uændret 15.100** — penge er penge, og bankafstemningen til
     16.880 kr. i §17 rører sig ikke.
   - `a.owed` 15.100 → **16.200**, `a.outstanding` 0 → **1.100**.
   - `byMonth.payers` bliver **9 i alle 15 måneder** (var 8 i de første elleve).
   - `byMonth.owed` bliver `900 × 12` derefter `1800 × 3`.
   - Ledgertesten: `last.outstanding` 730 → **1.830**.
4. På `/oekonomi` stiger den blå forventede kurve i de elleve gamle måneder, og
   udestående bliver **1.830 kr.** (1.100 kontingent + 730 bøder).

### ⚠️ Fælden, der skal håndteres bevidst — FIFO flytter hans åbne måneder

`allocateDues` er ren FIFO, ældste ubetalte måned først. Sætter man Haves
`dues_from` til 2025-06, bliver hans fire overførsler (100 + 200 + 200 + 200)
allokeret til **juni–december 2025**, og de måneder, der står åbne, bliver
**januar–august 2026** — altså netop de måneder, han faktisk har betalt til tiden.

Totalen er rigtig (1.100 kr.), men **den månedsvise placering er en artefakt af
modellen og ikke et udsagn om Have.** Han har betalt hver eneste måned, klubben
har sendt ham en regning for. Efterbetalingen er en beslutning truffet
bagudrettet, ikke en restance han har oparbejdet.

Anbefaling: assertér **summen** (`byMember` for Have: owed 1.800, settled 700,
outstanding 1.100) og **ikke** hvilke måneder gridet efterlader åbne, med en
kommentar der siger hvorfor. Ellers skriver testen en påstand om et medlem, som
kontoudtoget modsiger. Dette er præcis den grænse §16.4 og
`src/data/allocation.ts`' hovedkommentar trækker mellem *allokeret til de
måneder, den var for* og *flyttet så en graf ser pænere ud*.

### Docs der skal rettes samtidig

- `docs/STATUS.md` — "Nobody owes a buy-in, so no receivable concept is needed"
  (i afsnittet "Immediate next tasks", punkt 3) er forkert.
- `docs/finance-reconciliation.md` §16.11 punkt 4 og §16.3's tabelrække for Have.
- `docs/PROJECT.md` — beslutningen hører til som en dateret beslutning.
- `docs/RULES.md` linje ~113–126 — teksten om `dues_from` bruger Have som
  eksemplet på, at kolonnen ikke er en indmeldelsesdato. Det argument holder
  stadig, men eksemplet skal opdateres, når hans værdi ændres.

---

## 2. Fremmødehistorikken i produktion stemmer ikke med dokumentationen

**Fundet i forbifarten i dag, ikke undersøgt til bunds, og ikke rørt.**

Målt i prod 2026-08-08:

| Medlem | Deltagelser i basen |
|---|---:|
| Oskar, Saaby, Mads, Esben, Emil, **Have**, Anders, Rasmus | **28** |
| Lukas | 24 |
| Kasper | 13 |

I alt **261** rækker over 28 møder. Kun Lukas og Kasper har fravær overhovedet.

Det modsiger dokumentationen flere steder:

- `docs/finance-reconciliation.md` §16.3 og §16.11 punkt 4: **Have har seks
  deltagelser fra møde #3.** Basen siger 28 af 28, inklusive møde #1 og #2.
- `docs/RULES.md` linje 122 og `docs/PROJECT.md` linje 411: **Oskar har 22
  aftener.** Basen siger 28.
- `docs/STATUS.md`, `docs/DISCOVERY.md`, `docs/PLAN.md`, `docs/ARCHITECTURE.md`
  og `docs/PLAN-REVIEW.md` skriver gennemgående **235 fremmøderækker** — det tal
  stammer fra det oprindelige udtræk og er nu 261.

**Hypotese, ubekræftet:** mødehistorikken er blevet gemt igen gennem redigeringen
på `/anciennitet`, som per T065 starter et møde med **alle til stede**, så det er
fraværet der skal trykkes væk. Genredigeres et gammelt møde uden at fjerne de
rigtige, bliver alle stående som fremmødte. 261 = 280 − 19, altså 10 medlemmer ×
28 møder minus Lukas' 4 og Kaspers 15 fravær — mønsteret er foreneligt med det.

**Hvorfor det ikke kan ligge stille:** §11 måler anciennitet i antal
deltagelser, og anciennitet er det, `/anciennitet` er bygget til at vise. Er
rækkerne kommet til ved en genredigering, er klubbens rangering forkert for alle
undtagen Lukas og Kasper. Det er også den eneste kilde til, hvor længe Have
faktisk har været med — altså direkte relevant for punkt 1 ovenfor, selvom
efterbetalingen er afgrænset af kontingentets start uanset svaret.

**Bemærk:** `attendances` har hverken `created_at` eller nogen form for historik
(kolonner: `id, record_id, member_name, attended`), så **hvornår rækkerne kom
til, kan ikke afgøres fra basen.** 261 stod der allerede ved T076's og T078's
tilbagelæsning 2026-07-30, så ændringen ligger før den dato — dokumentationen
skrev 235 videre uden at opdage det. Klubben har ingen backupvane (T065).

**Ikke rørt. Ingen rækker er tilføjet, ændret eller slettet.**

---

## 3. Hvad der ér gjort i dag, og hvad der ikke er

**Gjort (T081, i produktion, verificeret):** augustkontoudtoget bogført —
`payments` 15 rækker / 16.880 kr., juli rettet 1.600 → 1.800 fordi Anders
betalte, august indsat med 1.800. Kontingentudestående nul. `fines`, `members`,
`attendances`, `attendance_records`, `news`, `events`, `profiles` uændrede,
andengangskørsel en ren no-op.

**Ikke gjort:**
- Haves efterbetaling — grundlaget er valgt (1.100 kr. fra juni 2025), men
  intet er skrevet, hverken i kode, docs eller database.
- Fremmødehistorikken — kun målt, ikke rørt.
- Dagens EK-møde er ikke oprettet i kalenderen.
