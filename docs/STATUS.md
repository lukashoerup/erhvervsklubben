# Status — Erhvervsklubben rebuild

_Updated 2026-09-05 (T089/T090 — September 2026 in the books; the migration that kept CI red since 08.08 guarded; lead counts on the anciennitet strip). Single source of truth for "where are we". Update this at the
end of every working session._

## Start here if you are picking this up in a new session

**Two checks before trusting anything below** (added 2026-08-08, after the repo and
production drifted apart for nine hours):

1. **`supabase_migrations.schema_migrations` vs `supabase/migrations/`.** A migration
   applied to production and never committed makes this file a description of a
   database that no longer exists. It has happened once — `august_2026_statement`,
   2026-08-08 — and was recovered from production rather than rewritten.
2. **`git fetch` before touching anything.** A session can resume days after it
   paused. This one did: the entries dated 2026-07-30 below and the ones dated
   2026-08-08 are the same conversation, nine days apart.

**Counting attendance: `attendances` has a row per member per meeting, present *or*
absent.** So `count(*)` per member is ~28 for everyone and means nothing. The number
the club calls fremmøde is `count(*) filter (where attended)`. As of 2026-08-08:
**261 rows, 190 attendances.** Getting this wrong once told Lukas his database was
broken when it was correct. As of 2026-09-05: **271 rows, 200 attendances** — møde #29
(2026-08-08, record id 30) added ten of each, so all ten were there.


**September 2026 is in the books** (2026-09-05, T089). Lukas sent a screenshot of the
account on 05.09: **saldo 18.680,00 kr.** `payments` is now **16 rows summing to
18.680 kr.**, and for the second month running the sum of what the club has collected
is exactly what the bank holds — nobody has paid October ahead, nothing is outstanding.
Nine of nine paid September. Six of the nine transfers are on the screenshot (Anders,
Emil, Kasper, Mads and Saaby on 02.09, Have on 04.09); the other three are inferred
from 18.680 − 16.880 = 1.800 = 9 × 200 and from who paid early in August (Rasmus, Lukas,
Esben) — **arithmetic, not sight**, and the row's note says so. Applied to production
and committed in the same hour as `supabase/migrations/20260905103847_september_2026_statement.sql`,
filename version = the database's version, so check 1 above passes. Workings:
`docs/finance-reconciliation.md` §17.

**The anciennitet strip says how many times each man has been lead** (2026-09-05,
T090). Lukas: *"Kan vi få ind på anciennitetsgrafen hvor mange gange folk har været
lead? Tænker en linje."* It is a line of figures under the names, said once under the
strip, not a line drawn across them: lead counts run 1–4 against attendances in the
twenties on a 56 px plot, so a drawn line would lie flat on the baseline and read as
nothing, and a line across ten *people* draws a trend between neighbours who have
nothing between them. Counted from each record's own lead field against the roster,
whole names only, so møde 18's *"Rasmus (Co-lead Oskar)"* credits both men and a guest
lead credits nobody. **Not part of anciennitet** — §11 is attendance alone — so it
neither orders the strip, colours a bar nor joins the eyebrow. Live: Anders, Esben and
Mads on 4; Emil, Oskar, Rasmus and Saaby on 3; Lukas 2; Have and Kasper 1. Tests
467 → 476. If Lukas wants it drawn after all, the honest drawing is a lead share at the
foot of each bar, and the reason it was not done first is in `tasks/done/T090`.

**Three things this session found that the paragraphs below do not know:**

1. **CI on `main` was red from 2026-08-08 15:52 until this commit** — three commits,
   unnoticed because the two later ones were documents. Not the tests: the `rls` job
   died at `supabase start`, because `20260808180000_adhoc_fines.sql` inserts a fine
   against `attendance_records` id 30 — the bowling evening — and a fresh database has
   no such row (foreign key, SQLSTATE 23503). Production ran it fine; the row was there.
   Fixed here by guarding the three data statements and the assertion on that record
   existing, the way `fines_settled` already guards on the club's own totals. **A data
   migration that names a production row must say what to do when the row is absent**,
   and `supabase start` on a clean machine is the test that proves it does.
2. **The fine figures below are one evening behind.** `fines` is **36 rows / 2.875 kr.**,
   not 30 / 2.510: møde #29 (2026-08-08, bowling, record id 30, lead Mads) added six
   rows — four `aftalt` bets at 50 kr. (Lukas, Saaby, Kasper, Esben), Esben's 100 kr.
   first round, and Kasper 3 minutes late (65 kr.). None is settled, so **udestående
   bøder is 1.095 kr.** (730 + 365) and the Klubkassen card says so; 1.780 kr. collected
   is unchanged. The 2.510 / 730 figures below are right for the date each paragraph
   carries. Table in `docs/finance-reconciliation.md` §17.3.
3. **The home server has been silent since 07.08 05:05.** `workbench/STATUS.md` is
   regenerated every 30 minutes and that is its last commit; by its own rule the box is
   offline or the publisher is broken. Nothing in this repo depends on it — CI is
   GitHub's and the site is Vercel's (production deployment of `main` is `READY`) —
   but the Telegram alerts and the nightly brief come from that machine.

**It is live and writable.** <https://erhvervsklubben.vercel.app>, deployed from
`main` by Vercel's GitHub integration on every push. Build config is in
`vercel.json` and `.env.production` — both committed, nothing in the dashboard.

**Production now has** `fines`, `payments`, `attendance_records.meeting_date`
(added 2026-07-27), **`members`** (T069) and **`member_last_seen`** (T074) from
2026-07-29, and from 2026-07-30 **`members.dues_from`** (T076), **`fines.settled_at`**
(T078) and **`attendance_records.description`** (T080) — all additive, no
existing row touched. **28** meetings and 235
attendance rows intact — the junk duplicate of meeting #27 has since been
removed, so record ids run 1–27 and 29. **17 of the 28 meetings now carry a
date** (2026-07-29, T071) — see below.

