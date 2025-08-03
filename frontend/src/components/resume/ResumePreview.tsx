import React, { useState } from 'react'
import {
  FileText,
  Edit2,
  Save,
  X,
  Plus,
  Trash2,
  GripVertical
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  ResumeData,
  PersonalInfo,
  ResumeExperience,
  SkillCategory,
  Education,
  Certification,
  ResumeSectionType
} from '@/types/resume'

interface ResumePreviewProps {
  data: ResumeData
  template: string
  onEdit?: (section: ResumeSectionType, data: any) => void
}

interface EditState {
  section: ResumeSectionType | null
  index?: number
  data: any
}

export default function ResumePreview({ data, template, onEdit }: ResumePreviewProps) {
  const [editState, setEditState] = useState<EditState>({ section: null, data: null })
  const [tempData, setTempData] = useState<any>(null)

  const startEdit = (section: ResumeSectionType, index?: number) => {
    const sectionData = getSectionData(section, index)
    setEditState({ section, index, data: sectionData })
    setTempData({ ...sectionData })
  }

  const getSectionData = (section: ResumeSectionType, index?: number) => {
    switch (section) {
      case 'personal':
        return data.personal
      case 'summary':
        return { summary: data.personal.summary }
      case 'experiences':
        return index !== undefined ? data.experiences[index] : data.experiences
      case 'skills':
        return data.skills
      case 'education':
        return index !== undefined ? data.education[index] : data.education
      case 'achievements':
        return data.achievements
      case 'certifications':
        return index !== undefined ? data.certifications[index] : data.certifications
      default:
        return null
    }
  }

  const cancelEdit = () => {
    setEditState({ section: null, data: null })
    setTempData(null)
  }

  const saveEdit = () => {
    if (editState.section && onEdit) {
      onEdit(editState.section, tempData)
    }
    cancelEdit()
  }

  const isEditing = (section: ResumeSectionType, index?: number) => {
    return editState.section === section && editState.index === index
  }

  const updateTempData = (field: string, value: any) => {
    setTempData(prev => ({ ...prev, [field]: value }))
  }

  const updateArrayItem = (array: any[], index: number, value: any) => {
    const newArray = [...array]
    newArray[index] = value
    return newArray
  }

  const addArrayItem = (array: any[], newItem: any) => {
    return [...array, newItem]
  }

  const removeArrayItem = (array: any[], index: number) => {
    return array.filter((_, i) => i !== index)
  }

  const getTemplateStyles = () => {
    const styles: Record<string, string> = {
      professional: 'font-serif',
      modern: 'font-sans',
      executive: 'font-serif tracking-wide',
      technical: 'font-mono',
      creative: 'font-sans'
    }
    return styles[template] || 'font-sans'
  }

  return (
    <div className={`space-y-6 ${getTemplateStyles()}`}>
      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Personal Information</span>
            {!isEditing('personal') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => startEdit('personal')}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isEditing('personal') ? (
            <div className="space-y-4">
              <Input
                placeholder="Full Name"
                value={tempData?.name || ''}
                onChange={(e) => updateTempData('name', e.target.value)}
              />
              <Input
                placeholder="Email"
                value={tempData?.email || ''}
                onChange={(e) => updateTempData('email', e.target.value)}
              />
              <Input
                placeholder="Phone"
                value={tempData?.phone || ''}
                onChange={(e) => updateTempData('phone', e.target.value)}
              />
              <Input
                placeholder="Location"
                value={tempData?.location || ''}
                onChange={(e) => updateTempData('location', e.target.value)}
              />
              <Input
                placeholder="LinkedIn URL"
                value={tempData?.linkedIn || ''}
                onChange={(e) => updateTempData('linkedIn', e.target.value)}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={cancelEdit}>
                  <X className="h-4 w-4 mr-1" /> Cancel
                </Button>
                <Button size="sm" onClick={saveEdit}>
                  <Save className="h-4 w-4 mr-1" /> Save
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">{data.personal.name}</h2>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {data.personal.email && <span>{data.personal.email}</span>}
                {data.personal.phone && <span>• {data.personal.phone}</span>}
                {data.personal.location && <span>• {data.personal.location}</span>}
              </div>
              {data.personal.linkedIn && (
                <div className="text-sm">
                  <a href={data.personal.linkedIn} className="text-primary hover:underline">
                    {data.personal.linkedIn}
                  </a>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Professional Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Professional Summary</span>
            {!isEditing('summary') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => startEdit('summary')}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isEditing('summary') ? (
            <div className="space-y-4">
              <Textarea
                placeholder="Professional summary..."
                value={tempData?.summary || ''}
                onChange={(e) => updateTempData('summary', e.target.value)}
                rows={4}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={cancelEdit}>
                  <X className="h-4 w-4 mr-1" /> Cancel
                </Button>
                <Button size="sm" onClick={saveEdit}>
                  <Save className="h-4 w-4 mr-1" /> Save
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm leading-relaxed">{data.personal.summary}</p>
          )}
        </CardContent>
      </Card>

      {/* Experience */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Professional Experience</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (onEdit) {
                  const newExperience: ResumeExperience = {
                    title: 'New Position',
                    company: 'Company Name',
                    startDate: new Date().toISOString().split('T')[0],
                    endDate: new Date().toISOString().split('T')[0],
                    bullets: ['Achievement or responsibility']
                  }
                  onEdit('experiences', [...data.experiences, newExperience])
                }
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {data.experiences.map((exp, index) => (
            <div key={index} className="border-l-2 border-gray-200 pl-4">
              {isEditing('experiences', index) ? (
                <div className="space-y-4">
                  <Input
                    placeholder="Job Title"
                    value={tempData?.title || ''}
                    onChange={(e) => updateTempData('title', e.target.value)}
                  />
                  <Input
                    placeholder="Company"
                    value={tempData?.company || ''}
                    onChange={(e) => updateTempData('company', e.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="date"
                      value={tempData?.startDate || ''}
                      onChange={(e) => updateTempData('startDate', e.target.value)}
                    />
                    <Input
                      type="date"
                      value={tempData?.endDate || ''}
                      onChange={(e) => updateTempData('endDate', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    {tempData?.bullets?.map((bullet, bulletIndex) => (
                      <div key={bulletIndex} className="flex gap-2">
                        <Textarea
                          value={bullet}
                          onChange={(e) => {
                            const newBullets = [...tempData.bullets]
                            newBullets[bulletIndex] = e.target.value
                            updateTempData('bullets', newBullets)
                          }}
                          rows={2}
                          className="flex-1"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const newBullets = tempData.bullets.filter((_, i) => i !== bulletIndex)
                            updateTempData('bullets', newBullets)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newBullets = [...(tempData.bullets || []), '']
                        updateTempData('bullets', newBullets)
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add Bullet
                    </Button>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={cancelEdit}>
                      <X className="h-4 w-4 mr-1" /> Cancel
                    </Button>
                    <Button size="sm" onClick={saveEdit}>
                      <Save className="h-4 w-4 mr-1" /> Save
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{exp.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {exp.company} • {new Date(exp.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} - 
                        {new Date(exp.endDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEdit('experiences', index)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (onEdit) {
                            const newExperiences = data.experiences.filter((_, i) => i !== index)
                            onEdit('experiences', newExperiences)
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {exp.bullets.map((bullet, bulletIndex) => (
                      <li key={bulletIndex} className="text-sm flex items-start">
                        <span className="mr-2">•</span>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Skills */}
      <Card>
        <CardHeader>
          <CardTitle>Skills</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.skills.map((category, index) => (
              <div key={index}>
                <h4 className="font-medium text-sm mb-2">{category.category}</h4>
                <div className="flex flex-wrap gap-2">
                  {category.skills.map((skill, skillIndex) => (
                    <Badge key={skillIndex} variant="secondary">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Education */}
      {data.education.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Education</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.education.map((edu, index) => (
              <div key={index}>
                <h3 className="font-semibold">{edu.degree}</h3>
                <p className="text-sm text-muted-foreground">
                  {edu.institution} • {new Date(edu.startDate).getFullYear()} - {new Date(edu.endDate).getFullYear()}
                </p>
                {edu.gpa && <p className="text-sm">GPA: {edu.gpa}</p>}
                {edu.honors && edu.honors.length > 0 && (
                  <p className="text-sm">{edu.honors.join(', ')}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Achievements */}
      {data.achievements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Key Achievements</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.achievements.map((achievement, index) => (
                <li key={index} className="flex items-start text-sm">
                  <span className="mr-2">•</span>
                  <span>{achievement}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Certifications */}
      {data.certifications.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Certifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.certifications.map((cert, index) => (
              <div key={index}>
                <h4 className="font-medium">{cert.name}</h4>
                <p className="text-sm text-muted-foreground">
                  {cert.issuer} • {new Date(cert.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  {cert.expiry && ` - ${new Date(cert.expiry).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}