import { render, screen } from '@testing-library/react'
import App from './App'

// Placeholder smoke test proving the Vitest + RTL + jsdom toolchain runs.
// Real component tests (route protection, matrix rendering, etc.) land per the
// PLAN-REVIEW test spec once those features exist.
test('renders the club name', () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: 'Erhvervsklubben' })).toBeInTheDocument()
})
