import { describe, expect, test } from 'vitest'
import { allocateDues, paymentRows, type Transfer } from './allocation'
import { buildLedger } from './ledger'

/**
 * The accrual rule, and then the club's own bank statement run through it.
 *
 * The unit tests come first because they are the two cases the rule exists for
 * — a catch-up transfer, and a member who starts paying part-way through the
 * history. The statement follows as one long assertion that the rule reproduces
 * the club's real books to the krone, in the same spirit as the fine table
 * pinned in rules.test.ts: the reconciliation of 2026-07-30 is re-proved on
 * every run rather than remembered in a document.
 *
 * The statement is pinned **here** and not in `src/data/`, for the same reason
 * the fine table is: it is evidence, not something the app reads. Nothing in
 * the bundle imports it, and the figures it proves live in the database.
 */

/**
 * Every dues transfer on the club's account, 30.08.2025 – 04.08.2026, decoded
 * from `Erhvervsklubkonto40863416622026073o.csv` (Latin-1, semicolon-delimited,
 * Danish decimals) to 30.07.2026, and from the statement Lukas photographed on
 * 2026-08-08 for the eight after it. The fourth column is the bank's own
 * transfer text, kept because it is what attributes the row.
 *
 * The second statement overlaps the first from 01.06.2026 and reproduces it
 * line for line — same dates, same texts, same amounts — so the overlap is
 * corroboration rather than a second source to reconcile. §17.
 *
 * Two attributions are not read off the text and are marked where they occur:
 * the four bare `Overførsel` lines are **Mads** (Lukas, 2026-07-30 — the one
 * member whose transfers carry no name), and `Ekstra kontingent i juni` is
 * **Esben** by elimination. See docs/finance-reconciliation.md §16.2.
 *
 * The two fine transfers and the −2,61 kr. sweep are deliberately absent: they
 * are not dues. §16.5 and §16.6.
 */
