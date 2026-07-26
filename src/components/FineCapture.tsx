import { useState } from 'react'
import { FINE_RULES, fineAmount } from '../data/rules'

export type DraftFine = { member: string; ruleId: string; minutes: number; kr: number }

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
                    onClick={() =>
                      needsMinutes && !active
                        ? setMinutesFor(minutesFor === key ? null : key)
                        : toggle(member, rule.id)
                    }
                    className={[
                      'rounded-lg border px-2 py-1 text-[0.7rem]',
                      active
                        ? 'border-accent bg-accent/15 text-accent'
                        : 'border-line text-muted',
                    ].join(' ')}
                  >
                    {rule.offence}
                    <span className="tabular ml-1 font-semibold">
                      {active ? `${active.kr}` : rule.kr}
                      {needsMinutes && !active ? '+' : ''} kr.
                    </span>
                  </button>

                  {minutesFor === key && (
                    <label className="mt-1 flex items-center gap-2 text-[0.7rem] text-muted">
                      Minutter for sent
                      <input
                        type="number"
                        min={0}
                        autoFocus
                        aria-label={`Minutter for sent — ${member}`}
                        className="tabular w-16 rounded border border-line bg-raised px-2 py-1"
                        onKeyDown={(e) => {
                          if (e.key !== 'Enter') return
                          e.preventDefault()
                          toggle(member, rule.id, Number((e.target as HTMLInputElement).value))
                          setMinutesFor(null)
                        }}
                      />
                    </label>
                  )}
                </span>
              )
            })}
          </div>
        </section>
      ))}

      <p className="tabular text-right text-sm">
        I alt <span className="font-semibold text-accent">{total} kr.</span>
      </p>
    </div>
  )
}
