import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FineCapture, type DraftFine } from './FineCapture'

/** Wraps the controlled component so the tests exercise it as it is used. */
function Harness({ members = ['Mads', 'Saaby'] }: { members?: string[] }) {
  const [value, setValue] = useState<DraftFine[]>([])
  return (
    <>
      <FineCapture members={members} value={value} onChange={setValue} />
      <output data-testid="draft">{JSON.stringify(value)}</output>
    </>
  )
}

const draft = (): DraftFine[] => JSON.parse(screen.getByTestId('draft').textContent || '[]')

test('one tap records a fine at the regulation amount', async () => {
  const user = userEvent.setup()
  render(<Harness />)
  await user.click(screen.getAllByRole('button', { name: /Skål før Leads første skål/ })[0])

  expect(draft()).toEqual([{ member: 'Mads', ruleId: 'skaal', minutes: 0, kr: 50 }])
})

test('tapping again removes it — one fine per offence per meeting', async () => {
  // The regulation caps it, so a second tap cannot mean a second fine. Without
  // this, a fumbled thumb quietly doubles what someone owes.
  const user = userEvent.setup()
  render(<Harness />)
  const chip = screen.getAllByRole('button', { name: /Udeblivelse uden afbud/ })[0]
  await user.click(chip)
  await user.click(chip)
  expect(draft()).toEqual([])
})

test('fines are recorded per member, not shared', async () => {
  const user = userEvent.setup()
  render(<Harness />)
  await user.click(screen.getAllByRole('button', { name: /Skål før/ })[0]) // Mads
  await user.click(screen.getAllByRole('button', { name: /Skål før/ })[1]) // Saaby

  expect(draft().map((f) => f.member).sort()).toEqual(['Mads', 'Saaby'])
})

test('late arrival asks for minutes and charges 50 kr plus 5 per minute', async () => {
  const user = userEvent.setup()
  render(<Harness />)
  await user.click(screen.getAllByRole('button', { name: /For sent fremmøde/ })[0])

  const minutes = screen.getByLabelText('Minutter for sent — Mads')
  await user.type(minutes, '12{Enter}')

  expect(draft()).toEqual([{ member: 'Mads', ruleId: 'for-sent', minutes: 12, kr: 110 }])
})

/**
 * The one that cost money.
 *
 * Enter was the only thing that committed the minutes, and on a phone tapping
 * elsewhere is how the keyboard is dismissed — so the ordinary way of finishing
 * with the field was also the way of throwing the fine away, silently, with the
 * Lead believing it was recorded.
 */
test('minutes typed and then tapped away from are recorded', async () => {
  const user = userEvent.setup()
  render(<Harness />)
  await user.click(screen.getAllByRole('button', { name: /For sent fremmøde/ })[0])
  await user.type(screen.getByLabelText('Minutter for sent — Mads'), '12')

  // No Enter. Somewhere else on the screen, which is the gesture that used to
  // lose it.
  await user.click(screen.getByText('Saaby'))

  expect(draft()).toEqual([{ member: 'Mads', ruleId: 'for-sent', minutes: 12, kr: 110 }])
})

test('a number too large to be lateness is refused, and says so', async () => {
  const user = userEvent.setup()
  render(<Harness />)
  await user.click(screen.getAllByRole('button', { name: /For sent fremmøde/ })[0])
  await user.type(screen.getByLabelText('Minutter for sent — Mads'), '99999')
  await user.click(screen.getByText('Saaby'))

  // It used to be taken at face value: a 500045 kr. fine, accepted in silence.
  expect(draft()).toEqual([])
  expect(screen.getByRole('alert')).toHaveTextContent('mellem 0 og 240')
  expect(screen.getAllByRole('button', { name: /For sent fremmøde/ })[0]).toHaveAttribute(
    'aria-pressed',
    'false',
  )
})

test('a negative number is refused rather than charged as none', async () => {
  // min={0} on the input never did anything, because the value was read on
  // keydown: -50 activated the chip at 50 kr. with nothing to say it had been
  // rejected.
  const user = userEvent.setup()
  render(<Harness />)
  await user.click(screen.getAllByRole('button', { name: /For sent fremmøde/ })[0])
  await user.type(screen.getByLabelText('Minutter for sent — Mads'), '-50')
  await user.click(screen.getByText('Saaby'))

  expect(draft()).toEqual([])
  expect(screen.getByRole('alert')).toBeInTheDocument()
})

