import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

function DashboardIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M1.375 1.375v5.75h3.75v-5.75h-3.75ZM0.125 1.25C0.125 0.62868 0.62868 0.125 1.25 0.125h4c0.62132 0 1.125 0.50368 1.125 1.125v6c0 0.62132 -0.50368 1.125 -1.125 1.125h-4C0.62868 8.375 0.125 7.87132 0.125 7.25v-6ZM8.75 0.125c-0.62132 0 -1.125 0.50368 -1.125 1.125v2.01c0 0.62132 0.50368 1.125 1.125 1.125h4c0.6213 0 1.125 -0.50368 1.125 -1.125V1.25c0 -0.62132 -0.5037 -1.125 -1.125 -1.125h-4Zm0.125 6.75v5.75h3.75v-5.75h-3.75Zm-1.25 -0.125c0 -0.62132 0.50368 -1.125 1.125 -1.125h4c0.6213 0 1.125 0.50368 1.125 1.125v6c0 0.6213 -0.5037 1.125 -1.125 1.125h-4c-0.62132 0 -1.125 -0.5037 -1.125 -1.125v-6ZM1.25 9.61499c-0.62132 0 -1.125 0.50371 -1.125 1.12501v2.01c0 0.6213 0.50368 1.125 1.125 1.125h4c0.62132 0 1.125 -0.5037 1.125 -1.125v-2.01c0 -0.6213 -0.50368 -1.12501 -1.125 -1.12501h-4Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function TransferIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M5 0c-0.20223 0 -0.38455 0.121821 -0.46194 0.308658 -0.07739 0.186837 -0.03461 0.401896 0.10839 0.544895L6.11612 2.32322 0.46967 7.96967c-0.292893 0.29289 -0.292893 0.76777 0 1.06066s0.76777 0.29289 1.06066 0l5.64645 -5.64645 1.46967 1.46967c0.143 0.143 0.35806 0.18578 0.54489 0.10839C9.37818 4.88455 9.5 4.70223 9.5 4.5v-4C9.5 0.223858 9.27614 0 9 0H5Zm-0.19134 9.03806c0.18684 -0.07739 0.40189 -0.03461 0.54489 0.10839l1.46967 1.46965 5.64648 -5.64643c0.2929 -0.29289 0.7677 -0.29289 1.0606 0 0.2929 0.29289 0.2929 0.76777 0 1.06066L7.88388 11.6768l1.46967 1.4696c0.143 0.143 0.18578 0.3581 0.10839 0.5449C9.38455 13.8782 9.20223 14 9 14H5c-0.27614 0 -0.5 -0.2239 -0.5 -0.5v-4c0 -0.20223 0.12182 -0.38455 0.30866 -0.46194Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function PiggyBankIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M10.0622 0.87624c-0.73162 -0.022502 -2.12875 0.27928 -2.87013 1.47964 -2.09143 -0.27926 -3.52347 -0.06498 -4.5445 0.46799 -0.36583 0.19096 -0.66709 0.41688 -0.91927 0.66016 -0.20334 -0.24859 -0.37554 -0.55667 -0.51721 -0.93826 -0.12014 -0.32359 -0.479863 -0.48852 -0.803457 -0.36838 -0.3235953 0.12014 -0.488526 0.47986 -0.3683837 0.80346C0.258786 3.57215 0.557198 4.0801 0.953326 4.493c-0.106849 0.18424 -0.19909 0.36555 -0.282327 0.53755C0.136159 6.1357 0.0612161 7.49613 0.193185 8.7824c0.133233 1.2986 0.485168 2.5962 0.878235 3.629 0.16806 0.4416 0.59055 0.7136 1.04212 0.7136h1.83259c0.62132 0 1.125 -0.5037 1.125 -1.125v-0.4598h2.02918V12c0 0.6213 0.50368 1.125 1.125 1.125h1.65232c0.62137 0 1.12497 -0.5037 1.12497 -1.125v-0.6458c1.1222 -0.4382 2.1318 -1.1079 2.8482 -1.94946 0.0962 -0.11305 0.1491 -0.25666 0.1491 -0.40512V7.25446c0 -0.21788 -0.1135 -0.42004 -0.2995 -0.53353l-1.182 -0.72121c-0.0422 -0.5905 -0.1926 -1.11492 -0.4662 -1.57242 -0.263 -0.43958 -0.6216 -0.78709 -1.0496 -1.06552V1.89574c0 -0.42983 -0.2942 -0.999623 -0.9404 -1.0195ZM8.12344 3.27445c0.30588 -0.7533 1.06519 -1.06981 1.62919 -1.13596v1.57997c0 0.2309 0.1273 0.44298 0.33107 0.55157 0.4223 0.22504 0.7092 0.48699 0.8957 0.79893 0.187 0.31256 0.3015 0.72254 0.3015 1.28918 0 0.21788 0.1135 0.42003 0.2995 0.53352l1.1695 0.7136v1.15546c-0.629 0.66655 -1.5341 1.2195 -2.5683 1.56098 -0.25602 0.0846 -0.42897 0.3238 -0.42897 0.5935v0.9598H8.35031v-0.9598c0 -0.3452 -0.27982 -0.625 -0.625 -0.625H4.44613c-0.34518 0 -0.625 0.2798 -0.625 0.625v0.9598H2.20515c-0.34741 -0.9344 -0.65216 -2.0863 -0.76849 -3.22018 -0.12144 -1.18364 -0.03003 -2.27485 0.3595 -3.07975 0.31838 -0.65787 0.68579 -1.2547 1.42984 -1.64308 0.75853 -0.39595 2.01436 -0.62823 4.21965 -0.27551 0.28731 0.04595 0.56833 -0.11244 0.67779 -0.38203Zm-0.62291 2.12753c0 0.48325 -0.39175 0.875 -0.875 0.875H4.77055c-0.48325 0 -0.875 -0.39175 -0.875 -0.875s0.39175 -0.875 0.875 -0.875l1.85498 0c0.48325 0 0.875 0.39175 0.875 0.875Zm1.20801 0.75183c0 0.48325 0.39175 0.875 0.875 0.875h0.00004c0.48322 0 0.87502 -0.39175 0.87502 -0.875s-0.3918 -0.875 -0.87502 -0.875h-0.00004c-0.48325 0 -0.875 0.39175 -0.875 0.875Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function ReloadVerticalIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.25 8.5 7 10.75 9.25 13"
        strokeWidth="1"
      />
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m4.75 5.49999 2.25 -2.25L4.75 1"
        strokeWidth="1"
      />
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m7 10.75 4.5 0c1.1046 0 2 -0.89543 2 -2l0 -3.5c0 -1.10457 -0.8954 -2 -2 -2l-1.5 0"
        strokeWidth="1"
      />
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m7 3.25 -4.5 0c-1.10457 0 -2 0.89543 -2 2l0 3.5c0 1.10457 0.89543 2 2 2l1.5 0"
        strokeWidth="1"
      />
    </svg>
  )
}

function MailIncomingIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.5 4 7 6.5 9.5 4"
        strokeWidth="1"
      />
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 0.5v6"
        strokeWidth="1"
      />
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 4.5c0.2652 0 0.5196 0.10536 0.7071 0.29289 0.1875 0.18754 0.2929 0.44189 0.2929 0.70711v7c0 0.2652 -0.1054 0.5196 -0.2929 0.7071S12.2652 13.5 12 13.5H2c-0.26522 0 -0.51957 -0.1054 -0.70711 -0.2929C1.10536 13.0196 1 12.7652 1 12.5v-7c0 -0.26522 0.10536 -0.51957 0.29289 -0.70711C1.48043 4.60536 1.73478 4.5 2 4.5"
        strokeWidth="1"
      />
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M1 5.76001 7 10l6 -4.23999"
        strokeWidth="1"
      />
    </svg>
  )
}

const NAV = [
  { to: '/', label: 'Dashboard', icon: <DashboardIcon /> },
  { to: '/expenses', label: 'Transactions', icon: <TransferIcon /> },
  { to: '/budget', label: 'Budget', icon: <PiggyBankIcon /> },
  { to: '/review', label: 'Review', icon: <ReloadVerticalIcon /> },
  { to: '/export-history', label: 'Export History', icon: <MailIncomingIcon /> },
]

export default function AppLayout({ children }) {
  const { user, signOut } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  const name = user?.user_metadata?.name || user?.email?.split('@')[0] || 'You'
  const initial = name[0].toUpperCase()

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--surface)' }}>
      <aside
        className="hidden md:flex flex-col w-52 shrink-0 border-r h-screen sticky top-0"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      >
        <div className="px-5 pt-6 pb-4">
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-semibold tracking-tight" style={{ color: 'var(--ink)' }}>spendly</span>
            <span className="font-mono text-xs" style={{ color: 'var(--ink-4)' }}>₹</span>
          </div>
        </div>

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

      <div
        className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 flex items-center justify-between px-4 border-b"
        style={{
          background: 'var(--surface)',
          borderColor: 'var(--border)',
          paddingTop: 'env(safe-area-inset-top)',
          height: 'calc(56px + env(safe-area-inset-top))',
        }}
      >
        <span className="text-base font-semibold tracking-tight" style={{ color: 'var(--ink)' }}>spendly</span>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="w-8 h-8 flex items-center justify-center rounded-lg"
          style={{ background: 'var(--surface-2)' }}
        >
          <span className="text-sm">{mobileOpen ? '✕' : '☰'}</span>
        </button>
      </div>

      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 animate-fade-in"
          style={{ background: 'rgba(0,0,0,0.2)' }}
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="absolute top-[calc(56px+env(safe-area-inset-top))] left-0 right-0 border-b py-2 px-3"
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

      <main className="flex-1 min-w-0 pb-20 md:pb-0 pt-[calc(56px+env(safe-area-inset-top))] md:pt-0">
        {children}
      </main>
    </div>
  )
}
