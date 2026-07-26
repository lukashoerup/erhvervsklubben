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

test('only late arrival asks for minutes', async () => {
  const user = userEvent.setup()
  render(<Harness />)
  await user.click(screen.getAllByRole('button', { name: /Bestille en anden type drikkevare/ })[0])
  expect(screen.queryByLabelText(/Minutter/)).not.toBeInTheDocument()
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