const STATEMENT: [string, string, number, string][] = [
  ['2025-08-30', 'Lukas', 400, 'Erhvervsklub Lukas'],
  ['2025-09-05', 'Rasmus', 400, 'Rasmus Holst Anderse'],
  ['2025-09-05', 'Kasper', 400, 'Kasper jun-sep'],
  ['2025-09-07', 'Esben', 400, 'Kontingent - Esben Clausen'],
  ['2025-09-09', 'Saaby', 400, 'Mathias Saaby'],
  ['2025-09-09', 'Emil', 400, 'Emil juni-september'],
  ['2025-09-25', 'Anders', 400, 'Anders Tørring Hanse'],
  ['2025-09-29', 'Rasmus', 100, 'Rasmus Holst Anderse'],
  ['2025-09-30', 'Lukas', 100, 'Lukas'],
  ['2025-10-01', 'Esben', 100, 'Kontingent - Esben C.'],
  ['2025-10-02', 'Saaby', 100, 'Mathias Saaby'],
  ['2025-10-02', 'Emil', 100, 'Emil kontingent'],
  ['2025-10-02', 'Kasper', 100, 'Kontingent Kasper'],
  ['2025-10-02', 'Anders', 100, 'Anders Tørring Hanse'],
  ['2025-10-30', 'Rasmus', 100, 'Rasmus Holst Anderse'],
  ['2025-10-31', 'Lukas', 100, 'Lukas'],
  ['2025-11-03', 'Esben', 100, 'Kontingent - Esben C.'],
  ['2025-11-04', 'Saaby', 100, 'Mathias Saaby'],
  ['2025-11-04', 'Anders', 100, 'Anders Tørring Hanse'],
  ['2025-11-04', 'Emil', 100, 'Emil kontingent'],
  ['2025-11-04', 'Kasper', 100, 'Kontingent Kasper'],
  ['2025-11-27', 'Rasmus', 100, 'Rasmus Holst Anderse'],
  ['2025-11-28', 'Lukas', 100, 'Lukas'],
  ['2025-12-01', 'Esben', 100, 'Kontingent - Esben C.'],
  ['2025-12-02', 'Anders', 100, 'Anders Tørring Hanse'],
  ['2025-12-02', 'Emil', 100, 'Emil kontingent'],
  ['2025-12-02', 'Kasper', 100, 'Kontingent Kasper'],
  ['2025-12-02', 'Saaby', 100, 'Mathias Saaby'],
  ['2025-12-29', 'Rasmus', 100, 'Rasmus Holst Anderse'],
  ['2025-12-30', 'Lukas', 100, 'Lukas'],
  ['2026-01-02', 'Esben', 100, 'Kontingent - Esben C.'],
  ['2026-01-05', 'Saaby', 100, 'Mathias Saaby'],
  ['2026-01-05', 'Anders', 100, 'Anders Tørring Hanse'],
  ['2026-01-05', 'Kasper', 100, 'Kontingent Kasper'],
  ['2026-01-05', 'Emil', 100, 'Emil kontingent'],
  ['2026-01-29', 'Rasmus', 100, 'Rasmus Holst Anderse'],
  ['2026-01-30', 'Lukas', 100, 'Lukas'],
  ['2026-02-02', 'Esben', 100, 'Kontingent - Esben C.'],
  ['2026-02-03', 'Saaby', 100, 'Mathias Saaby'],
  ['2026-02-03', 'Anders', 100, 'Anders Tørring Hanse'],
  ['2026-02-03', 'Emil', 100, 'Emil kontingent'],
  ['2026-02-03', 'Kasper', 100, 'Kontingent Kasper'],
  ['2026-02-26', 'Rasmus', 100, 'Rasmus Holst Anderse'],
  ['2026-02-27', 'Lukas', 100, 'Lukas'],
  ['2026-03-02', 'Esben', 100, 'Kontingent - Esben C.'],
  ['2026-03-03', 'Emil', 100, 'Emil kontingent'],
  ['2026-03-03', 'Kasper', 100, 'Kontingent Kasper'],
  ['2026-03-03', 'Saaby', 100, 'Mathias Saaby'],
  ['2026-03-03', 'Anders', 100, 'Anders Tørring Hanse'],
  ['2026-03-30', 'Rasmus', 100, 'Rasmus Holst Anderse'],
  ['2026-03-31', 'Lukas', 100, 'Lukas'],
  ['2026-04-01', 'Esben', 100, 'Kontingent - Esben C.'],
  ['2026-04-07', 'Anders', 100, 'Anders Tørring Hanse'],
  ['2026-04-07', 'Emil', 100, 'Emil kontingent'],
  ['2026-04-07', 'Kasper', 100, 'Kontingent Kasper'],
  ['2026-04-07', 'Saaby', 100, 'Mathias Saaby'],
  ['2026-04-29', 'Rasmus', 100, 'Rasmus Holst Anderse'],
  ['2026-04-30', 'Rasmus', 100, 'Rasmus Holst Anderse'],
  ['2026-04-30', 'Lukas', 100, 'Lukas'],
  ['2026-05-01', 'Mads', 1200, 'Overførsel'], // Mads — Lukas, 2026-07-30
  ['2026-05-01', 'Esben', 100, 'Kontingent - Esben C.'],
  ['2026-05-04', 'Anders', 100, 'Anders Tørring Hanse'],
  ['2026-05-04', 'Saaby', 100, 'Mathias Saaby'],
  ['2026-05-04', 'Have', 100, 'Christian Have'], // his first transfer
  ['2026-05-04', 'Emil', 100, 'Emil kontingent'],
  ['2026-05-04', 'Kasper', 100, 'Kontingent Kasper'],
  ['2026-05-28', 'Rasmus', 100, 'Rasmus Holst Anderse'],
  ['2026-05-29', 'Lukas', 100, 'Lukas'],
  ['2026-06-01', 'Esben', 100, 'Kontingent - Esben C.'],
  ['2026-06-02', 'Saaby', 200, 'Mathias Saaby'],
  ['2026-06-02', 'Anders', 200, 'Anders Tørring Hanse'],
  ['2026-06-02', 'Have', 200, 'Christian Have'],
  ['2026-06-02', 'Kasper', 100, 'Kontingent Kasper'],
  ['2026-06-02', 'Emil', 200, 'Emil kontingent'],
  ['2026-06-02', 'Mads', 200, 'Overførsel'], // Mads
  ['2026-06-03', 'Esben', 100, 'Ekstra kontingent i juni (v...'], // Esben, by elimination
  ['2026-06-04', 'Lukas', 100, 'Lukas'],
  ['2026-06-06', 'Kasper', 100, 'Kasper kontingent'],
  ['2026-06-29', 'Rasmus', 200, 'Rasmus Holst Anderse'],
  ['2026-06-30', 'Lukas', 200, 'Lukas'],
  ['2026-07-01', 'Esben', 200, 'Kontingent - Esben C.'],
  ['2026-07-02', 'Mads', 200, 'Overførsel'], // Mads
  ['2026-07-02', 'Have', 200, 'Christian Have'],
  ['2026-07-02', 'Saaby', 200, 'Mathias Saaby'],
  ['2026-07-02', 'Emil', 200, 'Emil kontingent'],
  ['2026-07-02', 'Kasper', 200, 'Kontingent Kasper'],
  ['2026-07-30', 'Rasmus', 200, 'Rasmus Holst Anderse'], // settles August 2026
  // ---- new on the statement of 04.08.2026 (T081) ----
  ['2026-07-31', 'Lukas', 200, 'Lukas'],
  ['2026-08-03', 'Esben', 200, 'Kontingent - Esben C.'],
  // 400, and the only transfer in the club's history that settles two months at
  // the same rate: July 2026, which he owed after changing bank, and August. The
  // text is `Anders Tørring` where every earlier line of his reads `Anders
  // Tørring Hanse` — the new bank, corroborating the reason July was late. §17.
  ['2026-08-03', 'Anders', 400, 'Anders Tørring'],
  ['2026-08-04', 'Emil', 200, 'Emil kontingent'],
  ['2026-08-04', 'Kasper', 200, 'Kontingent Kasper'],
  ['2026-08-04', 'Mads', 200, 'Overførsel'], // Mads
  ['2026-08-04', 'Have', 200, 'Christian Have'],
  ['2026-08-04', 'Saaby', 200, 'Mathias Saaby'],
]

