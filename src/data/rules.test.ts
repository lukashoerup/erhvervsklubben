import {
  AGREED_RULE_ID,
  DUES_SCHEDULE,
  FINE_RULES,
  HISTORIC_RULE_ID,
  VOLUNTARY_RULE_ID,
  describeRule,
  duesFor,
  duesForMonth,
  fineAmount,
} from './rules'

describe('fine amounts', () => {
  test('match the regulation', () => {
    const byId = Object.fromEntries(FINE_RULES.map((r) => [r.id, r.kr]))
    expect(byId).toEqual({
      udeblivelse: 200,
      'sent-afbud': 100,
      'for-sent': 50,
      drikkevare: 50,
      skaal: 50,
    })
  })

  test('late arrival is 50 kr plus 5 kr per minute', () => {
    const late = FINE_RULES.find((r) => r.id === 'for-sent')!
    expect(fineAmount(late, 0)).toBe(50)
    expect(fineAmount(late, 1)).toBe(55)
    expect(fineAmount(late, 12)).toBe(110)
  })

  test('only late arrival has a per-minute component', () => {
    for (const rule of FINE_RULES.filter((r) => r.id !== 'for-sent')) {
      expect(fineAmount(rule, 30)).toBe(rule.kr)
    }
  })

  test('minutes cannot reduce a fine', () => {
    // A negative or fractional value must never make someone owe less than the
    // base amount — it would be a quiet way to under-charge.
    const late = FINE_RULES.find((r) => r.id === 'for-sent')!
    expect(fineAmount(late, -10)).toBe(50)
    expect(fineAmount(late, 2.9)).toBe(60)
  })

  test('the two waivable rules are the two the regulation allows', () => {
    expect(FINE_RULES.filter((r) => r.waiver).map((r) => r.id).sort()).toEqual([
      'drikkevare',
      'for-sent',
    ])
  })
})

describe('membership dues', () => {
  test('follow the vote, not the stale document', () => {
    expect(duesFor('2026-05')).toBe(100)
    expect(duesFor('2026-06')).toBe(200)
    expect(duesFor('2027-01')).toBe(200)
  })

  test('reconcile against the real sheet history', () => {
    // The sheet shows 800 kr/month at 8 active members before the change, and
    // 1,800 kr from June 26 at 9 × 200. If this stops matching, the migration
    // of past months is wrong and every later balance is wrong with it.
    expect(duesForMonth('2026-05', 8)).toBe(800)
    expect(duesForMonth('2026-06', 9)).toBe(1800)
  })

  test('only active members pay — §3', () => {
    expect(duesForMonth('2026-06', 0)).toBe(0)
    expect(duesForMonth('2026-06', 5)).toBe(1000)
  })

  test('the schedule is ordered, so the lookup stays correct', () => {
    const froms = DUES_SCHEDULE.map((r) => r.from)
    expect([...froms].sort()).toEqual(froms)
  })
})

/**
 * The club's real fines, with the offence each one is now recorded under — T075.
 *
 * `source` is not decoration. Twenty-eight of the club's twenty-nine fines
 * carry a rule from the regulation, and they got there two different ways:
 *
 * - **`note`** — a Lead wrote the offence down *in words* at the time
 *   ("Emil: bøde for skål 50kr", "Saaby: 6 min for sent"). Contemporaneous.
 * - **`treasurer`** — Lukas answered for the rest from memory on 2026-07-30,
 *   *"De bøder som du har spærret for var alle pga. for sent fremmøde. Jeg kan
 *   godt huske det."* Recollection, four years deep in places.
 *
 * Neither was allowed to stand on its own arithmetic. `for-sent` costs
 * 50 kr + 5 kr/minute, so a late arrival's amount must be 50 + 5n for a whole
 * n — and every one of these does divide, which is what turns a recollection
 * into a corroborated one. The two together are much stronger than either:
 * the treasurer remembers late arrivals, and every amount independently *is*
 * a whole number of minutes at the club's own rate.
 *
 * Pinned here because that check is the club's evidence and not a one-off run
 * at import time. If `FINE_RULES` is ever amended without dating the change,
 * these historical amounts stop reproducing and this goes red — which is the
 * point. A rate change must never silently rewrite what a member was charged
 * in 2025.
 */
