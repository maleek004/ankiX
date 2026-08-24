import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import SocialButtons from '../components/SocialButtons'
import AuthModal from '../components/AuthModal'

export default function Home() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [authModalConfig, setAuthModalConfig] = useState({ isOpen: false, title: '', subtitle: '', intent: null })

  useEffect(() => {
    if (auth?.user) {
      navigate('/study-groups', { replace: true })
    }
  }, [auth?.user, navigate])

  if (auth?.user) return null

  return (
    <div style={{ maxWidth: 1140, margin: '0 auto', padding: '24px 16px 64px' }}>
      {/* Hero Section */}
      <section style={{
        textAlign: 'center',
        padding: '56px 20px 48px',
        background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)',
        borderRadius: 20,
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 20px -4px rgba(15, 23, 42, 0.05)',
        marginBottom: 48
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: '#eff6ff',
          color: '#2563eb',
          border: '1px solid #bfdbfe',
          padding: '6px 14px',
          borderRadius: 999,
          fontSize: '0.85rem',
          fontWeight: 600,
          marginBottom: 20
        }}>
          <span>⚡</span> Intelligent Spaced Repetition for Lifelong High-Velocity Learning
        </div>

        <h1 style={{
          fontSize: '2.75rem',
          fontWeight: 800,
          color: '#0f172a',
          letterSpacing: '-0.025em',
          lineHeight: 1.2,
          maxWidth: 800,
          margin: '0 auto 16px'
        }}>
          Master Complex Topics & Concepts With Zero Forgetting
        </h1>

        <p style={{
          fontSize: '1.15rem',
          color: '#64748b',
          maxWidth: 680,
          margin: '0 auto 32px',
          lineHeight: 1.6
        }}>
          Combine the proven SM-2 memory engine with interactive exercises (and coding sandboxes) and collaborative study groups.
        </p>

        {/* Primary Action Buttons */}
        <div className="hero-action-buttons" style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 28 }}>
          <Link
            to="/register"
            className="btn btn-primary"
            style={{
              padding: '12px 28px',
              fontSize: '1.05rem',
              fontWeight: 700,
              borderRadius: 10,
              textDecoration: 'none',
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)'
            }}
          >
            🚀 Start Free Account
          </Link>
          <Link
            to="/study-groups"
            className="btn btn-secondary"
            style={{
              padding: '12px 26px',
              fontSize: '1.05rem',
              fontWeight: 600,
              borderRadius: 10,
              textDecoration: 'none',
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              color: '#334155'
            }}
          >
            👀 Enter in Guest Mode →
          </Link>
        </div>

        {/* Social Logins */}
        <div style={{ maxWidth: 320, margin: '0 auto' }}>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: 10 }}>Or continue with 1-click social login:</div>
          <SocialButtons mode="login" />
        </div>
      </section>

      {/* Feature Value Propositions */}
      <section style={{ marginBottom: 48 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#1e293b', margin: '0 0 8px 0' }}>
            Built for High-Velocity Retention
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.95rem', margin: 0 }}>
            Everything you need to retain complex concepts, languages, skills, and specialized knowledge.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 20
        }}>
          <div style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 14,
            padding: 24,
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
          }}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>🧠</div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#0f172a', margin: '0 0 8px 0' }}>SM-2 Memory Engine</h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>
              Scientifically proven spaced repetition algorithms dynamically schedule reviews right before you forget.
            </p>
          </div>

          <div style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 14,
            padding: 24,
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
          }}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>⚡</div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#0f172a', margin: '0 0 8px 0' }}>Interactive Exercises & Sandboxes</h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>
              Practice active recall with interactive quizzes, precision checks, and executable coding sandboxes directly inside flashcards.
            </p>
          </div>

          <div style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 14,
            padding: 24,
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
          }}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>👥</div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#0f172a', margin: '0 0 8px 0' }}>Study Groups & Cohorts</h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>
              Join open community learning groups or collaborate in private, invite-only study cohorts.
            </p>
          </div>
        </div>
      </section>

      {/* Guest Mode vs Registered Comparison */}
      <section style={{
        background: '#f8fafc',
        borderRadius: 16,
        padding: '32px 24px',
        border: '1px solid #e2e8f0',
        marginBottom: 48
      }}>
        <h3 style={{ textAlign: 'center', margin: '0 0 24px 0', fontSize: '1.3rem', color: '#0f172a' }}>
          Guest Preview vs. Free Account
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 20,
          maxWidth: 800,
          margin: '0 auto'
        }}>
          <div style={{
            background: '#ffffff',
            padding: 20,
            borderRadius: 12,
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ fontWeight: 700, color: '#475569', marginBottom: 12, fontSize: '1rem' }}>
              👁️ Guest Preview Mode
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.9rem', color: '#64748b' }}>
              <li>✓ Browse public study groups & decks</li>
              <li>✓ Preview flashcards & test runner</li>
              <li>✓ Ephemeral sandbox & exercise runs (10/10m)</li>
              <li style={{ color: '#94a3b8' }}>✗ No review logs or SM-2 scheduling</li>
              <li style={{ color: '#94a3b8' }}>✗ No private study groups or Q&A</li>
            </ul>
            <div style={{ marginTop: 20 }}>
              <Link to="/study-groups" className="btn btn-secondary" style={{ width: '100%', textAlign: 'center', display: 'block', textDecoration: 'none', padding: '8px' }}>
                Enter Guest Mode
              </Link>
            </div>
          </div>

          <div style={{
            background: '#eff6ff',
            padding: 20,
            borderRadius: 12,
            border: '2px solid #3b82f6',
            position: 'relative'
          }}>
            <div style={{
              position: 'absolute',
              top: -10,
              right: 16,
              background: '#2563eb',
              color: '#fff',
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 999,
              textTransform: 'uppercase'
            }}>
              Recommended
            </div>
            <div style={{ fontWeight: 700, color: '#1d4ed8', marginBottom: 12, fontSize: '1rem' }}>
              🚀 Free Registered Account
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.9rem', color: '#1e3a8a' }}>
              <li>✓ Full SM-2 spaced repetition tracking</li>
              <li>✓ Active recall & mastery tracking</li>
              <li>✓ Higher sandbox execution limits (60/10m)</li>
              <li>✓ Create & join private study groups</li>
              <li>✓ Ask follow-up questions & author cards</li>
              <li>✓ Free forever for individual learners</li>
            </ul>
            <div style={{ marginTop: 20 }}>
              <Link to="/register" className="btn btn-primary" style={{ width: '100%', textAlign: 'center', display: 'block', textDecoration: 'none', padding: '8px' }}>
                Create Free Account
              </Link>
            </div>
          </div>
        </div>
      </section>

      <AuthModal
        {...authModalConfig}
        onClose={() => setAuthModalConfig(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  )
}
