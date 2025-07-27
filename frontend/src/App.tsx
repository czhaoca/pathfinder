import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { authStore } from '@/stores/authStore'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'

// Pages
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import Dashboard from '@/pages/Dashboard'
import Chat from '@/pages/Chat'
import Experiences from '@/pages/Experiences'
import Profile from '@/pages/Profile'
import CPAPert from '@/pages/CPAPert'
import PertResponseDetail from '@/pages/PertResponseDetail'
import CPAPertProgress from '@/pages/CPAPertProgress'

// Layouts
import AuthLayout from '@/components/layout/AuthLayout'
import DashboardLayout from '@/components/layout/DashboardLayout'

// Protected Route Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = authStore()
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  
  return <>{children}</>
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Toaster position="top-right" richColors />
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Protected routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="chat" element={<Chat />} />
            <Route path="experiences" element={<Experiences />} />
            <Route path="cpa-pert" element={<CPAPert />} />
            <Route path="cpa-pert/response/:responseId" element={<PertResponseDetail />} />
            <Route path="cpa-pert/progress" element={<CPAPertProgress />} />
            <Route path="profile" element={<Profile />} />
          </Route>
          
          {/* Catch all */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  )
}

export default App