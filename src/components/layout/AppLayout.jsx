import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const NAV = [
  { to: '/', label: 'Dashboard', icon: '▦' },
  { to: '/expenses', label: 'Transactions', icon: '↕' },
  { to: '/budget', label: 'Budget', icon: '◎' },
  { to: '/review', label: 'Review', icon: '◈' },
]

export default function AppLayout({ children }) {
  const { user, signOut } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  const name = user?.user_metadata?.name || user?.email?.split('@')[0] || 'You'
  const initial = name[0].toUpperCase()

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--surface)' }}>
      {/* Sidebar — desktop */}
      <aside
        className="hidden md:flex flex-col w-52 shrink-0 border-r h-screen sticky top-0"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      >
        {/* Logo */}
        <div className="px-5 pt-6 pb-4">
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-semibold tracking-tight" style={{ color: 'var(--ink)' }}>kharcha</span>
            <span className="font-mono text-xs" style={{ color: 'var(--ink-4)' }}>₹</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-0.5">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all"
              style={({ isActive }) => ({
                background: isActive ? 'var(--surface-3)' : 'transparent',
                color: isActive ? 'var(--ink)' : 'var(--ink-3)',
                fontWeight: isActive ? '500' : '400',
              })}
            >
              <span className="text-base leading-none">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="px-3 pb-5 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2.5 px-2.5 py-2">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0"
              style={{ background: 'var(--surface-3)', color: 'var(--ink-2)' }}
            >
              {initial}
            </div>
            <span className="text-xs flex-1 truncate" style={{ color: 'var(--ink-3)' }}>{name}</span>
            <button
              onClick={signOut}
              className="text-xs transition-colors"
              style={{ color: 'var(--ink-4)' }}
              title="Sign out"
            >
              ↩
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 border-b" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <span className="text-base font-semibold tracking-tight" style={{ color: 'var(--ink)' }}>kharcha</span>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="w-8 h-8 flex items-center justify-center rounded-lg"
          style={{ background: 'var(--surface-2)' }}
        >
          <span className="text-sm">{mobileOpen ? '✕' : '☰'}</span>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 animate-fade-in"
          style={{ background: 'rgba(0,0,0,0.2)' }}
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="absolute top-[49px] left-0 right-0 border-b py-2 px-3"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            onClick={e => e.stopPropagation()}
          >
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-sm"
                style={({ isActive }) => ({
                  background: isActive ? 'var(--surface-3)' : 'transparent',
                  color: isActive ? 'var(--ink)' : 'var(--ink-3)',
                  fontWeight: isActive ? '500' : '400',
                })}
              >
                <span>{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
            <div className="border-t mt-2 pt-2" style={{ borderColor: 'var(--border)' }}>
              <button
                onClick={signOut}
                className="w-full text-left px-2.5 py-2.5 text-sm rounded-lg"
                style={{ color: 'var(--ink-3)' }}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 min-w-0 pb-20 md:pb-0 pt-[49px] md:pt-0">
        {children}
      </main>
    </div>
  )
}
