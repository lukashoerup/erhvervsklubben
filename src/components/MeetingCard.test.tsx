import { render, screen } from '@testing-library/react'
import { AttendanceSummary, MeetingCard } from './MeetingCard'
import type { Meeting, RosterEntry } from '../data/derive'
import { describeRule } from '../data/rules'

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
    venues: { pre: null, main: 'Propaganda', post: null },
    // Null by default, which is 20 of the club's 28 meetings: the card has to be
    // exactly what it was before 2026-07-30 for an evening nobody wrote about.
    description: null,
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

/**
 * The way into a meeting, 2026-07-30. Lukas: "Man skal også gerne kunne klikke
 * sig ind på et møde på ancinitetssiden for et medlem og læse fulde beskrivelse
 * samt se hvilke bøder der er blevet udgivet til det møde."
 *
 * Two things are load-bearing and neither is the styling. **A member gets it** —
 * this is not one of the treasurer's screens, and the card takes no role at all,
 * which is the strongest form that guarantee comes in. And **a meeting with
 * nothing to say opens onto nothing**: 20 of the club's 28 have no description
 * and no fines, so a disclosure that always rendered would put an empty fold on
 * two-thirds of the longest page in the app.
 */
describe('clicking into a meeting', () => {
  const FINES = [
    { member_name: 'Emil', rule_id: 'for-sent', minutes: 9, amount_kr: 95 },
    // Real rule ids, both of them: the two the club has actually used (T075).
    // A made-up id would fall through `describeRule` to a generic string and the
    // assertion below would pass without the offence ever being looked up.
    { member_name: 'Holst', rule_id: 'skaal', minutes: null, amount_kr: 60 },
  ]

  it('shows the description and opens onto the whole of it', () => {
    const long =
      'Vi mødes i privaten hos Lead på Nørrebro, hvorefter turen går til Tivolihallen i Indre By.'
    render(<MeetingCard meeting={meeting({ description: long })} labels={LABELS} />)

    // One element, clamped shut and unclamped open — not two copies of the text,
    // which a screen reader would read twice.
    const summary = screen.getByText(long)
    expect(summary.className).toContain('line-clamp-2')
    expect(summary.className).toContain('group-open:line-clamp-none')
    expect(screen.getByText('Mere')).toBeInTheDocument()
    expect(screen.getByText('Skjul')).toBeInTheDocument()
  })

  it('lists the meeting’s fines, with the offence in words', () => {
    render(<MeetingCard meeting={meeting()} labels={LABELS} fines={FINES} />)
    const card = screen.getByRole('article')

    // The offence, never the amount decoded back into one: 95 kr. is
    // arithmetically nine minutes late, and T075 refused that inference for the
    // whole history. The rule the row carries is what gets printed.
    expect(card).toHaveTextContent('Emil')
    expect(card).toHaveTextContent('95 kr.')
    expect(card).toHaveTextContent('Holst')
    expect(card).toHaveTextContent('60 kr.')
    expect(card).toHaveTextContent(describeRule('for-sent'))
    expect(card).toHaveTextContent(describeRule('skaal'))
    // The total, so the fold says what it is worth opening for.
    expect(card).toHaveTextContent('155 kr.')
  })

  it('prints the club’s own words on an ad-hoc fine, not the bucket’s name', () => {
    // Lukas, 2026-08-08, from the bowling alley: *"når vi finder på væddemål hvor
    // vi giver bøder af hov."* An `aftalt` row's rule id says only "the club agreed
    // something", which beside an amount is the `historisk` problem T075 spent a
    // migration clearing up. The reason is the row's own note, and the database
    // refuses an ad-hoc fine without one.
    render(
      <MeetingCard
        meeting={meeting()}
        labels={LABELS}
        fines={[
          {
            member_name: 'Esben',
            rule_id: 'aftalt',
            minutes: null,
            amount_kr: 100,
            note: 'Tabte 1. runde i bowling',
          },
        ]}
      />,
    )
    const card = screen.getByRole('article')
    expect(card).toHaveTextContent('Tabte 1. runde i bowling')
    expect(card).not.toHaveTextContent(describeRule('aftalt'))
  })

  it('lists two ad-hoc fines against one man on one evening', () => {
    // The constraint the club's regulativ puts on its five voted rules — one fine
    // per offence per meeting — never applied to this bucket, and enforcing it here
    // is what forced Esben's two bowling rounds to be summed into a single row on
    // the night. Two rounds are two things, and the card has to show both.
    render(
      <MeetingCard
        meeting={meeting()}
        labels={LABELS}
        fines={[
          { member_name: 'Esben', rule_id: 'aftalt', minutes: null, amount_kr: 100, note: '1. runde' },
          { member_name: 'Esben', rule_id: 'aftalt', minutes: null, amount_kr: 50, note: '2. runde' },
        ]}
      />,
    )
    const card = screen.getByRole('article')
    expect(card).toHaveTextContent('1. runde')
    expect(card).toHaveTextContent('2. runde')
    expect(card).toHaveTextContent('150 kr.')
  })

  it('falls back to the rule when a row carries no note', () => {
    // Which is almost every row the club has: for the five voted rules the id *is*
    // the reason, and a note would only repeat it.
    render(<MeetingCard meeting={meeting()} labels={LABELS} fines={FINES} />)
    expect(screen.getByRole('article')).toHaveTextContent(describeRule('skaal'))
  })

  it('prints the minutes only where the row holds them', () => {
    render(<MeetingCard meeting={meeting()} labels={LABELS} fines={FINES} />)
    const rows = screen.getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('9 min')
    expect(rows[1]).not.toHaveTextContent('min')
  })

  it('names what is inside when the evening has no description', () => {
    render(<MeetingCard meeting={meeting()} labels={LABELS} fines={FINES} />)
    // Without prose there is nothing to preview, so the summary says why it is
    // worth a tap. Danish has a singular and a plural and neither is "bøde(r)".
    expect(screen.getByText('2 bøder på mødet')).toBeInTheDocument()
  })

  it('leaves a meeting with nothing to say exactly as it was', () => {
    render(<MeetingCard meeting={meeting()} labels={LABELS} />)
    expect(screen.queryByText('Mere')).not.toBeInTheDocument()
    expect(screen.getByRole('article').querySelector('details')).toBeNull()
  })
})

