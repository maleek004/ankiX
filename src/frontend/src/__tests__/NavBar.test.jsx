import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import NavBar from '../components/NavBar'

test('NavBar renders links', () => {
  render(<MemoryRouter><NavBar/></MemoryRouter>)
  expect(screen.getByText(/Home/i)).toBeInTheDocument()
  expect(screen.getByText(/Decks/i)).toBeInTheDocument()
  expect(screen.getByText(/Login/i)).toBeInTheDocument()
  expect(screen.getByText(/Register/i)).toBeInTheDocument()
})