const CLUB_FINES: {
  meeting: number
  member: string
  ruleId: string
  minutes: number
  kr: number
  source: 'note' | 'treasurer'
}[] = [
  // Møde #21, Esben lead, Bjælkehuset, 2025-05-31.
  { meeting: 21, member: 'Kasper', ruleId: 'for-sent', minutes: 10, kr: 100, source: 'treasurer' },
  { meeting: 21, member: 'Rasmus', ruleId: 'for-sent', minutes: 9, kr: 95, source: 'treasurer' },
  { meeting: 21, member: 'Anders', ruleId: 'for-sent', minutes: 6, kr: 80, source: 'treasurer' },

  // Møde #22, Lukas lead, Tivolihallen, 2025-08-30 — the only one of the
  // spreadsheet's five columns whose note records offences and not just sums.
  { meeting: 22, member: 'Kasper', ruleId: 'for-sent', minutes: 11, kr: 105, source: 'note' },
  { meeting: 22, member: 'Emil', ruleId: 'skaal', minutes: 0, kr: 50, source: 'note' },
  { meeting: 22, member: 'Rasmus', ruleId: 'skaal', minutes: 0, kr: 50, source: 'note' },
  { meeting: 22, member: 'Mads', ruleId: 'for-sent', minutes: 30, kr: 200, source: 'treasurer' },

  // Møde #23, Oskar lead, Café Lindevang, 2025-10-11. Oskar's own 75 kr is
  // noted in Lukas's records and is not here, and never was: §12's founding
  // father incurs no fines, and the sheet never charged him either.
  { meeting: 23, member: 'Emil', ruleId: 'for-sent', minutes: 5, kr: 75, source: 'treasurer' },
  { meeting: 23, member: 'Saaby', ruleId: 'for-sent', minutes: 5, kr: 75, source: 'treasurer' },
  { meeting: 23, member: 'Esben', ruleId: 'for-sent', minutes: 21, kr: 155, source: 'treasurer' },

  // Møde #24, Emil lead, Les St Jacques, 2025-11-21. Oskar's 200 kr: as above.
  { meeting: 24, member: 'Saaby', ruleId: 'for-sent', minutes: 30, kr: 200, source: 'treasurer' },
  { meeting: 24, member: 'Esben', ruleId: 'for-sent', minutes: 4, kr: 70, source: 'treasurer' },

  // Møde #25, Saaby lead, Marv og Ben, 2026-01-24 — the club's most expensive
  // evening, and the one no note survives for at all.
  { meeting: 25, member: 'Kasper', ruleId: 'for-sent', minutes: 2, kr: 60, source: 'treasurer' },
  // The sheet stores this cell as `{=60+50}`, i.e. two bundled offences. As a
  // single twelve-minute arrival it fits both the formula and Lukas's answer,
  // but it cannot be two late arrivals — see the cap below. Flagged in §15.
  { meeting: 25, member: 'Emil', ruleId: 'for-sent', minutes: 12, kr: 110, source: 'treasurer' },
  { meeting: 25, member: 'Mads', ruleId: 'for-sent', minutes: 27, kr: 185, source: 'treasurer' },
  { meeting: 25, member: 'Saaby', ruleId: 'for-sent', minutes: 2, kr: 60, source: 'treasurer' },
  { meeting: 25, member: 'Esben', ruleId: 'for-sent', minutes: 2, kr: 60, source: 'treasurer' },

  // Møde #26, Anders lead, Le Petit Rouge, 2026-02-21 — never in the sheet.
  { meeting: 26, member: 'Esben', ruleId: 'for-sent', minutes: 2, kr: 60, source: 'note' },
  { meeting: 26, member: 'Rasmus', ruleId: 'for-sent', minutes: 2, kr: 60, source: 'note' },
  { meeting: 26, member: 'Have', ruleId: 'for-sent', minutes: 2, kr: 60, source: 'note' },

  // Møde #27, Rasmus lead, Restaurant Tokyo, 2026-04-24 — never in the sheet.
  { meeting: 27, member: 'Saaby', ruleId: 'for-sent', minutes: 6, kr: 80, source: 'note' },

  // Møde #28, Esben lead, Propaganda, 2026-06-26, generalforsamlingen — after
  // the sheet's last save, so it could never have been in it.
  { meeting: 28, member: 'Mads', ruleId: 'for-sent', minutes: 6, kr: 80, source: 'note' },
  { meeting: 28, member: 'Kasper', ruleId: 'for-sent', minutes: 6, kr: 80, source: 'note' },
  { meeting: 28, member: 'Emil', ruleId: 'for-sent', minutes: 9, kr: 95, source: 'note' },
  { meeting: 28, member: 'Anders', ruleId: 'for-sent', minutes: 3, kr: 65, source: 'note' },
  // The two the note named in words with no amount beside them. A named
  // offence fixes its own price — both rules are flat 50 kr — which is the
  // opposite of the sheet's problem and the reason these are not guesses.
  { meeting: 28, member: 'Have', ruleId: 'drikkevare', minutes: 0, kr: 50, source: 'note' },
  { meeting: 28, member: 'Rasmus', ruleId: 'skaal', minutes: 0, kr: 50, source: 'note' },
  { meeting: 28, member: 'Mads', ruleId: 'skaal', minutes: 0, kr: 50, source: 'note' },
]

