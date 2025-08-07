import React from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { 
  Home, 
  MessageSquare, 
  Briefcase, 
  User, 
  LogOut,
  Menu,
  X,
  FileText,
  BarChart3,
  FileBadge,
  Target
} from 'lucide-react'
import { authStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PageErrorBoundary } from '@/components/common/PageErrorBoundary'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Career Chat', href: '/chat', icon: MessageSquare },
  { name: 'Career Path', href: '/career-path', icon: Target },
  { name: 'Experiences', href: '/experiences', icon: Briefcase },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Resume Builder', href: '/resume', icon: FileBadge },
  { name: 'CPA PERT', href: '/cpa-pert', icon: FileText },
  { name: 'Profile', href: '/profile', icon: User },
]

export default function DashboardLayout() {
  const navigate = useNavigate()
  const { user, logout } = authStore()
  const [sidebarOpen, setSidebarOpen] = React.useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile sidebar */}
      <div className={cn(
        "fixed inset-0 z-50 bg-black/50 lg:hidden",
        sidebarOpen ? "block" : "hidden"
      )} onClick={() => setSidebarOpen(false)} />
      
      <aside className={cn(
        "fixed top-0 left-0 z-50 h-full w-64 bg-white dark:bg-gray-800 shadow-lg transform transition-transform lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between px-6 border-b">
            <h2 className="text-xl font-bold text-primary">Pathfinder</h2>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-4 py-4">
            {navigation.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                    )
                  }
                >
                  <Icon className="h-5 w-5" />
                  {item.name}
                </NavLink>
              )
            })}
          </nav>

          {/* User section */}
          <div className="border-t p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{user?.firstName} {user?.lastName}</p>
                <p className="text-xs text-muted-foreground">@{user?.username}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="w-full"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-white px-6 dark:bg-gray-800">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden"
          >
            <Menu className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-semibold">
            {navigation.find(item => window.location.pathname.includes(item.href))?.name || 'Dashboard'}
          </h1>
        </header>

        {/* Page content */}
        <main className="p-6">
          <PageErrorBoundary>
            <Outlet />
          </PageErrorBoundary>
        </main>
      </div>
    </div>
  )
}