/**
 * First month the club charges each member, as the statement establishes it —
 * `members.dues_from` in the database.
 *
 * Oskar is absent, and that is the point of the map rather than an omission:
 * §12's founding father pays no kontingent, so there is no month to charge him.
 */
const DUES_FROM: Record<string, string> = {
  Lukas: '2025-06',
  Rasmus: '2025-06',
  Kasper: '2025-06',
  Esben: '2025-06',
  Saaby: '2025-06',
  Emil: '2025-06',
  Anders: '2025-06',
  Mads: '2025-06',
  Have: '2026-05',
}

/**
 * The fine money, kept separate from the dues throughout. `Emil bødekasse` 235
 * on 09.02.2026 and `Bøder` 1.545 on 16.02.2026 — the two transfers the sheet's
 * own `E10 = 700+1545+235` named, now seen in the bank.
 */
const FINE_RECEIPTS = [{ month: '2026-02', kr: 235 }, { month: '2026-02', kr: 1545 }]

const RATE_100 = () => 100

describe('a catch-up transfer settles the months it was for', () => {
  test('twelve months of arrears in one transfer land in twelve months', () => {
    const a = allocateDues({
      transfers: [{ date: '2026-05-01', member: 'Mads', kr: 1200 }],
      duesFrom: { Mads: '2025-06' },
      from: '2025-06',
      through: '2026-05',
      rate: RATE_100,
    })

    // Every month of the window settled, none of them twice.
    expect(a.byMonth.map((m) => m.settled)).toEqual(Array(12).fill(100))
    expect(a.outstanding).toBe(0)
    // And the bank total is untouched: allocation moves a payment across
    // months, it cannot create or destroy one.
    expect(a.settled).toBe(1200)
  })

  test('a member paying late is not a member paying less', () => {
    // Same twelve months, same 1.200 kr. One member paid monthly, the other
    // cleared it in May. The books must not be able to tell them apart, because
    // by May they owe the club exactly the same thing: nothing.
    const monthly: Transfer[] = Array.from({ length: 12 }, (_, i) => ({
      date: `${i < 7 ? 2025 : 2026}-${String(((i + 5) % 12) + 1).padStart(2, '0')}-02`,
      member: 'Punctual',
      kr: 100,
    }))
    const opts = { duesFrom: {}, from: '2025-06', through: '2026-05', rate: RATE_100 }
    const p = allocateDues({ ...opts, transfers: monthly, duesFrom: { Punctual: '2025-06' } })
    const l = allocateDues({
      ...opts,
      transfers: [{ date: '2026-05-01', member: 'Late', kr: 1200 }],
      duesFrom: { Late: '2025-06' },
    })
    expect(l.byMonth.map((m) => m.settled)).toEqual(p.byMonth.map((m) => m.settled))
    expect(l.byMember[0].outstanding).toBe(p.byMember[0].outstanding)
  })

  test('a catch-up that does not cover the arrears leaves the newest months open', () => {
    // The half the rule must get right to be trusted at all: oldest first, and
    // what is missing stays missing. 800 kr against twelve months owed is four
    // months still unpaid, not a discount spread thinly over twelve.
    const a = allocateDues({
      transfers: [{ date: '2026-05-01', member: 'Mads', kr: 800 }],
      duesFrom: { Mads: '2025-06' },
      from: '2025-06',
      through: '2026-05',
      rate: RATE_100,
    })
    expect(a.byMonth.filter((m) => m.settled === 100).map((m) => m.month)).toEqual([
      '2025-06', '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01',
    ])
    expect(a.byMonth.filter((m) => m.outstanding > 0).map((m) => m.month)).toEqual([
      '2026-02', '2026-03', '2026-04', '2026-05',
    ])
    expect(a.outstanding).toBe(400)
  })
})

