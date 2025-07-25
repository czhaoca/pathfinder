import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { useExperiences } from '@/hooks/useExperiences'
import { ExperienceList } from '@/components/experience/ExperienceList'
import { ExperienceForm } from '@/components/experience/ExperienceForm'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { ErrorMessage } from '@/components/common/ErrorMessage'
import { EmptyState } from '@/components/common/EmptyState'

export default function Experiences() {
  const { 
    experiences, 
    isLoading, 
    error, 
    fetchExperiences,
    createExperience,
    updateExperience,
    deleteExperience 
  } = useExperiences()
  
  const [showForm, setShowForm] = useState(false)
  const [editingExperience, setEditingExperience] = useState(null)

  useEffect(() => {
    fetchExperiences()
  }, [fetchExperiences])

  const handleEdit = (experience: any) => {
    setEditingExperience(experience)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this experience?')) {
      await deleteExperience(id)
    }
  }

  const handleSubmit = async (data: any) => {
    if (editingExperience) {
      await updateExperience(editingExperience.id, data)
    } else {
      await createExperience(data)
    }
    setShowForm(false)
    setEditingExperience(null)
  }

  if (isLoading) return <LoadingSpinner />
  if (error) return <ErrorMessage message={error} />

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
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Experience
        </Button>
      </div>

      {/* Experience Form Modal */}
      {showForm && (
        <ExperienceForm
          experience={editingExperience}
          onSubmit={handleSubmit}
          onCancel={() => {
            setShowForm(false)
            setEditingExperience(null)
          }}
        />
      )}

      {/* Experience List */}
      {experiences.length > 0 ? (
        <ExperienceList
          experiences={experiences}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      ) : (
        <EmptyState
          title="No experiences yet"
          description="Start building your professional profile by adding your first experience."
          action={
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Experience
            </Button>
          }
        />
      )}
    </div>
  )
}