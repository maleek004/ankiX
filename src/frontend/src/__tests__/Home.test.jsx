import React from 'react'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import '@testing-library/jest-dom'
import Home from '../pages/Home'

test('Home shows welcome hero section', () => {
  render(
    <BrowserRouter>
      <Home />
    </BrowserRouter>
  )
  expect(screen.getByText(/Master Complex Topics & Concepts With Zero Forgetting/i)).toBeInTheDocument()
})
