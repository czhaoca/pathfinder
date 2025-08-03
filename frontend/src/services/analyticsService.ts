import api from '@/lib/api'
import { 
  SkillsProgressionResponse,
  CareerTrajectory,
  AchievementQuantification,
  AnalyticsSummary,
  ExperienceImpactScore,
  CareerInsights,
  SkillRecommendation,
  SkillRecommendationRequest,
  ExportFormat
} from '@/types/analytics'
import { downloadBlob, generateFilename } from '@/utils/download'

class AnalyticsService {
  /**
   * Get skills progression analysis
   */
  async getSkillsProgression(): Promise<SkillsProgressionResponse> {
    return api.get('/analytics/skills-progression')
  }

  /**
   * Get career trajectory visualization data
   */
  async getCareerTrajectory(): Promise<CareerTrajectory> {
    return api.get('/analytics/career-trajectory')
  }

  /**
   * Get comprehensive analytics summary
   */
  async getAnalyticsSummary(refresh = false): Promise<AnalyticsSummary> {
    const params = new URLSearchParams()
    if (refresh) params.append('refresh', 'true')
    
    return api.get(`/analytics/summary?${params.toString()}`)
  }

  /**
   * Get impact scores for experiences
   */
  async getImpactScores(experienceIds?: string[]): Promise<{ scores: ExperienceImpactScore[], count: number }> {
    const params = new URLSearchParams()
    if (experienceIds?.length) {
      params.append('experienceIds', experienceIds.join(','))
    }
    
    return api.get(`/analytics/impact-scores?${params.toString()}`)
  }

  /**
   * Quantify achievements for a specific experience
   */
  async quantifyAchievements(experienceId: string): Promise<AchievementQuantification> {
    return api.post(`/analytics/experiences/${experienceId}/quantify`)
  }

  /**
   * Get career insights
   */
  async getCareerInsights(): Promise<CareerInsights> {
    return api.get('/analytics/insights')
  }

  /**
   * Get skill recommendations based on target role
   */
  async getSkillRecommendations(request: SkillRecommendationRequest): Promise<SkillRecommendation[]> {
    return api.post('/analytics/skill-recommendations', request)
  }

  /**
   * Export analytics data in various formats
   */
  async exportAnalytics(format: ExportFormat = 'json'): Promise<Blob> {
    const response = await fetch(`${api.baseURL}/analytics/export?format=${format}`, {
      method: 'GET',
      headers: api.getHeaders(),
    })
    
    if (!response.ok) {
      throw new Error(`Export failed: ${response.statusText}`)
    }
    
    return response.blob()
  }

  /**
   * Download exported analytics file
   */
  downloadAnalyticsExport(blob: Blob, format: ExportFormat) {
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `career-analytics-${new Date().toISOString().split('T')[0]}.${format}`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  /**
   * Transform skills data for chart visualization
   */
  transformSkillsForChart(skills: SkillsProgressionResponse) {
    const categories = [...new Set(skills.skills.map(s => s.skillCategory))]
    const proficiencyLevels = [1, 2, 3, 4, 5]
    
    const datasets = proficiencyLevels.map(level => {
      const data = categories.map(category => 
        skills.skills.filter(s => s.skillCategory === category && s.proficiencyLevel === level).length
      )
      
      return {
        label: this.getProficiencyLabel(level),
        data,
        backgroundColor: this.getProficiencyColor(level),
      }
    })
    
    return {
      labels: categories,
      datasets
    }
  }

  /**
   * Transform career trajectory for timeline visualization
   */
  transformCareerTimeline(trajectory: CareerTrajectory) {
    return trajectory.timeline.map((entry, index) => ({
      id: entry.experienceId,
      content: entry.title,
      start: new Date(entry.startDate),
      end: entry.endDate === 'Present' ? new Date() : new Date(entry.endDate),
      group: entry.organization,
      className: `level-${entry.level}`,
      title: `${entry.title} at ${entry.organization}\nSkills: ${entry.skills.join(', ')}`,
      data: entry
    }))
  }

  /**
   * Calculate skill diversity metrics
   */
  calculateSkillDiversity(skills: SkillsProgressionResponse) {
    const categoryDistribution = Object.entries(skills.summary.skillsByCategory).map(([category, count]) => ({
      category,
      count,
      percentage: (count / skills.summary.totalSkills) * 100
    }))
    
    return categoryDistribution.sort((a, b) => b.count - a.count)
  }

  /**
   * Get proficiency level label
   */
  private getProficiencyLabel(level: number): string {
    const labels = {
      1: 'Beginner',
      2: 'Basic',
      3: 'Intermediate',
      4: 'Advanced',
      5: 'Expert'
    }
    return labels[level as keyof typeof labels] || 'Unknown'
  }

  /**
   * Get proficiency level color
   */
  private getProficiencyColor(level: number): string {
    const colors = {
      1: '#E5E7EB', // gray-200
      2: '#93C5FD', // blue-300
      3: '#60A5FA', // blue-400
      4: '#3B82F6', // blue-500
      5: '#1D4ED8'  // blue-700
    }
    return colors[level as keyof typeof colors] || '#9CA3AF'
  }

  /**
   * Format date for display
   */
  formatDate(date: Date | string): string {
    const d = new Date(date)
    return d.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short',
      day: 'numeric'
    })
  }

  /**
   * Format duration in months to readable string
   */
  formatDuration(months: number): string {
    const years = Math.floor(months / 12)
    const remainingMonths = months % 12
    
    if (years === 0) {
      return `${remainingMonths} month${remainingMonths !== 1 ? 's' : ''}`
    } else if (remainingMonths === 0) {
      return `${years} year${years !== 1 ? 's' : ''}`
    } else {
      return `${years} year${years !== 1 ? 's' : ''} ${remainingMonths} month${remainingMonths !== 1 ? 's' : ''}`
    }
  }

  /**
   * Calculate career progress percentage
   */
  calculateCareerProgress(summary: AnalyticsSummary): number {
    const scores = [
      summary.careerVelocityScore,
      summary.skillDiversityScore,
      summary.leadershipScore,
      summary.technicalDepthScore,
      summary.industryExpertiseScore
    ]
    
    const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length
    return Math.round(averageScore * 100)
  }

  /**
   * Get recommendation priority color
   */
  getRecommendationColor(priority: 'high' | 'medium' | 'low'): string {
    const colors = {
      high: 'text-red-600 bg-red-50',
      medium: 'text-yellow-600 bg-yellow-50',
      low: 'text-green-600 bg-green-50'
    }
    return colors[priority]
  }

  /**
   * Group impact scores by experience
   */
  groupImpactScoresByExperience(scores: ExperienceImpactScore[]): Map<string, ExperienceImpactScore[]> {
    const grouped = new Map<string, ExperienceImpactScore[]>()
    
    scores.forEach(score => {
      const existing = grouped.get(score.experienceId) || []
      existing.push(score)
      grouped.set(score.experienceId, existing)
    })
    
    return grouped
  }
}

export const analyticsService = new AnalyticsService()