describe('a member who joins mid-history', () => {
  test('is charged from his first month and not before', () => {
    const a = allocateDues({
      transfers: [
        { date: '2026-05-04', member: 'Have', kr: 100 },
        { date: '2026-06-02', member: 'Have', kr: 100 },
        { date: '2026-01-05', member: 'Old', kr: 100 },
        { date: '2026-02-02', member: 'Old', kr: 100 },
        { date: '2026-03-02', member: 'Old', kr: 100 },
        { date: '2026-04-01', member: 'Old', kr: 100 },
        { date: '2026-05-04', member: 'Old', kr: 100 },
        { date: '2026-06-01', member: 'Old', kr: 100 },
      ],
      duesFrom: { Old: '2026-01', Have: '2026-05' },
      from: '2026-01',
      through: '2026-06',
      rate: RATE_100,
    })

    // The roster changes size mid-window, which is the whole point: charging
    // today's members across the whole history is what made the expected-income
    // curve too high in every month the club has ever had (§13).
    expect(a.byMonth.map((m) => m.payers)).toEqual([1, 1, 1, 1, 2, 2])
    expect(a.byMonth.map((m) => m.owed)).toEqual([100, 100, 100, 100, 200, 200])
    // No cell exists for him before he was charged — not a zero, no cell. A
    // zero would read as "owed 100, paid nothing".
    expect(a.grid.filter((c) => c.member === 'Have').map((c) => c.month)).toEqual([
      '2026-05', '2026-06',
    ])
    expect(a.outstanding).toBe(0)
  })

  test('money from a member the club charges nothing is refused, not absorbed', () => {
    // The founding father pays no kontingent (§12). A transfer under his name
    // is either a misattribution or a gift, and both need a human — quietly
    // settling a month with it would put the club's books right by inventing a
    // payer.
    expect(() =>
      allocateDues({
        transfers: [{ date: '2026-05-04', member: 'Oskar', kr: 100 }],
        duesFrom: { Have: '2026-05' },
        from: '2026-05',
        through: '2026-05',
      }),
    ).toThrow(/Oskar/)
  })

  test('money that settles no month inside the horizon is reported, not swallowed', () => {
    expect(() =>
      allocateDues({
        transfers: [{ date: '2026-05-04', member: 'Have', kr: 100_000 }],
        duesFrom: { Have: '2026-05' },
        from: '2026-05',
        through: '2026-05',
        prepayMonths: 2,
      }),
    ).toThrow(/Unexplained/)
  })
})