**There is one meetings page now, and it is `/anciennitet`** (2026-07-30, T080).
Lukas: *"Ancinitetssiden er den rigtige. Den må der ikke ændres på"*, then *"Så
skal mødesiden fjernes."* So the merge is additive by construction — everything
that was on that page is still on it in the order it was, and three things joined
it: the calendar on top (planned meetings for every member, the admin's editing,
held entries folded), a **description on each meeting record**, and a disclosure on
the card that opens onto the full text and **that evening's fines**. `/moeder` is
gone and the tab bar is five columns. `events` survives because a meeting still
ahead cannot have an attendance record — see `tasks/done/T080-meetings-merged.md`.

**`/oekonomi` was wrong about udestående, and it is fixed** (2026-07-30, T078).
Lukas found it by reading the page: *"Der står i toppen af økonomisiden at der er
udestående bøder på 2510 kr. Det passer ikke."* It did not. **Read this before
quoting any fine figure**, because there are now three and they are all correct:

```
2.510 kr.  pålagt      every fine a Lead ever noted        30 rows
1.780 kr.  indbetalt   what has reached the fine box       19 rows
  730 kr.  udestående  what the club is owed               11 rows
```

**The wording is Lukas's own since 2026-08-08**, and the change is two words:
*"Indbetalt i alt. Bøder pålagt 2.510 kr., heraf er 1.780 kr. **opkrævet** —
**udestående bøder** 730 kr."* The card opened on *Indbetalt* i alt (the balance) and
then said 1.780 kr. *indbetalt*, so one word named two different things four words
apart; and a bare *udestående* on a card about money reads as the club being short
rather than as unpaid fines. His reason: *"Jeg tror at det vil forvirre nogen lidt."*
The trailing sentence explaining the 730 went with it — the label now says it.

The card summed the first and printed it under the third's name — it overstated
what the membership owes **by the entire amount it had already paid**. Not an
arithmetic error: every number was computed correctly, and one number was doing
the job of three. The same conflation was one card down in "Bøder pr. medlem",
which invited the treasurer to bill a member for fines he settled in February.

**Why it could not be derived, and where the fact now lives.** `payments` holds
one combined figure per month covering kontingent and fines together — that is all
the bank statement itemises (§16) — so nothing on the payments side can say which
fines it paid for. **`fines.settled_at`** carries it, added additively in
`supabase/migrations/20260730180000_fines_settled.sql` and **applied to production
2026-07-30**. Null means not collected, which is the safe default: an unmigrated
database under-claims what the club has collected rather than over-claiming it.

**The 19/1.780 split is evidence, not a cut-off, and one row decides it.** T075's
"Bøder indkrævet" line divides møder 21–25 (1.730 kr., billed and collected) from
#26–#28 (730 kr., noted and never billed). 1.730 is not 1.780: the difference is
**the treasurer's own voluntary 50 kr. at møde #26**, which he transferred himself,
so it is settled even though its evening was never invoiced. `meeting_number <= 25
OR rule_id = 'frivillig'` — a cut-off alone marks 18 rows and 1.730 kr., which
reconciles against nothing. The migration refuses and rolls back unless all three
totals close.

**The club can see what its fines are about** (2026-07-30, T078). Lukas: *"hvilke
forseelser der er givet højeste bøder, og evt. også i samme visualisering, hvem det
er. Masser af insights."* And twice: *"Alle medlemmer skal kunne se det."* So both
new cards sit **outside every treasurer gate**.

Later the same day he removed the last two gates as well — *"Alle medlemmer skal gerne
kunne se udestående bøder … Det er fint med transparens"*, then *"så må alle også gerne
se den øverste kasse"* — so **`/oekonomi` now shows every member everything on it**, the
bank balance and the list of who is behind included. That retires the 2026-07-26
decision that the balance was the treasurer's alone. RLS is unchanged: these were
page-layer gates over data every member could already fetch. See PROJECT.md, 2026-07-30.

The card leads with the club rather than with a member, and that is the tone
decision: **the club has been late by 3 t 22 min in total, across 23 arrivals and
7 of its 9 finable members.** `for-sent` is **86 %** of every krone, by
construction — it is the only rule with a per-minute component — so any per-member
chart makes whoever tops it look like the problem when the finding is that nearly
everyone is in it. **One bar per offence, members named in text beneath it.** Nine
members as stacked segments was tried and abandoned: the smallest share is eight
pixels at 420 px, so identity would have fallen back to nine hues on a dimension
with no order. No log scale and no broken axis either — every bar is
direct-labelled, so the 50 kr. rows are read from the figure beside them and the
dominance stays true.

**Indtægtsfordeling pr. kvartal** (T078), also Lukas's: *"en graf længere nede som
viser indtægtsfordeling (kontingenter, bødetyper) over tid."* **Quarters, not
months** — the regulation collects fines quarterly and §9 puts a dinner on the
calendar every other month, so a monthly axis draws the club's *calendar* as a
sawtooth a reader would take for a collection problem. Two things it says on itself
rather than leaving to be misread: the kontingent half is **derived** (rate ×
members charged that month) because the bank has never itemised a month, and a
payment belongs to the month it **settles**. Four segments in **one sequential ramp
of the club's blue** rather than four hues — they are the parts of one figure, and
four fresh hues would undo T072. The steps are measured with dataviz's
`validate_palette.js` in both palettes, separately rather than flipped; the numbers
are in `src/index.css` beside the tokens.

**The chart motion is slower, and it is a considered departure from §01**
(2026-07-30, T078). Lukas: *"Kan vi få en smule mere delay på den motion der er på
grafen? Det må godt gå lidt langsommere, da man ikke når at se at den bygger op."*
T077 predicted exactly this and named the cause, so the fix is the duration and the
easing rather than a fourth mechanism: §01's `.16 1 .3 1` reaches **95 % at 43 % of
its duration**, so the chart snapped and then crept, and stretching the same curve
would only lengthen the creep. It is now **1600 ms on `.25 .35 .5 1`** — 95 % at
77 % — on **all three charts, one shared rule**. The count-up moved with it
deliberately: the three figures under the finance curve now run 1600 ms so the line
and the number it resolves to still finish together, which until now held *by
accident* because both were 900 ms. `SWEEP_MS` in `src/lib/reveal.ts` must equal the
CSS duration and **a test compares the two source files**. §01's 900 ms still
governs every other figure. Argued in `design/README.md`.