describe('the anciennitet strip', () => {
  // Lukas, 2026-09-05: "Kan vi få ind på anciennitetsgrafen hvor mange gange folk
  // har været lead? Tænker en linje." It is a line of figures, one under each
  // name, said once under the strip — not a line drawn across ten people.
  const roster: RosterEntry[] = [
    { name: 'Anders', attended: 22, total: 29, label: 'An', status: 'aktiv', duesFrom: null, led: 4 },
    { name: 'Kasper', attended: 20, total: 29, label: 'Ka', status: 'aktiv', duesFrom: null, led: 1 },
    { name: 'Have', attended: 6, total: 29, label: 'Ha', status: 'aktiv', duesFrom: null, led: 0 },
  ]

  it('prints how many times each man has been lead, under his name', () => {
    const { container } = render(<AttendanceSummary roster={roster} />)
    const led = [...container.querySelectorAll('[data-led]')].map((el) => el.textContent)
    expect(led).toEqual(['4', '1', '0'])
    expect(screen.getByText('Nederste tal: antal gange som lead.')).toBeInTheDocument()
  })

  it('says it in words for a screen reader, with the count still first', () => {
    render(<AttendanceSummary roster={roster} />)
    expect(screen.getByLabelText('Anders: 22 af 29 · lead 4 gange')).toBeInTheDocument()
    expect(screen.getByLabelText('Kasper: 20 af 29 · lead 1 gang')).toBeInTheDocument()
    expect(screen.getByLabelText('Have: 6 af 29 · lead 0 gange')).toBeInTheDocument()
  })

  it('does not let the lead count into the eyebrow or the bar', () => {
    // §11 is attendance alone. The bar's height is the attendance and the
    // eyebrow names attendances; the lead count is a figure beside them.
    const { container } = render(<AttendanceSummary roster={roster} />)
    expect(screen.getByText(/Anciennitet · antal deltagelser af 29/)).toBeInTheDocument()
    const bars = [...container.querySelectorAll('[data-bar]')].map((el) => (el as HTMLElement).style.height)
    expect(bars[0]).toBe('100%')
  })
})