describe('the rate change of June 2026', () => {
  test('a month at the new rate can be settled by two transfers at the old one', () => {
    // Two members did exactly this: a month ahead at 100 kr., then 100 kr. more
    // once the rate rose to 200. Read as calendar cash it looks like a double
    // payment in one month and a missing one in the next.
    const a = allocateDues({
      transfers: [
        { date: '2026-04-30', member: 'Rasmus', kr: 100 },
        { date: '2026-05-28', member: 'Rasmus', kr: 100 },
      ],
      duesFrom: { Rasmus: '2026-06' },
      from: '2026-06',
      through: '2026-06',
    })
    expect(a.byMonth).toEqual([
      { month: '2026-06', payers: 1, owed: 200, settled: 200, outstanding: 0 },
    ])
  })
})

describe("the club's bank statement, 04.08.2026", () => {
  const transfers: Transfer[] = STATEMENT.map(([date, member, kr]) => ({ date, member, kr }))

  test('every krone of dues in the statement is a krone of dues in the books', () => {
    expect(transfers).toHaveLength(95)
    expect(transfers.reduce((n, t) => n + t.kr, 0)).toBe(15_100)
  })

  const a = allocateDues({
    transfers,
    duesFrom: DUES_FROM,
    from: '2025-06',
    through: '2026-08',
  })

  test('reconciles to 16.880 kr. — the statement\'s own closing balance', () => {
    const fines = FINE_RECEIPTS.reduce((n, f) => n + f.kr, 0)
    expect(fines).toBe(1_780)
    expect(a.settled).toBe(15_100)
    expect(a.settled + fines).toBe(16_880)

    // **Nothing is held out this time, and that is a fact about the calendar
    // rather than a tidier answer.** At 30.07 the books had to hold Rasmus's
    // 200 kr. out as August money (T076) or report eight members delinquent for
    // a month that had barely begun. Here every August transfer has arrived and
    // nobody has paid September in advance yet, so the float is zero and the
    // reconciliation lands exactly on the bank. The gap reopens at the end of
    // August when Rasmus and Lukas transfer again, and it should.
    expect(a.prepaid).toBe(0)
    expect(a.settled + fines + a.prepaid).toBe(16_880)
  })

  test('no kontingent is outstanding anywhere — the first time in fourteen months', () => {
    // Anders's 200 kr. of July 2026 was the club's only outstanding kontingent
    // since June 2025. He settled it on 03.08 with a 400 kr. transfer covering
    // July and August, having changed bank. Note the allocation is not told
    // that: FIFO places it across the two months on its own, and the fact that
    // 400 divides into exactly the months he owed with no remainder is what
    // corroborates the reading. §17.
    expect(a.outstanding).toBe(0)
    expect(a.byMember.filter((m) => m.outstanding > 0)).toEqual([])
    expect(a.grid.filter((c) => c.settled < c.owed)).toEqual([])
    expect(a.byMember.find((m) => m.member === 'Anders')).toEqual({
      member: 'Anders', owed: 1_800, settled: 1_800, outstanding: 0, prepaid: 0,
    })
  })

  test('every month from June 2025 to August 2026 is settled in full', () => {
    // Fifteen months with nothing outstanding, and the payer count rising from
    // eight to nine in May 2026 when Christian Have's first transfer arrives.
    expect(a.byMonth.map((m) => m.payers)).toEqual([
      8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 9, 9, 9, 9,
    ])
    expect(a.byMonth.every((m) => m.outstanding === 0)).toBe(true)
    expect(a.byMonth.map((m) => m.owed)).toEqual([
      800, 800, 800, 800, 800, 800, 800, 800, 800, 800, 800, 900, 1800, 1800, 1800,
    ])
  })

  test('Mads reads as having paid every month, and has', () => {
    // The point of the exercise. Four transfers — 1.200 in May 2026, then 200 a
    // month — settle fifteen months, and the man who paid a year late is
    // recorded as owing the club nothing, because he owes the club nothing.
    const mads = a.grid.filter((c) => c.member === 'Mads')
    expect(mads).toHaveLength(15)
    expect(mads.every((c) => c.settled === c.owed)).toBe(true)
    expect(a.byMember.find((m) => m.member === 'Mads')).toEqual({
      member: 'Mads', owed: 1_800, settled: 1_800, outstanding: 0, prepaid: 0,
    })
    // And the bank is not flattered by it: his 1.800 kr. is exactly the 1.800
    // kr. the statement shows arriving under `Overførsel`.
    expect(transfers.filter((t) => t.member === 'Mads').reduce((n, t) => n + t.kr, 0)).toBe(1_800)
  })

  test('the payments rows sum to the reconciled balance', () => {
    const rows = paymentRows(a, FINE_RECEIPTS)
    expect(rows).toHaveLength(15)
    expect(rows.reduce((n, r) => n + r.amount_kr, 0)).toBe(16_880)
    // February 2026 is the club's one month with fines in it: 800 kr. of dues
    // plus the 1.780 kr. of fines the treasurer collected in two transfers.
    expect(rows.find((r) => r.month === '2026-02')).toEqual({ month: '2026-02', amount_kr: 2_580 })
    // July was 1.600 until Anders settled it, and August is nine of nine.
    expect(rows.find((r) => r.month === '2026-07')).toEqual({ month: '2026-07', amount_kr: 1_800 })
    expect(rows.find((r) => r.month === '2026-08')).toEqual({ month: '2026-08', amount_kr: 1_800 })
  })

  test('through the ledger, the 730 kr. of unbilled fines is all that is left', () => {
    // Every fine the club has incurred, by the month of the meeting that
    // produced it — the 2.510 kr. of `fines` as T075 left it. Note the window
    // opens a month before the dues do, because møde #21 was 31 May 2025 and a
    // fine belongs to its own evening.
    const fines = [
      ['2025-05', 275], ['2025-08', 405], ['2025-10', 305], ['2025-11', 270],
      ['2026-01', 475], ['2026-02', 230], ['2026-04', 80], ['2026-06', 470],
    ].map(([month, amount_kr]) => ({
      month: month as string, member_name: 'n/a', amount_kr: amount_kr as number,
    }))
    expect(fines.reduce((n, f) => n + f.amount_kr, 0)).toBe(2_510)

    const ledger = buildLedger({
      from: '2025-05',
      to: '2026-08',
      fines,
      payments: paymentRows(a, FINE_RECEIPTS),
      payingMembers: (month) =>
        Object.values(DUES_FROM).filter((from) => from <= month).length,
    })
    const last = ledger[ledger.length - 1]
    expect(last.actualBalance).toBe(16_880)
    // May 2025 charges no kontingent — the club's dues start in June, and the
    // payer count is asked per month rather than assumed from today's roster.
    expect(ledger[0].dues).toBe(0)
    expect(ledger.reduce((n, m) => n + m.dues, 0)).toBe(15_100)

    // And the whole of the club's position in one figure. Until 03.08.2026 this
    // was 930: Anders's 200 kr. of July plus the fines. The 200 is settled, so
    // what is left is **only** the 730 kr. of fines a Lead noted and nobody ever
    // billed (§15.1). Incurred and collected stay two different quantities:
    // 2.510 was charged, 1.780 came in, and the 730 between them is the club
    // being owed money — not a reconciliation error to be tidied away, and not
    // something a settled kontingent month makes go away.
    expect(last.outstanding).toBe(730)
  })
})