**The books are reconciled against the real bank statement** (2026-07-30, T076).
Read this before quoting any figure on this page: **`payments` is 14 rows summing
to 14.880 kr.**, not the 13 rows / 13.280 kr. the sheet had. The club's actual
account statement — all 90 transactions to 30.07.2026, closing 15.080,00 kr. —
arrived and supersedes the spreadsheet for every month it covers.

```
13.100  kontingent settled, June 2025 – July 2026
+1.780  bøder collected, February 2026
------
14.880  reconciled       = the balance Lukas photographed on 27.07 ✓
  +200  Rasmus, settling August 2026 — held out on purpose
------
15.080  bank, 30.07.2026 = the statement's own closing balance ✓
```

**It ties out to 200 kr.**, and that 200 kr. was already known: **Anders owes
July 2026** because he has changed bank (Lukas, 2026-07-30). He is the only
member with anything outstanding in fourteen months; every month from June 2025
to June 2026 is settled in full by every member the club charged.

**The one decision worth understanding before touching these numbers:
`payments.month` is the month a payment *settles*, not the month the money
arrived** — the column has always said so. So a catch-up transfer is allocated
across the months it was for, which is why Mads, who paid nothing for a year and
then cleared 1.200 kr. in one transfer on 01.05.2026, now reads as having paid
every month. That is accrual accounting, not a cosmetic fix: **the bank total
cannot move**, only the monthly view, and the allocation is asserted against all
87 real transfers on every test run. The full argument, including where the line
between "allocated" and "moved to look nice" sits, is in PROJECT.md and
`docs/finance-reconciliation.md` §16.4.

**Eight payers before May 2026, nine from May.** `members.dues_from` now holds the
first month the club charges each member: 2025-06 for eight, 2026-05 for
Christian Have, null for Oskar (§12 charges him nothing). This is the schema
change §14.5 specified and refused to make without evidence, and it removes the
last big distortion §13 found — `/oekonomi` was charging nine members across the
whole history, 1.200 kr. more than the club ever charged. It is **`dues_from` and
not `joined_on` on purpose**: the bank documents liability to pay, and Have has
attended since møde #3 and was fined at møde #26 three months before his first
transfer. Also: the remembered "ninth member joined June 2026" is refined by the
bank to **May 2026**.

**Fines were not touched, and incurred is still not collected — and since T078 the
app finally says which is which.** The statement
independently confirms the **1.780 kr. collected** (`Emil bødekasse` 235 on 09.02
+ `Bøder` 1.545 on 16.02 — exactly the sheet's `E10 = 700+1545+235`, now seen as
money moving). The club has **incurred 2.510 kr.** The **730 kr.** between them is
still fines a Lead noted and nobody billed, still money the club is owed, and
still Lukas's decision. `fines` read back at 30 rows / 2.510 kr., unchanged.

**Three long-standing questions closed by the bank:** the **400 kr.** of §5.3 was
Rasmus (29.06) and Lukas (30.06) paying July in advance — explanation (b), which
the doc had rated less likely; **nobody missed February 2026** (the club had seven
payers then, and 7 × 100 = 700 exactly); and the unnamed **`Overførsel`** transfers
are Mads, corroborated to the krone by his total being precisely what he was
charged. Full workings, the per-member table and everything still open:
`docs/finance-reconciliation.md` §16.

**The sheet's history was imported** (2026-07-29, T068): 13 `payments` rows
summing to **13.280 kr.** and, since T071, 18 `fines` rows summing to
1.780 kr., reconciled against *Klubbens finanser* to the krone, in both
directions of the grid. Insert-only and re-runnable; the statements are
committed as `supabase/migrations/20260729120000_finance_history_import.sql`
and `..._20260729200000_meeting_dates_from_calendar.sql`. **Since 2026-07-30
(T075) the fines are 29 rows summing to 2.510 kr.** — see immediately below,
because that number is not the annual report's and it must not be quoted as if
it were.

**The meetings have dates** (2026-07-29, T071), from Lukas's Outlook calendar:
**17 written, 11 left null on purpose.** The trap anyone repeating this must
know: **`#N` in a calendar subject is not `meeting_number`** — the club's own
numbering ran one ahead of the database's through the middle of the history and
closed the gap again later, proved by two invitations whose bodies name the
venues (`Erhvervsklub #18` is record **17**, Aamanns/St. Pauli/ÅBEN;
`Erhvervsklub #13` is record **12**, Restaurant Hos in Odense). Every date was
matched on **lead + venue + ordering** instead. The 11 refused are 1–4 (nothing
club-shaped in the calendar that far back), 8 (the one candidate names the wrong
lead), 14–16 (three meetings, one calendar event — two are simply missing), 18
(certainly the London trip, certainly January 2025, but the block spans two days
and nothing decides which), and 19–20 (bare all-day blocks matching only by
position in a run the 2024 gap proves is not complete). Full evidence table:
`docs/finance-reconciliation.md` §14.

**The Februar 26 fine of 50 kr. is in** (T071). Lukas answered it on 2026-07-29:
it was **his own**, a voluntary fine he transferred himself, as treasurer,
because a year in which the treasurer incurred no fine looked implausible — which
is also why he is the one member with no row in the sheet's grid. The dating
supplied the other half: exactly one meeting falls in February 2026, record 26
on 2026-02-21. Fines now total **1.780 kr.** and match the annual report, and all
of it sits inside the month-by-month ledger.

