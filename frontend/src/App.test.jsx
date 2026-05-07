import { render, screen } from '@testing-library/react'
import App from './App.jsx'

test('renders app title', () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: /distributed file storage/i })).toBeInTheDocument()
})
