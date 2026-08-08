import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import Home from '../pages/Home'

test('Home shows welcome', () => {
  render(<Home />)
  expect(screen.getByText(/Welcome to AnkiX/i)).toBeInTheDocument()
})