**The fines have their reasons now** (2026-07-30, T075) — and **the club's fine
total moved off 1.780 kr.** Read that first, because two correct numbers now
measure different things, exactly as 1.730 and 1.780 did:

- **1.780 kr. is what the club collected**, is what the annual report reports,
  and is still exactly right. Not one krone of it was touched.
- **2.510 kr. is what the club incurred.** The 730 kr. difference is fines a
  Lead noted and nobody ever entered in the sheet — **money the club is owed
  and has never asked for.** Whether to bill it is Lukas's call, not a bug.

The source was the notes Lukas kept on his phone, one block per Lead, plus a
screenshot of the note for the general assembly. A line in them reading
**"Bøder indkrævet"** divides the collected evenings from three that were never
billed: møde #26 (180 kr.), #27 (80 kr.) and #28, the generalforsamling
(470 kr.). That also answers the old question of whether fines stopped being
recorded after Februar 26 — **they did not stop being recorded, they stopped
reaching the treasurer's sheet.**

**Two standards of evidence, and the rows say which.** The notes name the
offence in words for eleven of them. For the rest Lukas answered from memory:
*"De bøder som du har spærret for var alle pga. for sent fremmøde. Jeg kan godt
huske det."* That is the member holding the club's records, not an inference
from an amount — and **the regulation then tested it**: `for-sent` is
50 kr. + 5 kr./minute, so a late arrival must be `50 + 5n` for a whole n, and
**all fourteen divided cleanly** (60→2, 100→10, 155→21, 200→30 …). Fourteen of
fourteen, nothing left over, no amount moved. The treasurer remembering *and*
every amount independently being a whole number of minutes at the club's own
rate is much stronger than either alone. Anything that had failed the division
would have kept `historisk` and been reported.

**28 of 29 fines now name a real offence** — 23 `for-sent`, 4 `skaal`, 1
`drikkevare`. **One still carries `historisk`**: Lukas's own voluntary 50 kr. at
møde #26, where the arithmetic decides nothing, because 50 kr. is late arrival
at zero minutes *and* exactly what `skaal` and `drikkevare` cost.

**Oskar was noted twice and charged nothing** — 75 kr. under his own lead,
200 kr. under Emil's, in neither the sheet nor the database. That is the first
independent evidence the founding father's exemption was **practised** and not
just stated a year later: the Leads went on noting his offences like anyone
else's and the treasurer never billed them. Not imported.

One row is flagged rather than resolved: **Emil's 110 kr. at møde #25.** The
sheet stores that cell as `{=60+50}`, i.e. two bundled offences, but two late
arrivals at one meeting are not allowed. Recorded as Lukas answered it, worth
one question if he remembers the evening. Full workings, the whole
old-rule/new-rule table and what the GF note contained:
`docs/finance-reconciliation.md` §15.

**The club now has a member list** (2026-07-29, T069), and the finance page
charges only the members who pay. Ten members in `members`, **nine of them
`aktiv`** and **Oskar `founding-father`** — Lukas's ruling of the same date: he
attends, but pays no kontingent, incurs no fines and does not vote on the use of
the club's funds (§12). Not "inactive", because §3 says an inactive member may
not attend; his anciennitet is untouched, because §11 earns it by attendance
alone. Before this, `buildLedger` was handed `roster.length` — everyone who had
ever turned up — so the blue expected-income curve was too high in every month
the club has ever had. Against the real books it read **14.000 kr. charged where
12.600 kr. was owed**, which reported the club **720 kr. short when it is 680 kr.
ahead**. The exemptions are stated once, in `src/data/members.ts`. See RULES.md.

**The club's own fine budgeting is back** (2026-07-29, T070), and the 680 kr.
above is now explained rather than reported. **Fines are not why the club looks
ahead** — they push the other way. `/oekonomi` charges nine payers across the
whole history where the club charged eight before June 2026 (+1.200 kr. too
much), while 1.780 kr. of fines never entered the expected line at all: 1.730 kr.
because all 28 meetings were undated, and 50 kr. because that fine was never
imported. The two nearly cancel. Against the club's own books the real surplus
is about **100 kr.**, and if the fines could be placed in months the club would
read **1.050 kr. behind**. **T071 did exactly that**: all 1.780 kr. now sits on
dated meetings, so that half is closed and the club should now read behind rather
than ahead. Nothing here is a code bug to fix — what is left is the payer count,
and it needs a schema change Lukas has to approve first (T071 §14.5).
§9 Q8 is **answered**: nine members since June 2026, eight before, and the ninth
still owes a retroactive buy-in the app cannot model.
Full workings in `docs/finance-reconciliation.md` §13.
The budget itself is `src/data/projection.ts`: *Klubbens finanser* had the
`Forventede bøder` / `Forventet beholdning` structure and **no method** — those
four cells are typed constants, and the sheet's own forward rows budget zero
fines to August 2027 (§12). So the structure came back and the arithmetic is
new: the average is **per meeting**, not per month, because §9 puts a dinner on
the calendar every other month and a monthly mean's answer depends on how wide
the window is. It is drawn as a dashed line, labelled `Forventede bøder ·
budget`, and says on the page that it is not money the club holds. **No
migration, nothing stored.**

**The screens have a hierarchy now** (2026-07-29, T072). Lukas, having looked at
all six: *"Det er lidt ensartet med farverne, og tekststykkerne på nogle af
siderne virker meget voldsomme og store."* He was offered a smaller type scale
and said no, so **nothing was made smaller.** The accent had been doing four
jobs at once — headings, figures, links and section labels — which is exactly
why a page of six cards read as one texture. It now means one thing, *this can
be tapped*, and the club's **numbers are set in Instrument Serif**: the contrast
comes out of hue and goes into the typeface, with no new colour anywhere. Each
screen was given one face — Hjem its figures, Anciennitet its rhythm, Økonomi
its curve, Regler its text — and `/regler`, the heaviest of them, got a statute
title that finally out-weighs its own paragraphs (14.4 px/600 ink over
12 px/400 muted, indented, with air around it) instead of the 0.8 px that used
to do that job. Measured after: **zero failing contrast pairs across 1860 pairs
on all eight screens in both themes**, every tap target at 44 px bar the demo
bar's own switch, no horizontal scroll at 420 px, and Anciennitet's scroll cost
unchanged. Which idiom the figures follow, and why the design system supports
both, is in `design/README.md`.

