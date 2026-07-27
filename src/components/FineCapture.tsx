import { useState } from 'react'
import { FINE_RULES, fineAmount } from '../data/rules'
import { kr } from './FinanceChart'

export type DraftFine = { member: string; ruleId: string; minutes: number; kr: number }

/**
 * The most minutes late that is still lateness.
 *
 * A club evening runs about four hours, so past that there is no arrival left to
 * be late for — that is *udeblivelse*, which the regulation charges separately
 * and at its own amount. Uncapped, the field took whatever was typed: 99999
 * minutes was accepted without a murmur as a 500045 kr. fine, and -50 quietly
 * became a 50 kr. one because the value was only ever read on keydown.
 */
const MAX_MINUTES = 240

const REFUSED = `Angiv et helt antal minutter mellem 0 og ${MAX_MINUTES}. Intet er registreret.`

/**
 * Recording a meeting's fines, in the time it takes to settle the bill.
 *
 * This is the product, not a form. The regulation makes the Lead note fines and
 * tell the treasurer immediately after each meeting; the old process was that
 * plus a spreadsheet edit days later, which is exactly what stopped happening —
 * actual fines are blank in the sheet from February onwards.
 *
 * One tap per fine. Late arrival is the only rule needing a number, so it is
 * the only one that asks for one.
 */
export function FineCapture({
  members,
  value,
  onChange,
}: {
  members: string[]
  value: DraftFine[]
  onChange: (next: DraftFine[]) => void
}) {
  const [minutesFor, setMinutesFor] = useState<string | null>(null)
  // Which chip's entry was refused, not merely that one was — the message has
  // to outlive the field it came from. Tapping straight on to the next member
  // closes the panel, and a warning that goes with it would leave the Lead
  // exactly where the dropped-minutes bug did: believing a fine was recorded.
  const [refusedFor, setRefusedFor] = useState<string | null>(null)

  const has = (member: string, ruleId: string) =>
    value.find((f) => f.member === member && f.ruleId === ruleId)

  function toggle(member: string, ruleId: string, minutes = 0) {
    const rule = FINE_RULES.find((r) => r.id === ruleId)!
    const existing = has(member, ruleId)
    // The regulation caps it at one fine per offence per meeting, so tapping an
    // active chip removes it rather than adding a second.
    if (existing && !minutes) {
      onChange(value.filter((f) => f !== existing))
      return
    }
    const next = value.filter((f) => !(f.member === member && f.ruleId === ruleId))
    onChange([...next, { member, ruleId, minutes, kr: fineAmount(rule, minutes) }])
  }

  /**
   * What the minutes field does when the Lead stops typing — by any means.
   *
   * Enter used to be the only thing that committed. On a phone, tapping
   * somewhere else is how the keyboard gets dismissed, so the gesture that threw
   * the number away was the ordinary way of finishing with the field: the Lead
   * put the phone down believing a fine was recorded, and it was not.
   */
  function commit(member: string, ruleId: string, key: string, raw: string) {
    const typed = raw.trim()
    // Nothing typed is a chip tapped by mistake, not a 50 kr. fine. Recording
    // one here would be the same silent money, only in the other direction.
    if (typed === '') {
      setMinutesFor(null)
      setRefusedFor(null)
      return
    }
    const minutes = Number(typed)
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > MAX_MINUTES) {
      setRefusedFor(key)
      return
    }
    setRefusedFor(null)
    toggle(member, ruleId, minutes)
    setMinutesFor(null)
  }

  const total = value.reduce((n, f) => n + f.kr, 0)

  return (
    <div className="flex flex-col gap-2">
      {members.map((member) => (
        <section key={member} className="rounded-xl border border-line bg-surface p-3">
          <h3 className="text-sm font-semibold">{member}</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {FINE_RULES.map((rule) => {
              const active = has(member, rule.id)
              const needsMinutes = Boolean(rule.perMinute)
              const key = `${member}::${rule.id}`
              return (
                <span key={rule.id}>
                  <button
                    type="button"
                    aria-pressed={Boolean(active)}
                    onClick={() => {
                      if (!needsMinutes || active) return toggle(member, rule.id)
                      // Always opens, never toggles shut. Blur runs before the
                      // click, so a chip that closed its own panel would find it
                      // already closed and open it straight back up.
                      setRefusedFor(null)
                      setMinutesFor(key)
                    }}
                    className={[
                      // 48 px, the design system's touch floor. These are
                      // tapped standing up, in a loud restaurant, with a bill
                      // in the other hand; at 27 px they were a game of skill,
                      // and a mis-tap here charges the wrong man 200 kr.
                      'inline-flex min-h-12 items-center rounded-lg border px-3 text-left text-[0.7rem]',
                      active
                        ? 'border-accent bg-accent/15 text-accent'
                        : 'border-line text-muted',
                    ].join(' ')}
                  >
                    {rule.offence}
                    {/* The club's own formatter, so a chip and the card two
                        screens up cannot write the same amount two ways. The
                        per-minute rule states its rate rather than a bare "+",
                        which is what the design system's own rules card does.
                        nowrap because a long offence wraps to two lines, and
                        the amount would break between the figure and its "kr."
                        as though it were prose. */}
                    <span className="tabular ml-1 font-semibold whitespace-nowrap">
                      {active
                        ? kr(active.kr)
                        : needsMinutes
                          ? `${kr(rule.kr)} +${rule.perMinute}/min`
                          : kr(rule.kr)}
                    </span>
                  </button>

                  {minutesFor === key && (
                    <label className="mt-1 flex items-center gap-2 text-[0.7rem] text-muted">
                      Minutter for sent
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={MAX_MINUTES}
                        autoFocus
                        aria-label={`Minutter for sent — ${member}`}
                        aria-invalid={refusedFor === key}
                        className="tabular min-h-12 w-20 rounded border border-line bg-raised px-2 text-ink"
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            setMinutesFor(null)
                            setRefusedFor(null)
                            return
                          }
                          if (e.key !== 'Enter') return
                          e.preventDefault()
                          commit(member, rule.id, key, (e.target as HTMLInputElement).value)
                        }}
                        onBlur={(e) => commit(member, rule.id, key, e.target.value)}
                      />
                    </label>
                  )}

                  {refusedFor === key && (
                    <span role="alert" className="mt-1 block text-[0.65rem] text-absent">
                      {REFUSED}
                    </span>
                  )}
                </span>
              )
            })}
          </div>
        </section>
      ))}

      <p className="tabular text-right text-sm">
        I alt <span className="font-semibold text-accent">{kr(total)}</span>
      </p>
    </div>
  )
}
