import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import AppLayout from './components/layout/AppLayout'
import AuthPage from './pages/AuthPage'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Budget from './pages/Budget'
import Review from './pages/Review'
import ExportHistory from './pages/ExportHistory'

function ProtectedRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafaf8' }}>
        <div className="font-mono" style={{ fontSize: '14px', color: '#9a9a9a' }}>loading...</div>
      </div>
    )
  }

  if (!user) return <AuthPage />

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/expenses" element={<Transactions />} />
        <Route path="/budget" element={<Budget />} />
        <Route path="/review" element={<Review />} />
        <Route path="/export-history" element={<ExportHistory />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </AppLayout>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ProtectedRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
