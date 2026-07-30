import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { FineInsights } from './FineInsights'
import { IncomeMix } from './IncomeMix'
import type { FineRow } from '../data/fines'

/**
 * The two charts Lukas asked for on 2026-07-30, asserted through their words.
 *
 * Recharts renders in jsdom but with no layout, so every coordinate in it is zero
 * — the same reason FinanceChart.test.tsx never touches an SVG path. What can be
 * asserted offline is what the card *says*, which for these two is most of the
 * point: the values, the names, the unit, and the sentences that stop each chart
 * from being read as something it is not. Whether the bars land where they should
 * was checked in a browser; see the task notes.
 */

const fine = (
  member: string,
  kr: number,
  rule: string,
  minutes: number | null = null,
  settled: string | null = null,
): FineRow => ({
  member_name: member,
  amount_kr: kr,
  record_id: 1,
  rule_id: rule,
  minutes,
  settled_at: settled,
})

const BOOK: FineRow[] = [
  fine('Mads', 200, 'for-sent', 30),
  fine('Saaby', 110, 'for-sent', 12),
  fine('Kasper', 80, 'for-sent', 6),
  fine('Emil', 50, 'skaal'),
  fine('Rasmus', 50, 'skaal'),
  fine('Have', 50, 'drikkevare'),
]