**The app has some character now** (2026-07-29, T073). T072 refined the
hierarchy and Lukas's verdict on it was that the diagnosis had been wrong:
*"Synes ikke rigtig at jeg kan se den store forskel på farverne … de cards der
er på møde og nyheder siderne er stadig lidt kedelige."* One thing he did like:
*"Den nye skrifttype på tallene er pæn."* He was not asking for tidier, he was
asking for the members' screens to feel like the landing page's logo intro,
which he calls *"genial"*. Three things, all of them §01 Bevægelse:

- **The finance curves draw themselves in.** *"Det kunne også være fedt med
  noget motion på finansgrafen. Så linjerne sådan kommer frem, når man åbner
  siden."* 900 ms on the system's own curve — the timing §01 gives the count-up
  and the bars, because a drawn line is one quantity being read out rather than
  an element arriving. **The band settles after the curves rather than drawing
  with them**: it is not a third series, it is the distance between the two
  lines, and drawn alongside them it would show a shortfall growing as you
  watch. The forecast waits one beat longer again, being the only mark on the
  chart that has not happened yet.
- **The three figures under the curve count up**, over the same 900 ms the curve
  takes to draw, so the line and the number it resolves to finish together.
  *"Og lidt mere motion på tallene."* Klubkassen — the balance a member checks
  his own arithmetic against — deliberately still does not move.
- **Nyheder and Møder have a face.** *"Man kunne måske lave et eller andet
  der?"* The date left the top of the card and became it: a **26 px serif day
  numeral** in a rail with its month beneath and a hairline down its side, which
  is the register he already approved and the idiom `/anciennitet` and `/regler`
  already use. News items are **signed** — `author` was written by the form and
  read by nothing since the page was built — and a meeting's **venue has its own
  row with the set's blue pin**. The rail's hairline is blue while a meeting is
  still ahead and the ordinary line once it has been held, so the calendar says
  which half you are in without a chip.

**Room was deliberately left for the map** (*"vi skal have et kort, som viser
alle steder vi har været"*): the venue is now a single self-contained row with
its own icon and the full width of the card, so a link, a chip or a row of them
can arrive there without the card being rebuilt. **No map dependency was added.**

One bug was found and fixed on the way: the count-up mixed `performance.now()`
with the rAF timestamp, and a frame whose clock read a millisecond early turned
easeOutExpo's `1 − 2^(−10p)` into a large negative multiplier — the club's
balance rendering as **"-24.643 kr."** for one frame. Clamped, and tested.

Measured after, at 420 × 900 on all eight screens in both themes, signed out,
member and admin: **zero failing contrast pairs**, no horizontal scroll, tap
targets unchanged (the demo bar's own 21.6 px switch is still the only one under
44 px), nothing stranded mid-reveal after a full scroll, and `/anciennitet`'s
scroll cost unchanged within run-to-run noise (10× CPU throttle 23–27 fps before
against 20–27 after; 15× 10–13 before against 13–14 after). **WebKit could not
be verified** — the Playwright WebKit build is not installed here and the
download fails from this environment. See T073's notes for what that leaves at
risk.

**The club's front page is reachable again** (2026-07-29, T072). Lukas: *"Der er
ingen måde at man kan navigere tilbage til animationsforsiden."* He was right —
`/` forwards a signed-in member to `/hjem` (T060, and deliberately: both
audiences share the URL people type and share), so the landing page with the
logo intro was live and unvisitable from inside the app. **The logo lockup in
the top-left is now a link to it**, in the app bar and on `/login`, and the
forward yields to it: the link navigates with `state={{ forside: true }}`, which
rides that one history entry rather than the URL, so a typed, bookmarked or
shared `/` still forwards exactly as before. Covered by a test.

**"Hvem betaler kontingent" is gone from `/oekonomi`** (2026-07-29, T072).
Lukas: *"Det ved alle godt."* The card named the nine payers of ten and quoted
§12 under Oskar's name; in a club of ten that is a card explaining what everyone
already knows. **Nothing about the money changed** — `MEMBER_RIGHTS` in
`src/data/members.ts` is untouched, and it is what actually stops the founding
father being charged and being offered on the fine screen. What survived is the
count alone, as a clause in the finance chart's own caption: the height of the
blue line is nine times the rate and not ten, and that is the one thing on the
page a member cannot work out from knowing his own club.

**The club can see when its members were last here** (2026-07-29, T074). Lukas
asked how often the members visit and nothing could answer: `last_sign_in_at`
only moves when somebody types a password, and a session lasts months — Saaby
signed in last October and was still on that session in February. What he
approved is exactly this and no more: *"én linje per medlem med 'sidst set',
opdateret ved hvert besøg. Ingen sporing af hvad de kigger på."*

So there is **one row per account and one timestamp, overwritten** — no events
table, no page column, no counter, and the count of visits unrecoverable by
construction. It fires once per app load, never blocks or breaks a page, and is
a no-op in the demo and under `VITE_READONLY=1`.

**The security part is the part to read.** `profiles` holds `role` and its only
UPDATE policy is what stops a member promoting himself, so `last_seen` is *not*
a column there — it is `public.member_last_seen`, keyed by `user_id`, with **no
INSERT, UPDATE or DELETE policy for anyone, admin included.** The only writer is
`touch_last_seen()`, a security definer function that **takes no arguments** and
therefore cannot be aimed at another member's row. Eight named assertions in
`tests/rls/rls.test.ts`, and the same eight proved by hand against production
inside rolled-back transactions.

One bug production found that a local database could not: `revoke … from public`
does not remove `anon`'s EXECUTE on a new function, because a hosted project
carries a **default privilege** granting it — a hole that passes every local
check and is open in prod. `revoke … from anon` is now an explicit line, and
Supabase's own advisor confirms the function is `authenticated`-only. Applied to
production 2026-07-29; the club's data read back **unchanged** (28 meetings, 235
attendances, 18 fines / 1.780 kr., 13 payments / 13.280 kr., 10 members) and
`member_last_seen` at 0 rows. (Both finance figures have since moved — 30 fines /
2.510 kr. after T075, and 14 payments / 14.880 kr. after T076.)

