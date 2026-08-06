import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import RequireAuth from './auth/RequireAuth'
import NavBar from './components/NavBar'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import Decks from './pages/Decks'
import Deck from './pages/Deck'
import Exercises from './pages/Exercises'
import AdminUsers from './pages/AdminUsers'
import Search from './pages/Search'
import Communities from './pages/Communities'

export default function App(){
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="app">
          <NavBar />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Home/>} />
              <Route path="/login" element={<Login/>} />
              <Route path="/register" element={<Register/>} />
              <Route path="/communities" element={<Communities/>} />
              <Route path="/c/:slug" element={<Communities/>} />
              <Route path="/search" element={<RequireAuth><Search/></RequireAuth>} />
              <Route path="/decks" element={<RequireAuth><Decks/></RequireAuth>} />
              <Route path="/decks/:id" element={<RequireAuth><Deck/></RequireAuth>} />
              <Route path="/exercises" element={<RequireAuth><Exercises/></RequireAuth>} />
              <Route path="/admin/users" element={<RequireAuth><AdminUsers/></RequireAuth>} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  )
}