describe('what the fines are about', () => {
  it('leads with the club rather than with a member', () => {
    render(<FineInsights fines={BOOK} />)
    // 48 minutes across three men. The collective figure is the card's face on
    // purpose — for-sent is most of the money by construction, so any per-member
    // reading makes whoever tops it look like the problem when the finding is
    // that nearly everyone is in it.
    expect(screen.getByText('48 min')).toBeInTheDocument()
    // Three men, three late arrivals — asserted through the sentence, because
    // "3" on its own matches the bøde count beside it too.
    expect(screen.getByText(/har klubben tilsammen mødt for sent/).parentElement)
      .toHaveTextContent('3 forsinkelser hos 3 medlemmer')
  })

  it('states the dominance in words as well as drawing it', () => {
    render(<FineInsights fines={BOOK} />)
    // 390 of 540 is 72 %. A reader should not have to measure a bar to get the
    // answer to the question that was asked.
    expect(screen.getByText('72 %')).toBeInTheDocument()
  })

  it('ranks the offences by what they cost, most first', () => {
    render(<FineInsights fines={BOOK} />)
    const rows = screen.getAllByRole('term')
    expect(rows[0]).toHaveTextContent('For sent fremmøde')
    expect(rows[0]).toHaveTextContent('3 bøder')
    expect(rows[1]).toHaveTextContent('Skål før Leads første skål')
  })

  /**
   * The two 50 kr. rows are nine pixels wide at 420 px, and this is why that is
   * survivable: the amount is printed, so nothing on the card is legible only as
   * a length. It is also why there is no log scale and no broken axis — both
   * would make 390 kr. and 100 kr. look comparable.
   */
  it('prints every offence’s amount, including the ones too small to see', () => {
    render(<FineInsights fines={BOOK} />)
    const drinks = screen.getByText('Bestille en anden type drikkevare end Lead under maden')
    expect(within(drinks.closest('div')!).getByText('50 kr.')).toBeInTheDocument()
  })

  it('names who incurred each offence, with the amount', () => {
    render(<FineInsights fines={BOOK} />)
    // Lukas asked for this twice and asked for it to be visible to every member,
    // so it is text at reading size rather than a segment needing a hover.
    const late = screen
      .getByText('For sent fremmøde')
      .closest('div')!
    expect(within(late).getByText('Mads')).toBeInTheDocument()
    expect(within(late).getByText('200 kr.')).toBeInTheDocument()
    expect(within(late).getByText('Saaby')).toBeInTheDocument()
  })

  it('says these are fines charged, not fines paid', () => {
    render(<FineInsights fines={BOOK} />)
    expect(screen.getByText(/Bøder pålagt, ikke bøder betalt/)).toBeInTheDocument()
  })

  it('has a name a screen reader can use, and the figures in it', () => {
    render(<FineInsights fines={BOOK} />)
    const chart = screen.getByRole('img')
    expect(chart).toHaveAccessibleName(/For sent fremmøde: 390 kr/)
    expect(chart).toHaveAccessibleName(/Skål før Leads første skål: 100 kr/)
  })

  it('carries the page’s one motion hook, on the plot and not on the card', () => {
    // Same placement as the finance curve: armed from the card, the sweep would
    // play with the plot still below the fold.
    const { container } = render(<FineInsights fines={BOOK} />)
    expect(container.querySelector('[data-draw]')).toBe(container.querySelector('[role="img"]'))
    // And it is T077's mechanism, not a second one.
    expect(container.querySelector('#ek-fines-sweep .ek-sweep')).toBeTruthy()
  })

  it('says there is nothing to show rather than drawing an empty chart', () => {
    render(<FineInsights fines={[]} />)
    expect(screen.getByText(/ingen forseelser at gøre op/)).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('does not print a lateness figure when nobody has been late', () => {
    render(<FineInsights fines={[fine('Emil', 50, 'skaal')]} />)
    expect(screen.queryByText(/har klubben tilsammen mødt for sent/)).not.toBeInTheDocument()
  })
})

const QUARTERS = [
  { quarter: '2026-Q1', total: 2650, dues: 2400, 'for-sent': 200, skaal: 50, other: 0 },
  { quarter: '2026-Q2', total: 905, dues: 800, 'for-sent': 105, skaal: 0, other: 0 },
]

describe('where the club’s money comes from', () => {
  it('is a legend with the totals in it, not a legend needing a hover', () => {
    render(<IncomeMix quarters={QUARTERS} undatedKr={0} />)
    // The legend, not the table header of the same name.
    const legend = screen.getByRole('img').previousElementSibling!
    expect(within(legend as HTMLElement).getByText('Kontingent')).toBeInTheDocument()
    expect(screen.getByText('3.200 kr.')).toBeInTheDocument()
    expect(screen.getByText('305 kr.')).toBeInTheDocument()
  })

  it('leaves out a segment no quarter has any of', () => {
    render(<IncomeMix quarters={QUARTERS} undatedKr={0} />)
    // A legend entry for 0 kr. is a colour a reader has to look for and will
    // never find on the chart.
    expect(screen.queryByText('Øvrige bøder')).not.toBeInTheDocument()
  })

  it('refuses to present the derived split as the bank’s own', () => {
    render(<IncomeMix quarters={QUARTERS} undatedKr={0} />)
    // The statement holds one combined figure per month and never itemised it
    // (§16). Saying so on the card is the difference between a derivation and a
    // claim about what the bank said.
    expect(screen.getByText(/Kontingentdelen er beregnet/)).toBeInTheDocument()
    expect(screen.getByText(/har aldrig delt det op/)).toBeInTheDocument()
  })

  it('says a payment belongs to the month it covers, not the day it arrived', () => {
    render(<IncomeMix quarters={QUARTERS} undatedKr={0} />)
    expect(screen.getByText(/ikke den dag den kom ind/)).toBeInTheDocument()
  })

  it('says why the unit is a quarter', () => {
    render(<IncomeMix quarters={QUARTERS} undatedKr={0} />)
    expect(screen.getByText(/bøder\s+opkræves kvartalsvist/)).toBeInTheDocument()
  })

  it('states the fines it could not place instead of dropping them silently', () => {
    render(<IncomeMix quarters={QUARTERS} undatedKr={780} />)
    expect(screen.getByText(/780 kr\./)).toBeInTheDocument()
    expect(screen.getByText(/uden dato og indgår ikke i noget kvartal/)).toBeInTheDocument()
  })

  it('has a table view carrying every figure the bars carry', () => {
    render(<IncomeMix quarters={QUARTERS} undatedKr={0} />)
    const table = screen.getByRole('table')
    expect(within(table).getByText('2026-Q1')).toBeInTheDocument()
    expect(within(table).getByText('2.650 kr.')).toBeInTheDocument()
    // An em dash rather than "0 kr.", so a quarter with no skål of any kind does
    // not read as a quarter where somebody was fined nothing.
    expect(within(table).getAllByText('—').length).toBeGreaterThan(0)
  })

  it('uses the same sweep as the other two charts, with its own clip id', () => {
    const { container } = render(<IncomeMix quarters={QUARTERS} undatedKr={0} />)
    expect(container.querySelector('#ek-mix-sweep .ek-sweep')).toBeTruthy()
    expect(container.querySelector('[data-draw]')).toBe(container.querySelector('[role="img"]'))
  })

  it('draws nothing at all when the club has no months yet', () => {
    const { container } = render(<IncomeMix quarters={[]} undatedKr={0} />)
    expect(container).toBeEmptyDOMElement()
  })
})
