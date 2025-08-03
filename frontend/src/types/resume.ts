// Resume Data Types
export interface ResumeData {
  resumeId: string
  personal: PersonalInfo
  experiences: ResumeExperience[]
  skills: SkillCategory[]
  education: Education[]
  achievements: string[]
  certifications: Certification[]
  atsScore?: ATSScore
}

export interface PersonalInfo {
  name: string
  email: string
  phone?: string
  location?: string
  linkedIn?: string
  website?: string
  summary: string
}

export interface ResumeExperience {
  title: string
  company: string
  location?: string
  startDate: string
  endDate: string
  bullets: string[]
}

export interface SkillCategory {
  category: string
  skills: string[]
}

export interface Education {
  institution: string
  degree: string
  field?: string
  location?: string
  startDate: string
  endDate: string
  gpa?: number
  honors?: string[]
}

export interface Certification {
  name: string
  issuer: string
  date: string
  expiry?: string
  credentialId?: string
}

export interface ATSScore {
  total: number
  factors: {
    keywords: number
    formatting: number
    length: number
    sections: number
  }
}

// Resume Template Types
export interface ResumeTemplate {
  id: string
  name: string
  description: string
  preview?: string
}

// Resume Generation Options
export interface ResumeGenerationOptions {
  templateId?: string
  targetRole?: string
  includeSkills?: boolean
  includeEducation?: boolean
  includeAchievements?: boolean
  atsOptimized?: boolean
  format?: ResumeFormat
}

export type ResumeFormat = 'pdf' | 'docx' | 'json'

// Resume Preview Types
export interface ResumePreview {
  preview: ResumeData
  atsScore?: ATSScore
}

// ATS Optimization Types
export interface ATSOptimizationSuggestion {
  category: string
  priority: 'high' | 'medium' | 'low'
  suggestion: string
  improvement?: string
}

export interface ATSOptimizationResponse {
  atsScore: ATSScore
  suggestions: ATSOptimizationSuggestion[]
  optimizationTips: string[]
}

// Resume Versions
export interface ResumeVersion {
  targetRole: string
  template: string
  resumeId: string
  atsScore?: ATSScore
  generatedAt: Date
}

// Resume Section Update
export type ResumeSectionType = 
  | 'personal' 
  | 'summary' 
  | 'experiences' 
  | 'skills' 
  | 'education' 
  | 'achievements' 
  | 'certifications'

export interface ResumeSectionUpdate {
  section: ResumeSectionType
  data: any
}

// Resume Builder State
export interface ResumeBuilderState {
  currentTemplate: string
  targetRole: string
  previewData: ResumeData | null
  atsScore: ATSScore | null
  isGenerating: boolean
  isOptimizing: boolean
  selectedSections: {
    skills: boolean
    education: boolean
    achievements: boolean
    certifications: boolean
  }
}

// Resume Editor Types
export interface ResumeEditorSection {
  id: ResumeSectionType
  title: string
  isEditable: boolean
  isVisible: boolean
  content: any
}

export interface BulletPointEditor {
  id: string
  text: string
  isEditing: boolean
}

// Resume Download Response
export interface ResumeGenerationResponse {
  resumeId: string
  content?: any // For JSON format
  metadata: {
    template: string
    generatedAt: Date
    atsScore?: ATSScore
  }
}