import api from '@/lib/api'
import {
  ResumeTemplate,
  ResumeGenerationOptions,
  ResumePreview,
  ATSOptimizationResponse,
  ResumeVersion,
  ResumeSectionType,
  ResumeFormat,
  ResumeGenerationResponse
} from '@/types/resume'
import { downloadBlob, generateFilename } from '@/utils/download'

class ResumeService {
  /**
   * Get available resume templates
   */
  async getTemplates(): Promise<{ templates: ResumeTemplate[], count: number }> {
    return api.get('/resume/templates')
  }

  /**
   * Preview resume without generating file
   */
  async previewResume(options: {
    templateId?: string
    targetRole?: string
    atsOptimized?: boolean
  }): Promise<ResumePreview> {
    const params = new URLSearchParams()
    if (options.templateId) params.append('templateId', options.templateId)
    if (options.targetRole) params.append('targetRole', options.targetRole)
    if (options.atsOptimized !== undefined) params.append('atsOptimized', options.atsOptimized.toString())
    
    return api.get(`/resume/preview?${params.toString()}`)
  }

  /**
   * Generate resume in specified format
   */
  async generateResume(options: ResumeGenerationOptions): Promise<Blob | ResumeGenerationResponse> {
    const format = options.format || 'pdf'
    
    if (format === 'pdf' || format === 'docx') {
      // For binary formats, use fetch to get blob
      const response = await fetch(`${api.baseURL}/resume/generate`, {
        method: 'POST',
        headers: api.getHeaders(),
        body: JSON.stringify(options)
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to generate resume')
      }
      
      return response.blob()
    } else {
      // For JSON format, use regular API call
      return api.post('/resume/generate', options)
    }
  }

  /**
   * Download generated resume
   */
  downloadResume(blob: Blob, format: ResumeFormat, fileName?: string) {
    const filename = fileName || generateFilename('resume', format)
    downloadBlob(blob, filename)
  }

  /**
   * Get ATS optimization suggestions
   */
  async getATSOptimization(targetRole: string): Promise<ATSOptimizationResponse> {
    const params = new URLSearchParams({ targetRole })
    return api.get(`/resume/ats-optimization?${params.toString()}`)
  }

  /**
   * Generate multiple resume versions
   */
  async generateVersions(options: {
    targetRoles: string[]
    templates?: string[]
  }): Promise<{ versions: ResumeVersion[], count: number }> {
    return api.post('/resume/generate-versions', options)
  }

  /**
   * Update resume section
   */
  async updateSection(section: ResumeSectionType, data: ResumeSectionUpdate['data']): Promise<{ success: boolean, message: string }> {
    return api.put(`/resume/section/${section}`, { data })
  }

  /**
   * Format bullet point for resume
   */
  formatBulletPoint(text: string): string {
    // Remove leading dashes or bullets
    text = text.replace(/^[-•·▪◦]\s*/, '')
    
    // Ensure it starts with capital letter
    text = text.charAt(0).toUpperCase() + text.slice(1)
    
    // Add period if missing
    if (!text.endsWith('.') && !text.endsWith('!') && !text.endsWith('?')) {
      text += '.'
    }
    
    return text
  }

  /**
   * Validate resume data before generation
   */
  validateResumeData(data: Partial<ResumeData>): { isValid: boolean, errors: string[] } {
    const errors: string[] = []
    
    if (!data.personal?.name) {
      errors.push('Name is required')
    }
    
    if (!data.personal?.email) {
      errors.push('Email is required')
    }
    
    if (!data.experiences || data.experiences.length === 0) {
      errors.push('At least one experience is required')
    }
    
    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Get ATS-friendly formatting tips
   */
  getATSFormattingTips(): string[] {
    return [
      'Use standard section headings (Experience, Education, Skills)',
      'Avoid tables, columns, or complex formatting',
      'Use standard fonts (Arial, Calibri, Times New Roman)',
      'Include keywords from the job description',
      'Use standard bullet points (•) instead of fancy symbols',
      'Save as .docx for maximum ATS compatibility',
      'Avoid headers and footers',
      'Use standard date formats (MM/YYYY)',
      'Don\'t use images or graphics',
      'Keep formatting simple and consistent'
    ]
  }

  /**
   * Get action verbs for resume bullets
   */
  getActionVerbs(): Record<string, string[]> {
    return {
      leadership: ['Led', 'Managed', 'Directed', 'Coordinated', 'Supervised', 'Mentored', 'Guided', 'Facilitated'],
      achievement: ['Achieved', 'Delivered', 'Exceeded', 'Accomplished', 'Completed', 'Attained', 'Earned', 'Won'],
      improvement: ['Improved', 'Enhanced', 'Optimized', 'Streamlined', 'Increased', 'Reduced', 'Upgraded', 'Refined'],
      creation: ['Created', 'Developed', 'Designed', 'Built', 'Established', 'Launched', 'Initiated', 'Implemented'],
      analysis: ['Analyzed', 'Evaluated', 'Assessed', 'Researched', 'Investigated', 'Examined', 'Identified', 'Measured'],
      communication: ['Presented', 'Communicated', 'Collaborated', 'Negotiated', 'Advocated', 'Persuaded', 'Influenced']
    }
  }

  /**
   * Suggest improvements for a bullet point
   */
  suggestBulletImprovements(bullet: string): string[] {
    const suggestions: string[] = []
    
    // Check if it starts with action verb
    const firstWord = bullet.split(' ')[0]
    const actionVerbs = Object.values(this.getActionVerbs()).flat()
    if (!actionVerbs.some(verb => firstWord.toLowerCase() === verb.toLowerCase())) {
      suggestions.push('Start with a strong action verb')
    }
    
    // Check for quantifiable metrics
    if (!/\d/.test(bullet)) {
      suggestions.push('Add quantifiable metrics (numbers, percentages, dollar amounts)')
    }
    
    // Check length
    if (bullet.length > 150) {
      suggestions.push('Keep bullet points concise (under 2 lines)')
    }
    
    // Check for weak phrases
    const weakPhrases = ['responsible for', 'helped with', 'assisted in', 'worked on']
    if (weakPhrases.some(phrase => bullet.toLowerCase().includes(phrase))) {
      suggestions.push('Replace weak phrases with stronger action verbs')
    }
    
    return suggestions
  }

  /**
   * Get resume length recommendation based on experience
   */
  getRecommendedLength(yearsOfExperience: number): string {
    if (yearsOfExperience < 5) {
      return '1 page'
    } else if (yearsOfExperience < 15) {
      return '1-2 pages'
    } else {
      return '2 pages maximum'
    }
  }

  /**
   * Parse LinkedIn profile URL
   */
  parseLinkedInUrl(url: string): string | null {
    const linkedInRegex = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9-]+)/
    const match = url.match(linkedInRegex)
    return match ? `linkedin.com/in/${match[1]}` : null
  }

  /**
   * Format phone number for resume
   */
  formatPhoneNumber(phone: string): string {
    // Remove all non-numeric characters
    const cleaned = phone.replace(/\D/g, '')
    
    // Format as (XXX) XXX-XXXX for US numbers
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
    }
    
    return phone
  }
}

export const resumeService = new ResumeService()