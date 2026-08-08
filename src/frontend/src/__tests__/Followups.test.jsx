import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Deck from '../pages/Deck'

const { mockGetDeck, mockGetStudyQueue, mockGetCards, mockGetFollowups } = vi.hoisted(() => ({
  mockGetDeck: vi.fn().mockResolvedValue({ id: 1, title: 'Test Deck' }),
  mockGetStudyQueue: vi.fn().mockResolvedValue({
    newCount: 1,
    learningCount: 0,
    reviewCount: 0,
    dueCards: [{ id: 10, prompt: 'What is 2+2?', type: 'basic', validationSpec: '4' }]
  }),
  mockGetCards: vi.fn().mockResolvedValue([{ id: 10, prompt: 'What is 2+2?', type: 'basic', validationSpec: '4' }]),
  mockGetFollowups: vi.fn().mockResolvedValue([
    { id: 101, questionText: 'Followup 1', authorDisplayName: 'User A', createdAt: '2026-08-08T00:00:00Z' },
    { id: 102, questionText: 'Followup 2', authorDisplayName: 'User B', createdAt: '2026-08-08T00:00:00Z' }
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
  getCardExercises: async () => [],
  canCreateContent: () => true,
  getDecks: async () => [],
  getAllCards: async () => []
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

  const showAnswerBtn = screen.getByText('Show Answer')
  fireEvent.click(showAnswerBtn)

  const followupsBtn = await screen.findByText(/Follow-ups/i)
  fireEvent.click(followupsBtn)

  const followupText = await screen.findByText('Followup 1')
  expect(followupText).toBeInTheDocument()

  const list = followupText.closest('ul')
  expect(list).toHaveClass('followups-list')
})
