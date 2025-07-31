export interface Experience {
  experienceId: string
  title: string
  organization?: string
  department?: string
  location?: string
  description: string
  startDate: string
  endDate?: string
  isCurrent: boolean
  experienceType: 'work' | 'education' | 'volunteer' | 'project' | 'certification' | 'other'
  employmentType?: 'full-time' | 'part-time' | 'contract' | 'freelance' | 'internship' | 'temporary'
  extractedSkills?: string[]
  keyHighlights?: string[]
  quantifiedImpacts?: QuantifiedImpact[]
  technologiesUsed?: string[]
  achievements?: string[]
  teamSize?: number
  budgetManaged?: number
  revenueImpact?: number
  costSavings?: number
  createdAt: Date
  updatedAt: Date
}

export interface QuantifiedImpact {
  metric: string
  value: number
  unit?: string
  description?: string
}

export interface ExperienceFilters {
  type?: string
  current?: boolean
  from?: string
  to?: string
  search?: string
  limit?: number
}

export interface ExperienceStats {
  totalExperiences: number
  currentExperiences: number
  uniqueOrganizations: number
  earliestExperience?: Date
  latestExperience?: Date
  totalMonthsExperience?: number
}

export interface ExperienceTemplate {
  id: string
  category: string
  title: string
  description: string
  suggestedSkills: string[]
  template: Partial<Experience>
}

export interface ExtractedSkill {
  name: string
  category: string
  confidence: number
}

export interface BulkExperienceUpdate {
  id: string
  data: Partial<Experience>
}