An admin sees it on `/anciennitet`, **folded shut and alphabetical**: in a club
of ten a permanent ranking by absence is a different social object from a fact
you can go and look up. Two of the ten have no login at all, which is said in
words rather than rendered as a date.

**Two roles, and only two** (see PROJECT.md 2026-07-27): members read everything
behind the login; admins additionally edit news, events and attendance.

**Next, in Lukas's priority order:**
1. ~~**The Claude Design system**~~ ✅ **done 2026-07-27 (T064).** The export is
   in the repo as `design/erhvervsklubben-designsystem-v2.html`. Palette, type
   pairing, the three surfaces and the logo intro landed earlier; T064 added
   the two **Instrument fonts**, decoded out of that bundle and self-hosted
   under `public/fonts/` (51 kB for both — there is no CDN access, and a
   Google Fonts link fails silently), and put the system on all six members'
   screens: the texture ground, the drawn mark in the app bar, 16 px card
   radius, serif display type, sticky section labels, and the system's
   scroll-linked reveal. **T066 then closed the icons and swept the rest.**
   §03's Material Symbols now ship, subset from 339 kB to **1072 bytes** — the
   tab bar was six geometric characters that Instrument does not draw, so it
   rendered differently on every phone. The sweep put the texture, the drawn
   mark, the brand-blue button and the 48 px floor on `/login` (which the
   design pass had missed, being outside the Shell), gave the fifteen statute
   rows on `/regler` a 48 px target, named the button radius §03 asks for, and
   put §01's reveal on the public landing page. Contrast is at zero failing
   pairs on all eight screens in both themes. **What is deliberately still
   open** — the members' type scale against §04's phone mocks, §01's count-up
   on figures, and iOS before Safari 26 — is in `design/README.md`.
2. ~~**A public landing page**~~ ✅ **done 2026-07-27 (T060).** `/` is the club's
   face: the logo intro, the purpose and cadence quoted from the statutes,
   upcoming meetings and recent news. Everything else still needs a login, and
   the members' front page moved to `/hjem` — a signed-in member opening `/` is
   forwarded there. The page reads only `news` and `events`, the two
   anon-readable tables, and a test asserts it asks for nothing else.
3. ~~**The finance graph**~~ ✅ **done 2026-07-27 (T061).** `/oekonomi` now draws
   what the club has charged against what has actually arrived, running totals,
   for every member rather than the treasurer alone. It drew nothing in
   production until T068 put the sheet's history behind it; **since 2026-07-29
   it draws the real thirteen months.** Since T071 the meetings are dated where
   the calendar could prove it, so all 1.780 kr. of fines sits *inside* the
   month-by-month view; the 11 meetings still without a date carry no fines at
   all, and the page still says how many are missing.
4. ~~**Admin editing of news, events and attendance**~~ ✅ **done 2026-07-27
   (T063 + T065).** This was Lukas's whole list — *"add and edit news, events,
   and the anciennitet events"* — and all three are now in the app. Neither task
   migrated anything: RLS has allowed exactly this since 2026-07-23.
   **News and events (T063).** News on `/nyheder`; the meetings on a new member
   page **`/moeder`**, which is also the first place the club's whole calendar —
   planned *and* held — has been readable. Held meetings stay on it
   deliberately: a date typed wrong lands in the past, and every other view of
   `events` shows only the future. **`/moeder` was removed on 2026-07-30 (T080)**
   and the calendar is now a section at the top of `/anciennitet` — everything in
   this paragraph still holds, on that screen instead.
   **Attendance (T065).** On `/anciennitet`, the page the history is read on: an
   admin records a meeting and ticks off who came, or corrects one already
   recorded. Ten members, two columns, 48 px buttons, and a new meeting starts
   with everyone present so the *absentees* are what get tapped — this is used
   the morning after a meeting, not at a desk. A member with no row for a
   meeting keeps none unless he is ticked present, because 235 rows over 29
   meetings is not ten per meeting and `total` is counted from the rows that
   exist. The editor can also name someone the club has never recorded — which
   was the only way an eleventh member could enter a database with no members
   table, and since T069 is what covers a guest or a member admitted between
   meetings.
   **A meeting's date is now set in one place** — that editor. The date field on
   `/oekonomi`'s "Møder uden dato" is gone and its *count* stayed: how many
   meetings lack a date is a fact about those books, but two inputs on one
   column are two places for it to start behaving differently.
   Deleting asks a second time and names what will go; for a meeting that
   includes counting the ~10 attendance rows and the fines that cascade with it.
   The club has no backup habit.
5. ~~**Import the finance figures**~~ ✅ **done 2026-07-29 (T068).** Both of the
   blockers listed here turned out to be answerable. The 1.730 / 1.780 split was
   never a disagreement — 1.730 is five dinners, 1.780 is six months, and the
   sixth (Februar 26, 50 kr.) simply never got a column in the grid. And the
   per-member breakdown does *not* lose which Lead's column a fine belongs to:
   two formulas in the sheet, `C2 = 100+95+80` and `C4 = 105+50+50+200`, are
   Lead columns typed verbatim into month cells, which pins the mapping as fact
   and lets the other three follow uniquely. 13.280 kr. of payments and 1.730 kr.
   of fines are in. The rule still held: the 50 kr. has no member and no meeting,
   so it was **not** imported. See `docs/finance-reconciliation.md` §11.
