import { buildMeetings, buildRoster, shortLabels, type AttendanceRow, type RecordRow } from './derive'

const records: RecordRow[] = [
  { id: 1, meeting_number: 1, lead: 'Rasmus', pre_location: 'Privaten', main_location: 'Cafe Gammeltorv', post_location: 'Toga Bar' },
  { id: 2, meeting_number: 2, lead: 'Emil', pre_location: null, main_location: 'Boulevarden 129', post_location: '' },
  { id: 3, meeting_number: 3, lead: 'Mads', pre_location: 'Privaten', main_location: 'Schönemann', post_location: null },
]

const rows: AttendanceRow[] = [
  { record_id: 1, member_name: 'Anders', attended: true },
  { record_id: 1, member_name: 'Rasmus', attended: true },
  { record_id: 1, member_name: 'Kasper', attended: false },
  { record_id: 2, member_name: 'Anders', attended: true },
  { record_id: 2, member_name: 'Rasmus', attended: false },
  { record_id: 2, member_name: 'Kasper', attended: false },
  { record_id: 3, member_name: 'Anders', attended: true },
  { record_id: 3, member_name: 'Rasmus', attended: true },
  { record_id: 3, member_name: 'Kasper', attended: true },
]

describe('the roster', () => {
  test('counts anciennitet as attendances, per §11', () => {
    const roster = buildRoster(records, rows)
    expect(roster.map((r) => [r.name, r.attended, r.total])).toEqual([
      ['Anders', 3, 3],
      ['Rasmus', 2, 3],
      ['Kasper', 1, 3],
    ])
  })

  test('ties break alphabetically so the order never jitters', () => {
    // Two members on the same count must always come out the same way round,
    // otherwise the bar chart appears to move when nothing has changed.
    const tied: AttendanceRow[] = [
      { record_id: 1, member_name: 'Saaby', attended: true },
      { record_id: 1, member_name: 'Esben', attended: true },
    ]
    const once = buildRoster([records[0]], tied).map((r) => r.name)
    const again = buildRoster([records[0]], [...tied].reverse()).map((r) => r.name)
    expect(once).toEqual(['Esben', 'Saaby'])
    expect(again).toEqual(once)
  })

  test('ignores rows pointing at a meeting that no longer exists', () => {
    const orphan: AttendanceRow[] = [
      ...rows,
      { record_id: 999, member_name: 'Anders', attended: true },
      { record_id: null, member_name: 'Anders', attended: true },
    ]
    const anders = buildRoster(records, orphan).find((r) => r.name === 'Anders')!
    expect([anders.attended, anders.total]).toEqual([3, 3])
  })

  test('treats a null attended as not attended', () => {
    const roster = buildRoster([records[0]], [
      { record_id: 1, member_name: 'Have', attended: null },
    ])
    expect(roster[0].attended).toBe(0)
    expect(roster[0].total).toBe(1)
  })
})

describe('short labels', () => {
  test('uses two letters when that is unambiguous', () => {
    expect(shortLabels(['Anders', 'Rasmus', 'Esben'])).toEqual({
      Anders: 'An', Rasmus: 'Ra', Esben: 'Es',
    })
  })

  test('grows the label rather than shipping two that read the same', () => {
    // An ambiguous pip is worse than a slightly wider one.
    const labels = shortLabels(['Mads', 'Mathias'])
    expect(labels.Mads).not.toBe(labels.Mathias)
  })
})

describe('meetings', () => {
  test('come newest first', () => {
    const roster = buildRoster(records, rows)
    expect(buildMeetings(records, rows, roster).map((m) => m.number)).toEqual([3, 2, 1])
  })

  test('drop the empty steps from the route', () => {
    const roster = buildRoster(records, rows)
    const meetings = buildMeetings(records, rows, roster)
    expect(meetings.find((m) => m.number === 1)!.route).toEqual([
      'Privaten', 'Cafe Gammeltorv', 'Toga Bar',
    ])
    // Meeting 2 has a null pre and an empty-string post.
    expect(meetings.find((m) => m.number === 2)!.route).toEqual(['Boulevarden 129'])
    expect(meetings.find((m) => m.number === 3)!.route).toEqual(['Privaten', 'Schönemann'])
  })

  test('split present from absent', () => {
    const roster = buildRoster(records, rows)
    const m2 = buildMeetings(records, rows, roster).find((m) => m.number === 2)!
    expect(m2.present).toEqual(['Anders'])
    expect(m2.absent).toEqual(['Rasmus', 'Kasper'])
  })

  test('order members the same way on every card', () => {
    // The strip is only readable at a glance if a given member is always in
    // the same position — so both halves follow the roster's ranking.
    const roster = buildRoster(records, rows)
    const meetings = buildMeetings(records, rows, roster)
    const order = roster.map((r) => r.name)
    for (const m of meetings) {
      const seen = [...m.present, ...m.absent]
      const ranks = seen.map((n) => order.indexOf(n))
      expect([...m.present].map((n) => order.indexOf(n))).toEqual(
        [...m.present].map((n) => order.indexOf(n)).sort((a, b) => a - b),
      )
      expect(ranks.every((r) => r >= 0)).toBe(true)
    }
  })

  test('a meeting with no attendance rows still renders', () => {
    const roster = buildRoster(records, rows)
    const meetings = buildMeetings(records, [], roster)
    expect(meetings).toHaveLength(3)
    expect(meetings[0].present).toEqual([])
    expect(meetings[0].absent).toEqual([])
  })
})
