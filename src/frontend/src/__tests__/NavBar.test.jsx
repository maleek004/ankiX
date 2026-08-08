import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { MemoryRouter } from 'react-router-dom'
import NavBar from '../components/NavBar'

test('NavBar renders links', () => {
  render(<MemoryRouter><NavBar/></MemoryRouter>)
  expect(screen.getByText(/AnkiX/i)).toBeInTheDocument()
  expect(screen.getByText(/Log In/i)).toBeInTheDocument()
  expect(screen.getByText(/Account/i)).toBeInTheDocument()
})