6. **Known defects** from the 2026-07-27 browser test — cleared in T062, except
   the last one.
   ✅ **Late-arrival minutes** no longer need Enter: the field commits when it
   loses focus, which on a phone is how the keyboard gets dismissed. Bounded at
   240 minutes (past four hours it is *udeblivelse*, which the regulation
   charges separately), and a refused entry says so instead of taking 99999 at
   face value or charging -50 as none.
   ✅ **Amounts use the shared `kr()`**, so the fine screen and the ledger
   cannot write the same number two ways. "Gem 1 bøde" / "Gem 2 bøder".
   ✅ **Meeting dates carry their year**, and render in UTC so a plain date
   cannot slide into the month before.
   ✅ **Present/absent no longer rides on hue alone** — filled versus hollow
   pips, a key with the counts in it on every card, and the state in the pip's
   own text rather than a tooltip a phone cannot show.
   ✅ **Tap targets** — "Log ud", the fine chips, the minutes field and the save
   button are all at the design system's 48px floor. `minTapHeightPx` in
   `src/test/harness.tsx` is what the tests assert against.
   ✅ **Small text meets AA** as of T064. Two light-mode tokens were short and
   both are measured in a browser now rather than argued from a hex: `--color-
   faint` was 4.05:1 on the page ground (it had been corrected once against
   white, which is not where most of it sits) and is 4.59:1; `--color-present`
   was 4.02:1 where it is actually read — 8.8px initials on a wash mixed from
   itself in the attendance pips — and is 4.9:1. Every text/background pair on
   all six screens, both themes, now passes 4.5:1 (3:1 large). Filled buttons
   use `--color-brand`, a theme-constant #2563eb where white measures 5.1:1
   against `bg-accent`'s 3.2:1 — with one exception T064 could not see, because
   it swept the six members' screens and `/login` is not one of them. **"Log
   ind" was `bg-accent` and measured 3.23:1 on the dark ground** — the one
   button nobody can get past — and is `bg-brand` since T066. All eight screens
   are now at zero failing pairs. Anything filled added later should be too.

## Phase progress
| Phase | What | State |
|---|---|---|
| 0 | Repo + app scaffold + green pipeline | ✅ **done** (T001) |
| 1 | Schema-as-migration, seed, local stack | ✅ **done** (T010, T012) |
| 2 | RLS test suite | ✅ **done** (T020) — 62 assertions, generated from the rule bar the eight T074 writes named by hand, green in CI |
| 3 | App shell + auth + role gating | ✅ **done** (T030) — login, route gating, 23 offline tests |
| 4 | Read-only screens | ✅ **done** — public landing, members' front page, Anciennitet, Møder, Nyheder, Regler on real data |
| 5 | Anciennitet UI | ✅ **done** — meeting cards + anciennitet chart, mobile-first. The finance curve (was T054) landed 2026-07-27 as T061. |
| 6 | Admin write flows | ✅ **done** — fines, news/events create/edit/delete (T063), and the attendance history itself (T065). Nothing about the club's records is typed into the database by hand any more. |
| 7 | Design | ✅ **done** — corporate blue, the surfaces and the logo intro in `src/index.css` (T031/T060); the two Instrument fonts self-hosted and the system applied to all six members' screens (T064); the icon set and a conformance sweep of all eight screens (T066); the visual hierarchy — accent for action only, figures in the serif, one face per screen (T072); and the character Lukas actually asked for — the finance curves drawing in, the figures under them counting, and a serif date rail giving the Nyheder and Møder cards a face (T073). The dark palette was silently absent from the build until T058 — see its notes. Still open, and written up in `design/README.md`: the members' **type scale** sits one notch below §04's own phone mocks, and there is no desktop layout. |
| 8 | Deploy to Vercel (staging) + e2e | ⬜ not started |
| 9 | Cutover (old site stays live until then) | ⬜ not started |

Full task breakdown: [PLAN.md](PLAN.md) §4. Test spec: [PLAN-REVIEW.md](PLAN-REVIEW.md).

## Green right now
- `npm test` — 394 component/derivation tests (jsdom, fast, offline). Eighteen of
  them are T076's: the club's whole bank statement is pinned as a table and run
  through `allocateDues`, so the reconciliation to 14.880 kr. and the single
  200 kr. outstanding are re-proved on every run rather than remembered in a
  document — along with a catch-up transfer spread across the months it settles,
  a member who starts paying mid-history, and the June 2026 rate change paid in
  two instalments. `allocateDues` **throws** rather than absorbing a transfer it
  cannot place, and there is a test for that too. Nine of
  them are T075's: the club's 28 classified fines are pinned as a table, each
  row carrying its provenance (the Lead's note, or the treasurer's memory), and
  asserted against `fineAmount()`. So the 50 + 5n corroboration is re-proved on
  every run — if `FINE_RULES` is ever amended without dating the change, these
  historical amounts stop reproducing and the suite goes red. A rate change must
  never silently rewrite what a member was charged in 2025. The finance
  chart is asserted through its words, never its SVG: recharts renders in jsdom
  but with no layout, so every coordinate in it is zero. Same reason a tap
  target is asserted through its classes (`minTapHeightPx`): nothing in jsdom
  has a size. The members' scroll-linked reveals are asserted the same way —
  the stylesheet is read as text and checked for its two guards — because jsdom
  has no layout and no scroll, so whether a card actually finishes revealing
  can only be answered in a browser. It was, in T064, on all six screens: see
  that task's notes for the measurements, including why the design export's own
  `cover 26%` range had to become `cover 12%`.