test('the refusal survives moving on to the next member', async () => {
  // The panel closes when another chip is tapped. A message living inside it
  // would go with it, which is the silent drop again wearing a different hat.
  const user = userEvent.setup()
  render(<Harness />)
  await user.click(screen.getAllByRole('button', { name: /For sent fremmøde/ })[0])
  await user.type(screen.getByLabelText('Minutter for sent — Mads'), '1200')
  await user.click(screen.getAllByRole('button', { name: /Skål før/ })[1]) // Saaby

  expect(screen.getByRole('alert')).toBeInTheDocument()
  expect(draft().map((f) => f.member)).toEqual(['Saaby'])
})

test('the ceiling itself is a fine, not an error', async () => {
  const user = userEvent.setup()
  render(<Harness />)
  await user.click(screen.getAllByRole('button', { name: /For sent fremmøde/ })[0])
  await user.type(screen.getByLabelText('Minutter for sent — Mads'), '240')
  await user.click(screen.getByText('Saaby'))

  expect(draft()).toEqual([{ member: 'Mads', ruleId: 'for-sent', minutes: 240, kr: 1250 }])
})

test('opening the field and tapping away records nothing', async () => {
  // An empty field is a mis-tapped chip. Committing zero would be a 50 kr. fine
  // nobody asked for — the same silent money, in the other direction.
  const user = userEvent.setup()
  render(<Harness />)
  await user.click(screen.getAllByRole('button', { name: /For sent fremmøde/ })[0])
  await user.click(screen.getByText('Saaby'))

  expect(draft()).toEqual([])
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.queryByLabelText(/Minutter/)).not.toBeInTheDocument()
})

test('only late arrival asks for minutes', async () => {
  const user = userEvent.setup()
  render(<Harness />)
  await user.click(screen.getAllByRole('button', { name: /Bestille en anden type drikkevare/ })[0])
  expect(screen.queryByLabelText(/Minutter/)).not.toBeInTheDocument()
})

test('amounts are written the way the rest of the app writes money', async () => {
  // The chip printed `{active.kr}` raw, so a four-figure fine came out as
  // 1250 kr. on a screen writing 3.600 kr. two cards away. Same helper now,
  // so the two cannot disagree about what kind of number this is.
  const user = userEvent.setup()
  render(<Harness />)
  await user.click(screen.getAllByRole('button', { name: /For sent fremmøde/ })[0])
  await user.type(screen.getByLabelText('Minutter for sent — Mads'), '240{Enter}')

  expect(screen.getAllByRole('button', { name: /For sent fremmøde/ })[0]).toHaveTextContent(
    '1.250 kr.',
  )
  expect(screen.getByText(/^I alt/)).toHaveTextContent('I alt 1.250 kr.')
})

test('a per-minute rule says what the minutes cost', async () => {
  // "50+ kr." named neither the rate nor what the plus was for.
  render(<Harness />)
  expect(screen.getAllByRole('button', { name: /For sent fremmøde/ })[0]).toHaveTextContent(
    '50 kr. +5/min',
  )
})

test('the running total is the sum of what has been tapped', async () => {
  const user = userEvent.setup()
  render(<Harness />)
  await user.click(screen.getAllByRole('button', { name: /Udeblivelse uden afbud/ })[0]) // 200
  await user.click(screen.getAllByRole('button', { name: /Skål før/ })[1]) // 50

  expect(screen.getByText('250 kr.')).toBeInTheDocument()
})

test('a recorded fine reads as pressed, so the Lead can see what they logged', async () => {
  const user = userEvent.setup()
  render(<Harness />)
  const chip = screen.getAllByRole('button', { name: /Skål før/ })[0]
  expect(chip).toHaveAttribute('aria-pressed', 'false')
  await user.click(chip)
  expect(chip).toHaveAttribute('aria-pressed', 'true')
})
