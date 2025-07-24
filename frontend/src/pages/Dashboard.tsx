import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowRight, Briefcase, MessageSquare, TrendingUp, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { authStore } from '@/stores/authStore'

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = authStore()

  const stats = [
    { name: 'Total Experiences', value: '12', icon: Briefcase, color: 'text-blue-600' },
    { name: 'Skills Tracked', value: '47', icon: TrendingUp, color: 'text-green-600' },
    { name: 'Chat Sessions', value: '23', icon: MessageSquare, color: 'text-purple-600' },
    { name: 'Profile Views', value: '156', icon: User, color: 'text-orange-600' },
  ]

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h1 className="text-3xl font-bold">Welcome back, {user?.firstName || user?.username}!</h1>
        <p className="text-muted-foreground mt-2">
          Here's an overview of your career journey progress.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.name}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.name}
                </CardTitle>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Jump right into your career development activities
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Button
            onClick={() => navigate('/chat')}
            className="justify-between"
            variant="outline"
          >
            Start Career Chat
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => navigate('/experiences')}
            className="justify-between"
            variant="outline"
          >
            Add New Experience
            <ArrowRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Your latest career development activities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="h-2 w-2 bg-green-500 rounded-full" />
              <div className="flex-1">
                <p className="text-sm font-medium">Added new experience at TechCorp</p>
                <p className="text-xs text-muted-foreground">2 days ago</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="h-2 w-2 bg-blue-500 rounded-full" />
              <div className="flex-1">
                <p className="text-sm font-medium">Completed career assessment chat</p>
                <p className="text-xs text-muted-foreground">5 days ago</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="h-2 w-2 bg-purple-500 rounded-full" />
              <div className="flex-1">
                <p className="text-sm font-medium">Updated skills profile</p>
                <p className="text-xs text-muted-foreground">1 week ago</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}