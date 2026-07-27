import { render, screen } from '@testing-library/react'
import { MeetingCard } from './MeetingCard'
import type { Meeting } from '../data/derive'

/**
 * One meeting, as the Anciennitet page draws it.
 *
 * The club's history runs from December 2021 to June 2026, and this card is the
 * only place a member ever sees a meeting's date or who was at it. Both of those
 * were readable only by someone who already knew the answer.
 */
function meeting(over: Partial<Meeting> = {}): Meeting {
  return {
    id: 1,
    number: 12,
    lead: 'Esben',
    date: '2021-12-04',
    month: '2021-12',
    route: ['Propaganda'],
    present: ['Mads'],
    absent: ['Saaby'],
    ...over,
  }
}

const LABELS = { Mads: 'Ma', Saaby: 'Sa' }

describe('the date on a meeting card', () => {
  it('says which year, on a history four and a half years long', () => {
    render(<MeetingCard meeting={meeting()} labels={LABELS} />)
    // It read "4. dec." — and five of the cards do, across five different
    // Decembers, with nothing to tell them apart.
    expect(screen.getByText('4. dec. 2021')).toBeInTheDocument()
  })

  it('tells two Decembers apart', () => {
    render(<MeetingCard meeting={meeting()} labels={LABELS} />)
    render(<MeetingCard meeting={meeting({ id: 2, date: '2025-12-04' })} labels={LABELS} />)
    expect(screen.getByText('4. dec. 2021')).toBeInTheDocument()
    expect(screen.getByText('4. dec. 2025')).toBeInTheDocument()
  })

  it('does not slide into the month before in a western timezone', () => {
    // These are plain YYYY-MM-DD dates, so they parse as UTC midnight. Printed
    // in a zone behind UTC, the 1st of a month becomes the last day of the one
    // before and the meeting quietly moves — which is worse than an unformatted
    // date, because it looks right. A suite that only ever runs in UTC would
    // never see it, so the zone is moved for this one assertion.
    vi.stubEnv('TZ', 'America/New_York')
    try {
      render(<MeetingCard meeting={meeting({ date: '2021-12-01' })} labels={LABELS} />)
      expect(screen.getByText('1. dec. 2021')).toBeInTheDocument()
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('says so plainly when there is no date', () => {
    render(<MeetingCard meeting={meeting({ date: null, month: null })} labels={LABELS} />)
    expect(screen.getByText('uden dato')).toBeInTheDocument()
  })
})

/**
 * What is left of a pip once every colour is taken off it.
 *
 * jsdom cannot see colour, and the question is not whether the pip is green
 * anyway — it is whether the two states are still told apart when colour is
 * gone. For the one man in twelve who cannot separate this green from this red,
 * that is not a thought experiment.
 */
const withoutColour = (el: HTMLElement) =>
  el.className
    .split(/\s+/)
    .filter((c) => c && !/present|absent|accent/.test(c))
    .sort()
    .join(' ')

describe('who was at a meeting', () => {
  const attended = meeting({ present: ['Mads', 'Have', 'Emil'], absent: ['Saaby'] })
  const labels = { Mads: 'Ma', Have: 'Ha', Emil: 'Em', Saaby: 'Sa' }

  it('does not depend on telling green from red', () => {
    render(<MeetingCard meeting={attended} labels={labels} />)
    // The two used to differ in nothing but hue: strip the colours and the
    // present pip and the absent one were the same object.
    expect(withoutColour(screen.getByTitle('Mads'))).not.toEqual(
      withoutColour(screen.getByTitle('Saaby')),
    )
  })

  it('says the state in words, not only in a tooltip', () => {
    render(<MeetingCard meeting={attended} labels={labels} />)
    // The only text alternative was `title`, and there is no hover on a phone.
    expect(screen.getByTitle('Mads')).toHaveTextContent('Ma til stede')
    expect(screen.getByTitle('Saaby')).toHaveTextContent('Sa ikke til stede')
  })

  it('carries its own key, with the counts in it', () => {
    render(<MeetingCard meeting={attended} labels={labels} />)
    const card = screen.getByRole('article')
    expect(card).toHaveTextContent('3 til stede')
    expect(card).toHaveTextContent('1 ikke til stede')
  })

  it('rings the reader’s own pip', () => {
    render(<MeetingCard meeting={attended} labels={labels} me="Emil" />)
    expect(screen.getByTitle('Emil').className).toContain('outline-accent')
    expect(screen.getByTitle('Mads').className).not.toContain('outline-accent')
  })
})