- `npm run build`, `npm run lint` — clean.
- `npm run build:demo` — the whole app as one HTML file with fabricated data
  (`dist-demo/index.html`), for showing the thing without hosting
  anything real. Since T064 it inlines the woff2 faces as data URIs — three of
  them since T066, the two Instrument subsets and the 1 kB icon subset:
  `public/fonts/` is a path only a web server can answer, and left as a URL the
  standalone file 404s on both and quietly renders in Georgia.
  See T058. It is not a deploy and touches no club record. **Its writes are
  in-memory** (T063, extended to meetings in T065): the demo bundle carries the
  live project's URL and anon key, so every mutation short-circuits in
  `data/demo` before the client, and a test asserts the client is never asked.
  Verified in a browser both times: creating, correcting and deleting a news
  item, a calendar entry or a whole meeting with its attendance makes no network
  request at all. The demo is now ~984 kB.
- `npm run test:rls` — 62 RLS assertions vs the local Supabase stack (~1s).
- **CI on every push/PR** (`.github/workflows/ci.yml`): `checks` (lint, build,
  unit) and `rls` (Supabase stack in the runner + the RLS suite). Both green,
  and the `rls` job is proven to go red on a real policy regression — see
  T022's working notes for the evidence.
- Migrations apply clean: **11** tables / 11 RLS-enabled / **28** policies / **3**
  SECURITY DEFINER functions / 1 signup trigger (measured 2026-07-29, T074). Verified by CI's `rls` job on a fresh
  stack, which is also what proves the `members` seed is safe on a database
  that is not this club's: the guard inserts none of the ten there, and the
  four synthetic members come from `seed.sql`. The initial migration is faithful to prod
  (verified 2026-07-24); the 22nd policy is the deliberate 2026-07-26 deviation
  letting admins read member feedback — see PROJECT.md. It must be applied to
  prod at cutover.

## Immediate next tasks (resume here)
1. **Decide whether Leads can record fines** — the one thing blocking the
   finance flow from matching the regulation. See T050's "Capture is built"
   note; it is an access-rule change, so it needs Lukas.
2. ~~**Fill in the missing meeting dates**~~ ✅ **mostly done 2026-07-29 (T071).**
   **17 of 28 dated from Lukas's Outlook calendar, 11 refused.** All 1.780 kr. of
   fines is now inside the monthly ledger. What is left needs Lukas himself, and
   it is small and specific — not more searching:
   - **Meetings 1–4** — nothing club-shaped exists in his calendar before
     2022-10-29. If he has the old invitations anywhere else, four dates follow.
   - **Meeting 18, the London trip** — certainly 18 or 19 January 2025; he only
     has to say which day the dinner was.
   - **Meetings 8, 14–16, 19–20** — the calendar has fewer events than the club
     has meetings in those stretches, so a Lead's agenda is the only source.
   Since T065 the date is set on the meeting's own card under Anciennitet, which
   is where he can add any of these himself.
3. ~~**Import the sheet's history**~~ ✅ **done 2026-07-29 (T068)**, and since
   T071 it hangs off real dates: the fines hang off meeting *records*, 17 of
   which are now dated, and every one of the six fine-bearing meetings is among
   them. `/oekonomi` no longer reports any of the 1.780 kr. as belonging to an
   undated meeting.
   ~~**Ask Lukas when the ninth member joined**~~ ✅ **answered 2026-07-29** and
   then **measured 2026-07-30 (T076)**: his memory said June 2026, and the bank
   says **May 2026** — Christian Have's first transfer is 04.05.2026 for 100 kr.,
   May's rate. `members.dues_from` now carries it for all nine payers, so
   `/oekonomi` charges eight members before May 2026 and nine after, and §13's
   1.200 kr. distortion is gone.
   ~~**The ninth member's retroactive buy-in**~~ — **there is no receivable.**
   §14.5 recorded that he "must still buy in retroactively" and that nothing in
   the schema could hold it. The statement says otherwise: Have's three transfers
   total exactly what the club charged him from May 2026, and he owes nothing.
   What §14.5 was reaching for was **Mads**, who did owe a year of arrears and
   **paid them in full on 01.05.2026** — 1.200 kr., twelve months, no remainder.
   Nobody owes a buy-in, so no receivable concept is needed.
4. **Chase 200 kr. and decide about 730 kr.** — since T078 the 730 is on the page
   as its own figure rather than buried in a wrong total, stated once and with no
   badge or nag, because whether to bill it is his call and not the app's. Since
   2026-07-30 the whole club can see it, which is a nudge no badge could be. — Anders's July 2026 kontingent
   (he has changed bank; the club's only outstanding kontingent) and the 730 kr.
   of fines a Lead noted and nobody billed. Neither is a code task; both are the
   treasurer's.
5. **Deploy to Vercel** (phase 8) — nothing is hosted yet.
6. **T011 — automated schema parity** (`tests/schema/parity.sh`): diff local
   objects (pg_policies, pg_proc, pg_trigger, relrowsecurity, FK confdeltype,
   grants) against the prod snapshot. Currently fidelity is verified by hand.
   ~~**T013 — wire CI**~~ ✅ **done 2026-07-26 as T022.** Add the parity check to
   the `rls` job once T011 exists.
7. Fix the `supabase/seed.sql` header (it says `db:reset` runs seed-auth; it does
   not — only `test:rls:reset` does) and remove the `record_id: 1` coupling in
   `scripts/seed-auth.mjs`.

## Blocked / waiting on Lukas (see PROJECT.md open decisions)
- ~~Q1 finance-chart data source~~ **closed 2026-07-27** — answered 2026-07-26 (derived, in the club's own database, with a quarterly bank confirmation), and the chart it blocked shipped as T061. Nothing is left for Lukas here; what is left is importing the figures.
- Q3 keep prod on free tier (auto-pauses) or upgrade to paid.
- Q4 new URL / domain.
- ~~Design template (Phase 7)~~ **arrived 2026-07-27** — Lukas committed the
  export to `design/`. The seam in `src/index.css` is filled: palette, type
  pairing, surfaces, logo intro. What still needs him is nothing; what needs
  doing is font extraction and the members' screens.

## How to resume after a fresh session
Read [CLAUDE.md](../CLAUDE.md) → this file → [SETUP.md](SETUP.md) to bring the
local stack up. The repo is the memory; trust `git log` and a green test run,
never a status summary.
