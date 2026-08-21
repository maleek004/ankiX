import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import AdminDashboard from '../pages/AdminDashboard'
import * as authModule from '../auth/AuthProvider'
import * as api from '../api'

vi.mock('../auth/AuthProvider', () => ({
  useAuth: vi.fn()
}))

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    getAdminMetrics: vi.fn()
  }
})

const mockMetrics = {
  summary: {
    totalStudyGroups: 15,
    totalDecks: 42,
    totalCards: 320,
    totalExercises: 85,
    totalCardRuns: 4500,
    totalExerciseRuns: 1200,
    totalUsers: 150,
    onlineUsers: 12,
    offlineUsers: 138
  },
  rolesBreakdown: {
    superAdmin: 1,
    admin: 4,
    contributor: 15,
    user: 130
  },
  trends: {
    studyGroups: [
      { period: '2026-06', count: 5 },
      { period: '2026-07', count: 15 }
    ],
    activityRuns: [
      { period: '2026-06', cardRuns: 1500, exerciseRuns: 400, totalRuns: 1900 },
      { period: '2026-07', cardRuns: 3000, exerciseRuns: 800, totalRuns: 3800 }
    ],
    userRegistrations: [
      { period: '2026-06', count: 50 },
      { period: '2026-07', count: 100 }
    ]
  },
  generatedAt: '2026-08-21T12:00:00Z'
}

describe('AdminDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders 403 Access Denied when user is a standard User', () => {
    vi.mocked(authModule.useAuth).mockReturnValue({
      user: { id: 1, email: 'learner@example.com', role: 'User' }
    })

    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>
    )

    expect(screen.getByText(/403 Access Denied/i)).toBeInTheDocument()
    expect(screen.getByText(/restricted to authorized platform administrators/i)).toBeInTheDocument()
  })

  test('renders loading and then displays all KPI tiles and trends for SuperAdmin', async () => {
    vi.mocked(authModule.useAuth).mockReturnValue({
      user: { id: 99, email: 'superadmin@ankix.com', role: 'SuperAdmin' }
    })
    vi.mocked(api.getAdminMetrics).mockResolvedValue(mockMetrics)

    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>
    )

    expect(screen.getByText(/Aggregating system-wide telemetry/i)).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText(/Super-Admin Command Center/i)).toBeInTheDocument()
    })

    // Check KPI summary tiles
    expect(screen.getAllByText('15').length).toBeGreaterThan(0) // Study groups / Contributor
    expect(screen.getByText(/42 Decks/i)).toBeInTheDocument()
    expect(screen.getByText(/320 Cards/i)).toBeInTheDocument()
    expect(screen.getByText(/85 Exercises/i)).toBeInTheDocument()
    expect(screen.getByText(/4,500 Card Reviews/i)).toBeInTheDocument()
    expect(screen.getByText(/1,200 Code Runs/i)).toBeInTheDocument()
    expect(screen.getByText(/12 active now/i)).toBeInTheDocument()
    expect(screen.getByText(/138 offline/i)).toBeInTheDocument()

    // Check role breakdown
    expect(screen.getByText(/Learner Role Distribution/i)).toBeInTheDocument()
    expect(screen.getByText('130')).toBeInTheDocument() // Standard users
  })

  test('refresh button triggers getAdminMetrics reload', async () => {
    vi.mocked(authModule.useAuth).mockReturnValue({
      user: { id: 2, email: 'admin@ankix.com', role: 'Admin' }
    })
    vi.mocked(api.getAdminMetrics).mockResolvedValue(mockMetrics)

    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Super-Admin Command Center/i)).toBeInTheDocument()
    })

    expect(api.getAdminMetrics).toHaveBeenCalledTimes(1)

    const refreshBtn = screen.getByText(/Refresh Data/i)
    fireEvent.click(refreshBtn)

    await waitFor(() => {
      expect(api.getAdminMetrics).toHaveBeenCalledTimes(2)
    })
  })
})
