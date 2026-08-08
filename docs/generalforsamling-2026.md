# Generalforsamling 2026 — referat

Held **26. juni 2026** (Erhvervsklub #28, Propaganda, Esben som lead).
Source: the club's own one-page referat, sent by Lukas on 2026-08-08 as a
screenshot from Messenger. Transcribed here verbatim; also published to the members
as a news item of the same date.

**This is a source document.** It settles three things the repo had been inferring
from second-hand material, and raises one that is not built — see *What this
settles* below. When it disagrees with a guess made elsewhere in these docs, it
wins.

---

**Dirigent:** Mathias
**Tilgang:** AI first — ikke alignment. Ingen preread udsendt.

## Formalia og regnskab

Formanden — rettelig næstformanden — fortsætter. Regnskabet fremlægges med 0 kr. i
udgifter og betegnes som "booming times". Mads udtrykker overraskelse over
kontingentstigningen. Regnskabet godkendes enstemmigt og roses.

Der uddeles ingen bøder til Lukas.

Biomar er noteret på Børsen — dejlig ro i urolige tider.

## Valg

Saaby træder af som følge af for sen indkaldelse.

Esben stiller op på platformen: *"Mere frihed, færre bukseben."* Mathias truer med at
stille op. Anders tager imod valg: *"Lange bukser. Jeg er bedst, når der er en pisk.
Fremdrift og samarbejde."*

**Anders vælges som ny formand.**

Holst genvælges som næstformand efter en tæt sejr over Kasper. Kasper er skuffet.

## Investeringskomitéen

Komitéen uddeler preread og leverer en flot præsentation. Det besluttes at beslutte
noget næste gang. Der er muligvis regnet lidt forkert. Holst er meget kritisk. Anders
træder ud, og Have og Mads træder ind.

Bemærkning hørt på trappen efter mødet: *"Nu har vi fået carte blanche."*

## Afstemninger

| | |
|---|---|
| Bøde for inaktivitet | **vedtaget** |
| Sympatibøde | **forkastet** |

---

## What this settles

**Anders Tørring is formand.** Already recorded — Lukas said so directly the same
day, and `docs/PROJECT.md` carries the entry.

**Rasmus Holst is næstformand, confirmed.** This closes an open question.
`docs/finance-reconciliation.md` had him down as næstformand from an annual-report
slide, marked *"high confidence, unconfirmed"*, and the news item about the assembly
said only *"næstformand og kasserer fortsætter"* without naming him. The referat
names him and records that he was re-elected against Kasper. The
finance-reconciliation note can drop its hedge.

**Lukas continues as kasserer**, per the same sentence in the news item.

**Investeringskomitéen: Anders out, Have and Mads in.** Emil continues (from the news
item). The committee has no representation in the app and needs none today; recorded
because it is the only place the club's internal structure is written down at all.

## What this raises, and is not built

**A fine for inactivity was voted through, and the app cannot record it.**

`src/data/rules.ts` holds the five rules the club has published — `udeblivelse`,
`sent-afbud`, `for-sent`, `drikkevare`, `skaal` — and there is no sixth. An admin
capturing fines on `/oekonomi` has no chip to tap for this, so a fine the club has
formally adopted cannot be entered without a code change.

**Two things are unknown and neither can be guessed:**

1. **What it costs.** Every other rule has a fixed amount; `for-sent` alone has a
   per-minute component. Nothing in the referat says.
2. **What "inaktivitet" means, precisely enough to charge someone under it.** Not
   attending is already `udeblivelse` (200 kr). So this is presumably something
   else — not engaging, not replying, not turning up on the site — and the
   difference decides who owes money. Guessing it into the rule list would put a
   number on the club's own screen that nobody voted for.

**Ask Lukas before building.** It is one entry in `FINE_RULES` plus its tests once
those two answers exist; it is not a schema change.

*(Noted with a straight face: the club voted a fine for inactivity through on
2026-06-26, and on 2026-08-08 the app grew a chart of exactly who has and has not
been active. The two were built without reference to each other.)*
