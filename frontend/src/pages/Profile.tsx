import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useProfile } from '@/hooks/useProfile'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { ErrorMessage } from '@/components/common/ErrorMessage'
import { Edit, Mail, User, Calendar, Shield } from 'lucide-react'

export default function Profile() {
  const { profile, loading, error } = useProfile()

  if (loading) return <LoadingSpinner />
  if (error) return <ErrorMessage message={error} />
  if (!profile) return <ErrorMessage message="Profile not found" />

  const topSkills = [
    'React', 'TypeScript', 'Node.js', 'Python', 'AWS',
    'Docker', 'PostgreSQL', 'GraphQL', 'Leadership', 'Agile'
  ]

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-10 w-10 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl">
                  {profile?.firstName} {profile?.lastName}
                </CardTitle>
                <CardDescription>@{profile?.username}</CardDescription>
              </div>
            </div>
            <Button variant="outline">
              <Edit className="h-4 w-4 mr-2" />
              Edit Profile
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{profile?.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Member since {new Date(profile?.createdAt || '').toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm capitalize">Account Status: {profile?.accountStatus}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Professional Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Professional Summary</CardTitle>
          <CardDescription>
            A brief overview of your career and aspirations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No professional summary added yet. Add a compelling summary to help others understand your career journey and goals.
          </p>
          <Button variant="outline" size="sm" className="mt-4">
            Add Summary
          </Button>
        </CardContent>
      </Card>

      {/* Skills */}
      <Card>
        <CardHeader>
          <CardTitle>Top Skills</CardTitle>
          <CardDescription>
            Your most prominent professional skills
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {topSkills.map((skill) => (
              <Badge key={skill} variant="secondary">
                {skill}
              </Badge>
            ))}
          </div>
          <Button variant="outline" size="sm" className="mt-4">
            Manage Skills
          </Button>
        </CardContent>
      </Card>

      {/* Career Goals */}
      <Card>
        <CardHeader>
          <CardTitle>Career Goals</CardTitle>
          <CardDescription>
            Your professional aspirations and objectives
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No career goals set yet. Define your career objectives to get personalized guidance.
          </p>
          <Button variant="outline" size="sm" className="mt-4">
            Set Goals
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}