describe('the offences behind the club’s fines (T075)', () => {
  test('the regulation reproduces every amount the club charged', () => {
    for (const f of CLUB_FINES) {
      const rule = FINE_RULES.find((r) => r.id === f.ruleId)!
      expect(
        `#${f.meeting} ${f.member} ${f.ruleId} ${f.minutes}m = ${fineAmount(rule, f.minutes)}`,
      ).toBe(`#${f.meeting} ${f.member} ${f.ruleId} ${f.minutes}m = ${f.kr}`)
    }
  })

  test('every late arrival is a whole number of minutes at the club’s rate', () => {
    // The test that corroborates Lukas's recollection. A fine that is not
    // 50 + 5n for a whole, non-negative n is not a late arrival, whatever
    // anyone remembers — it would have to stay `historisk` and be reported.
    for (const f of CLUB_FINES.filter((x) => x.ruleId === 'for-sent')) {
      expect((f.kr - 50) % 5).toBe(0)
      expect(f.kr).toBeGreaterThanOrEqual(50)
      expect((f.kr - 50) / 5).toBe(f.minutes)
    }
  })

  test('the amounts are the ones the sheet and the annual report reconciled', () => {
    // T075 set `rule_id` and `minutes`. It must never have moved money: these
    // 28 plus Lukas's own 50 kr are the 2.510 kr the club has been fined, and
    // the 1.780 kr the annual report collected is a subset of it.
    expect(CLUB_FINES.reduce((n, f) => n + f.kr, 0) + 50).toBe(2510)
  })

  test('every offence charged is one the club actually voted', () => {
    // A fine must name a rule from the regulation. `historisk` is the one id
    // allowed to sit outside it, and no row here may quietly become it.
    for (const f of CLUB_FINES) {
      expect(FINE_RULES.map((r) => r.id)).toContain(f.ruleId)
      expect(f.ruleId).not.toBe(HISTORIC_RULE_ID)
    }
  })

  test('minutes belong to late arrival and to nothing else', () => {
    // `minutes = 0` on a skål is not a claim that someone was zero minutes
    // late; the rule has no minutes. Writing one would invent a measurement.
    for (const f of CLUB_FINES) {
      if (f.ruleId !== 'for-sent') expect(f.minutes).toBe(0)
      else expect(f.minutes).toBeGreaterThan(0)
    }
  })

  test('one fine per offence per meeting, per member — the regulation’s cap', () => {
    // Also the table's unique key `(record_id, member_name, rule_id)`. Mads is
    // fined twice at møde #28, which is allowed because the two are different
    // offences; the same offence twice would not be — which is why Emil's
    // bundled 110 kr at møde #25 cannot be two late arrivals.
    const keys = CLUB_FINES.map((f) => `${f.meeting}/${f.member}/${f.ruleId}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  test('the founding father is charged nothing, at either meeting', () => {
    // Oskar is named in Lukas's notes twice — 75 kr under his own lead and
    // 200 kr under Emil's — and charged in neither. §12, and the first
    // independent evidence the exemption was practised and not just stated.
    expect(CLUB_FINES.filter((f) => f.member === 'Oskar')).toEqual([])
  })

  test('each of them renders as the offence, not as an unknown id', () => {
    // The half of T075 that is a display question: a fine that has gained a
    // real rule must read as the regulation's own words on the page, and not
    // fall through to `Ukendt bøderegel (...)`.
    for (const f of CLUB_FINES) {
      expect(describeRule(f.ruleId)).not.toMatch(/^Ukendt/)
      expect(describeRule(f.ruleId)).not.toMatch(/^Historisk/)
    }
    expect(describeRule('skaal')).toBe('Skål før Leads første skål')
    expect(describeRule('drikkevare')).toBe(
      'Bestille en anden type drikkevare end Lead under maden',
    )
  })

  test('the three non-rule ids each say a different thing, and none is a rule', () => {
    // They are three because they mean three things, and using the wrong one puts
    // a false statement in the club's books about a named member. `historisk` says
    // nobody knows what the offence was. `frivillig` says nobody charged him.
    // `aftalt` — added 2026-08-08 for Esben's bowling defeat — says the club knew
    // exactly what it was, charged him for it, and never voted a rule for it.
    const ids = [HISTORIC_RULE_ID, VOLUNTARY_RULE_ID, AGREED_RULE_ID]
    expect(new Set(ids).size).toBe(3)
    expect(new Set(ids.map(describeRule)).size).toBe(3)

    // None may be tappable in the capture UI: none has an amount, because none is
    // a price the club set. A chip for any of them would imply one.
    for (const id of ids) expect(FINE_RULES.map((r) => r.id)).not.toContain(id)
    for (const id of ids) expect(describeRule(id)).not.toMatch(/^Ukendt/)

    expect(describeRule(AGREED_RULE_ID)).toBe('Aftalt bøde — uden for regulativet')
  })

  test('the one fine still without an offence keeps saying so', () => {
    // Lukas's own 50 kr at møde #26 — the voluntary fine he transferred as
    // treasurer (T071 §14.4). 50 kr is `for-sent` at zero minutes *and*
    // exactly what skål and drikkevare cost, so the arithmetic decides
    // nothing, and his answer was about the fines he had blocked, not this
    // one. It is the last `historisk` row in the club's books.
    expect(describeRule(HISTORIC_RULE_ID)).toBe('Historisk bøde — forseelse ikke registreret')
  })
})

describe('rule ids this build does not know', () => {
  // All 18 fines imported from the old spreadsheet (T068) carried 'historisk',
  // because the sheet stored amounts and never which offence produced them.
  // T075 left exactly one still carrying it. The page must say so rather than
  // render a blank reason — and must keep being able to, for the next import.
  test('the historic import describes itself', () => {
    expect(describeRule(HISTORIC_RULE_ID)).toBe('Historisk bøde — forseelse ikke registreret')
  })

  test('never offered as something to charge', () => {
    // It has no amount and the club never voted it. If it ever reaches
    // FINE_RULES it becomes tappable in the capture UI, and a Lead can fine a
    // member for nothing in particular.
    expect(FINE_RULES.map((r) => r.id)).not.toContain(HISTORIC_RULE_ID)
  })

  test('a future rule id renders as unknown and keeps its id', () => {
    // rule_id is text so the club can vote in a rule without a migration, so
    // an id from the future is a normal thing to read, not a bug. Blank would
    // read as "no reason given"; this reads as "not known here", and carries
    // the id someone debugging needs.
    expect(describeRule('mobil-ved-bordet')).toBe('Ukendt bøderegel (mobil-ved-bordet)')
  })

  test('known rules still describe as the regulation words them', () => {
    expect(describeRule('udeblivelse')).toBe('Udeblivelse uden afbud')
    expect(describeRule('for-sent')).toBe('For sent fremmøde')
  })

  test('never blank, whatever it is given', () => {
    for (const id of ['', 'historisk', 'udeblivelse', 'x', '../../etc']) {
      expect(describeRule(id).trim().length).toBeGreaterThan(0)
    }
  })
})

/**
 * The voluntary id, added when Lukas named what his own 50 kr. actually was.
 *
 * Worth its own test rather than folding into the historic one: the whole point
 * of splitting them is that they mean opposite things — one is "nobody knows",
 * the other is "somebody chose to" — and a single assertion covering both would
 * pass just as well if they were collapsed back together.
 */
describe('frivillige indbetalinger', () => {
  it('is named in the club’s own words, not as an unknown rule', () => {
    expect(describeRule(VOLUNTARY_RULE_ID)).toBe('Frivillige bøder/indbetalinger')
    expect(describeRule(VOLUNTARY_RULE_ID)).not.toMatch(/ukendt|historisk/i)
  })

  it('is not something a Lead can charge anyone under', () => {
    // It must never reach the capture screen as a chip: nobody is fined for
    // volunteering. Same guarantee the historic id has.
    expect(FINE_RULES.map((r) => r.id)).not.toContain(VOLUNTARY_RULE_ID)
  })

  it('stays distinct from the historic id', () => {
    expect(VOLUNTARY_RULE_ID).not.toBe(HISTORIC_RULE_ID)
    expect(describeRule(HISTORIC_RULE_ID)).not.toBe(describeRule(VOLUNTARY_RULE_ID))
  })
})
