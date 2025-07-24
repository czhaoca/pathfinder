import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Calendar, MapPin, Building2 } from 'lucide-react'

interface Experience {
  id: string
  role: string
  organization: string
  startDate: string
  endDate?: string
  current: boolean
  location: string
  description: string
}

// Mock data
const mockExperiences: Experience[] = [
  {
    id: '1',
    role: 'Senior Software Engineer',
    organization: 'TechCorp Inc.',
    startDate: '2022-01',
    current: true,
    location: 'San Francisco, CA',
    description: 'Leading development of cloud-native applications using React and Node.js.',
  },
  {
    id: '2',
    role: 'Software Engineer',
    organization: 'StartupXYZ',
    startDate: '2020-03',
    endDate: '2021-12',
    current: false,
    location: 'Remote',
    description: 'Developed and maintained full-stack web applications for e-commerce platform.',
  },
]

export default function Experiences() {
  const [experiences] = useState<Experience[]>(mockExperiences)

  const formatDate = (date: string) => {
    const [year, month] = date.split('-')
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${monthNames[parseInt(month) - 1]} ${year}`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Professional Experiences</h1>
          <p className="text-muted-foreground mt-2">
            Manage and showcase your career journey
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Experience
        </Button>
      </div>

      {/* Experience List */}
      <div className="space-y-4">
        {experiences.map((exp) => (
          <Card key={exp.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>{exp.role}</CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-2">
                    <Building2 className="h-4 w-4" />
                    {exp.organization}
                  </CardDescription>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {formatDate(exp.startDate)} - {exp.current ? 'Present' : formatDate(exp.endDate!)}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <MapPin className="h-4 w-4" />
                    {exp.location}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{exp.description}</p>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" size="sm">Edit</Button>
                <Button variant="outline" size="sm">View Details</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {experiences.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <p className="text-muted-foreground mb-4">
              No experiences added yet. Start building your professional story!
            </p>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Experience
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}