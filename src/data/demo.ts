import type { AttendanceRow, RecordRow } from './derive'
import type { EventItem, NewsItem } from './useClubData'

/**
 * Sample data for a build with no database behind it.
 *
 * Switched on by VITE_DEMO=1 at build time, so a preview can be clicked through
 * without a Supabase project — and, more to the point, without pointing a public
 * URL at the club's real records.
 *
 * The figures are shaped like the real ones (28 meetings, the actual roster and
 * venues) so the layout is judged against realistic content rather than
 * lorem ipsum. They are not the club's actual attendance.
 */
export const DEMO = import.meta.env.VITE_DEMO === '1'

const LEADS = ['Esben', 'Rasmus', 'Anders', 'Saaby', 'Emil', 'Oskar', 'Lukas', 'Mads']
const VENUES: [string | null, string, string | null][] = [
  ['Privaten', 'Propaganda', null],
  ['Lilly Von Kohl', 'Restaurant Tokyo', null],
  ['Mojos', 'Le Petit Rouge', 'Tryk Bar'],
  ['Champagnesmagning', 'Marv og Ben', 'Lord Nelson'],
  ['Privaten', 'Les St Jacques', 'Holstein Bodega'],
  ['Café Lindevang', 'Café Boulevarden', null],
  ['Privaten', 'Tivolihallen', 'Sørens værtshus'],
  ['Privaten', 'Bjælkehuset', 'Søndermarken'],
]
export const DEMO_ROSTER = [
  'Anders', 'Rasmus', 'Esben', 'Oskar', 'Emil', 'Saaby', 'Lukas', 'Mads', 'Kasper', 'Have',
]

/** Deterministic, so the demo looks the same every time it is opened. */
function attended(meeting: number, member: number): boolean {
  if (member >= 8) return (meeting * 7 + member) % 4 === 0 // the two who rarely come
  return (meeting * 3 + member * 5) % 9 !== 0
}

export const demoRecords: RecordRow[] = Array.from({ length: 28 }, (_, i) => {
  const n = 28 - i
  const [pre, main, post] = VENUES[n % VENUES.length]
  // Every other month, per §9, counting back from June 2026. The day of the
  // month wanders the way a real Thursday-ish evening does — every meeting
  // landing on the 12th reads as generated the moment you scroll the list.
  const d = new Date(Date.UTC(2026, 5 - (28 - n) * 2, 4 + ((n * 5) % 22)))
  return {
    id: n,
    meeting_number: n,
    lead: LEADS[n % LEADS.length],
    pre_location: pre,
    main_location: main,
    post_location: post,
    meeting_date: d.toISOString().slice(0, 10),
  }
})

export const demoAttendances: AttendanceRow[] = demoRecords.flatMap((r) =>
  DEMO_ROSTER.map((name, m) => ({
    record_id: r.id,
    member_name: name,
    attended: attended(r.meeting_number, m),
  })),
)

export const demoNews: NewsItem[] = [
  {
    id: '1',
    title: 'Sommerfest 2026 — planen er klar',
    excerpt: 'Vi holder den hos Saaby igen i år. Tilmelding senest den 1. august.',
    author: 'Mathias Saaby',
    date: '2026-06-09',
  },
  {
    id: '2',
    title: 'Møde 28 afholdt på Propaganda',
    excerpt: 'Esben lagde op. Otte af ti mødte frem, og bødekassen voksede.',
    author: 'Lukas Hørup Eskildsen',
    date: '2026-06-02',
  },
  {
    id: '3',
    title: 'Kontingentet er fordoblet',
    excerpt: 'Vedtaget på generalforsamlingen. 200 kr. pr. måned fra juni.',
    author: 'Lukas Hørup Eskildsen',
    date: '2026-04-20',
  },
]

/**
 * The two meetings §9 promises are always planned, neither with a venue yet.
 *
 * Empty strings rather than the words "endnu ikke sat", which is what the data
 * used to say: a demo that writes the empty state into its own rows never
 * exercises the empty state, and every page has its own wording for it.
 */
export const demoUpcoming: EventItem[] = [
  {
    id: 'u1',
    title: 'Møde #29',
    date: new Date(Date.now() + 18 * 864e5).toISOString().slice(0, 10),
    time: '18:30',
    location: '',
    description: 'Oskar lægger op.',
  },
  {
    id: 'u2',
    title: 'Møde #30',
    date: new Date(Date.now() + 79 * 864e5).toISOString().slice(0, 10),
    time: '18:30',
    location: '',
    description: 'Lukas lægger op.',
  },
]

/**
 * The whole calendar, held meetings included — what the Møder page reads.
 *
 * Two behind and two ahead, because §9 promises two ahead and the page's own
 * point is that the ones already held stay visible and correctable. A demo with
 * nothing in the past would show the empty half of the screen.
 */
export const demoEvents: EventItem[] = [
  ...demoUpcoming,
  {
    id: 'p1',
    title: 'Møde #28',
    date: new Date(Date.now() - 44 * 864e5).toISOString().slice(0, 10),
    time: '18:30',
    location: 'Propaganda',
    description: 'Esben lagde op. Otte af ti mødte frem.',
  },
  {
    id: 'p2',
    title: 'Generalforsamling 2026',
    date: new Date(Date.now() - 98 * 864e5).toISOString().slice(0, 10),
    time: '17:00',
    location: 'Tivolihallen',
    description: 'Kontingentet blev fordoblet med virkning fra juni.',
  },
]

export const demoFines = [
  { member_name: 'Mads', amount_kr: 200, record_id: 28 },
  { member_name: 'Mads', amount_kr: 185, record_id: 27 },
  { member_name: 'Saaby', amount_kr: 110, record_id: 28 },
  { member_name: 'Esben', amount_kr: 50, record_id: 26 },
  { member_name: 'Kasper', amount_kr: 265, record_id: 27 },
]

export const demoPayments = [
  { month: '2026-04-01', amount_kr: 900 },
  { month: '2026-05-01', amount_kr: 900 },
  { month: '2026-06-01', amount_kr: 1800 },
]
