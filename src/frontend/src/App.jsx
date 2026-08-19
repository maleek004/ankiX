import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import { AuthProvider } from './auth/AuthProvider'
import { StudyGroupProvider } from './studyGroup/StudyGroupProvider'
import RequireAuth from './auth/RequireAuth'
import NavBar from './components/NavBar'
import GuestBanner from './components/GuestBanner'
import EmailVerificationBanner from './components/EmailVerificationBanner'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import VerifyEmail from './pages/VerifyEmail'
import OAuthCallback from './pages/OAuthCallback'
import Decks from './pages/Decks'
import Deck from './pages/Deck'
import Exercises from './pages/Exercises'
import AdminUsers from './pages/AdminUsers'
import Search from './pages/Search'
import StudyGroups from './pages/StudyGroups'

export default function App(){
  return (
    <AuthProvider>
      <StudyGroupProvider>
        <BrowserRouter>
          <div className="app">
            <GuestBanner />
            <NavBar />
            <EmailVerificationBanner />
            <main className="main-content">
              <Routes>
                <Route path="/" element={<Home/>} />
                <Route path="/login" element={<Login/>} />
                <Route path="/register" element={<Register/>} />
                <Route path="/forgot-password" element={<ForgotPassword/>} />
                <Route path="/reset-password" element={<ResetPassword/>} />
                <Route path="/verify-email" element={<VerifyEmail/>} />
                <Route path="/oauth/callback" element={<OAuthCallback/>} />
                <Route path="/study-groups" element={<StudyGroups/>} />

                <Route path="/communities" element={<Navigate to="/study-groups" replace />} />
                <Route path="/search" element={<Search/>} />
                <Route path="/decks" element={<Decks/>} />
                <Route path="/decks/:id" element={<Deck/>} />
                <Route path="/exercises" element={<Exercises/>} />
                <Route path="/admin/users" element={<RequireAuth><AdminUsers/></RequireAuth>} />
              </Routes>
            </main>
          </div>
          <Analytics />
        </BrowserRouter>
      </StudyGroupProvider>
    </AuthProvider>
  )
}
