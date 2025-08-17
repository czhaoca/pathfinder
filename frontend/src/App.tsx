import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { authStore } from '@/stores/authStore'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'

// Pages
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import { InviteRegistration } from '@/pages/InviteRegistration'
import Dashboard from '@/pages/Dashboard'
import Chat from '@/pages/Chat'
import Experiences from '@/pages/Experiences'
import Profile from '@/pages/Profile'
import CPAPert from '@/pages/CPAPert'
import CPAPertMapping from '@/pages/CPAPertMapping'
import CPAPertWriter from '@/pages/CPAPertWriter'
import CPAPertCompliance from '@/pages/CPAPertCompliance'
import CPAPertHistory from '@/pages/CPAPertHistory'
import PertResponseDetail from '@/pages/PertResponseDetail'
import CPAPertProgress from '@/pages/CPAPertProgress'
import AnalyticsDashboard from '@/pages/AnalyticsDashboard'
import ResumePage from '@/pages/ResumePage'
import CareerPath from '@/pages/CareerPath'
import Networking from '@/pages/Networking'
import JobSearch from '@/pages/JobSearch'
import InterviewPrep from '@/pages/InterviewPrep'
import Learning from '@/pages/Learning'

// Admin Pages
import AdminDashboard from '@/pages/admin/AdminDashboard'
import UserManagement from '@/pages/admin/UserManagement'
import AuditLogViewer from '@/pages/admin/AuditLogViewer'
import DeletionQueue from '@/pages/admin/DeletionQueue'
import { InvitationManager } from '@/components/admin/InvitationManager'

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
          <Route path="/register/invite" element={<InviteRegistration />} />
          
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
            <Route path="analytics" element={<AnalyticsDashboard />} />
            <Route path="resume" element={<ResumePage />} />
            <Route path="career-path" element={<CareerPath />} />
            <Route path="networking" element={<Networking />} />
            <Route path="job-search" element={<JobSearch />} />
            <Route path="interview-prep" element={<InterviewPrep />} />
            <Route path="interview-prep/:applicationId" element={<InterviewPrep />} />
            <Route path="learning" element={<Learning />} />
            <Route path="cpa-pert" element={<CPAPert />} />
            <Route path="cpa-pert/mapping" element={<CPAPertMapping />} />
            <Route path="cpa-pert/write" element={<CPAPertWriter />} />
            <Route path="cpa-pert/compliance" element={<CPAPertCompliance />} />
            <Route path="cpa-pert/history" element={<CPAPertHistory />} />
            <Route path="cpa-pert/response/:responseId" element={<PertResponseDetail />} />
            <Route path="cpa-pert/progress" element={<CPAPertProgress />} />
            <Route path="profile" element={<Profile />} />
            
            {/* Admin routes */}
            <Route path="admin" element={<AdminDashboard />} />
            <Route path="admin/users" element={<UserManagement />} />
            <Route path="admin/invitations" element={<InvitationManager />} />
            <Route path="admin/audit-logs" element={<AuditLogViewer />} />
            <Route path="admin/deletion-queue" element={<DeletionQueue />} />
          </Route>
          
          {/* Catch all */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  )
}

export default App