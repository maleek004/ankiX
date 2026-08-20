import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Deck from '../pages/Deck'

const { mockGetDeck, mockGetStudyQueue, mockGetCards, mockGetFollowups, mockGetCardExercises } = vi.hoisted(() => ({
  mockGetDeck: vi.fn().mockResolvedValue({ id: 1, title: 'Test Deck' }),
  mockGetStudyQueue: vi.fn().mockResolvedValue({
    newCount: 1,
    learningCount: 0,
    reviewCount: 0,
    dueCards: [{ id: 10, prompt: 'What is 2+2?', type: 'basic', answer: '4' }]
  }),
  mockGetCards: vi.fn().mockResolvedValue([{ id: 10, prompt: 'What is 2+2?', type: 'basic', answer: '4' }]),
  mockGetFollowups: vi.fn().mockResolvedValue([
    { id: 101, questionText: 'Followup 1', authorDisplayName: 'User A', createdAt: '2026-08-08T00:00:00Z' },
    { id: 102, questionText: 'Followup 2', authorDisplayName: 'User B', createdAt: '2026-08-08T00:00:00Z' }
  ]),
  mockGetCardExercises: vi.fn().mockResolvedValue([
    { id: 201, title: 'Check Even Number', language: 'python', description: 'Check if number is even' }
  ])
}))

vi.mock('../studyGroup/StudyGroupProvider', () => ({
  useStudyGroup: () => ({ activeStudyGroup: { id: 1, name: 'Mock Group', role: 'Admin' } })
}))

vi.mock('../api.js', () => ({
  getDeck: (...args) => mockGetDeck(...args),
  getStudyQueue: (...args) => mockGetStudyQueue(...args),
  getCards: (...args) => mockGetCards(...args),
  getFollowups: (...args) => mockGetFollowups(...args),
  getCardExercises: (...args) => mockGetCardExercises(...args),
  getEffectiveDisplayName: (displayName, email) => displayName || (email ? email.split('@')[0] : 'User'),
  canCreateContent: () => true,
  getDecks: async () => [],
  getAllCards: async () => [],
  getUser: () => ({ id: 1, email: 'test@example.com', role: 'Admin' })
}))

test('Deck renders followups in a scrollable list container', async () => {
  render(
    <MemoryRouter initialEntries={['/decks/1']}>
      <Routes>
        <Route path="/decks/:id" element={<Deck />} />
      </Routes>
    </MemoryRouter>
  )

  await waitFor(() => {
    expect(mockGetCards).toHaveBeenCalled()
    expect(screen.getByText('What is 2+2?')).toBeInTheDocument()
  })

  // Linked exercises should NOT be visible before showing answer
  expect(screen.queryByText(/Linked Exercises/i)).not.toBeInTheDocument()

  const showAnswerBtn = screen.getByText('Show Answer')
  fireEvent.click(showAnswerBtn)

  const followupsBtn = await screen.findByText(/Follow-ups/i)
  fireEvent.click(followupsBtn)

  const followupText = await screen.findByText('Followup 1')
  expect(followupText).toBeInTheDocument()

  const list = followupText.closest('ul')
  expect(list).toHaveClass('followups-list')

  // Click Linked Exercises toggle button
  const linkedExBtn = screen.getByText(/Linked Exercises/i)
  fireEvent.click(linkedExBtn)

  // Followup 1 should be closed/hidden when Linked Exercises is open
  expect(screen.queryByText('Followup 1')).not.toBeInTheDocument()

  // Linked Exercise should be visible in scrollable list
  const exTitle = await screen.findByText(/Check Even Number/i)
  expect(exTitle).toBeInTheDocument()
  expect(exTitle.closest('ul')).toHaveClass('followups-list')
})
