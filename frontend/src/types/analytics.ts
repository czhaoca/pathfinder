// Skills Progression Types
export interface SkillProgression {
  progressionId: string
  skillName: string
  skillCategory: string
  proficiencyLevel: 1 | 2 | 3 | 4 | 5
  confidenceScore: number
  evidenceCount: number
  firstUsedDate: Date
  lastUsedDate: Date
  totalMonthsUsed: number
  contexts: SkillContext[]
}

export interface SkillContext {
  experienceId: string
  title: string
  organization: string
}

export interface SkillsSummary {
  totalSkills: number
  expertSkills: number
  advancedSkills: number
  skillsByCategory: Record<string, number>
  averageProficiency: number
}

export interface SkillsProgressionResponse {
  skills: SkillProgression[]
  summary: SkillsSummary
  lastUpdated: Date
}

// Career Trajectory Types
export interface CareerMilestone {
  milestoneId: string
  milestoneType: 'promotion' | 'role_change' | 'skill_acquisition' | 'achievement'
  milestoneDate: Date
  title: string
  description?: string
  organization?: string
  impactScore: number
  relatedExperiences: string[]
  relatedSkills?: string[]
}

export interface CareerTransition {
  type: 'industry_change' | 'role_pivot'
  from: TimelineEntry
  to: TimelineEntry
  date: Date
}

export interface TimelineEntry {
  experienceId: string
  title: string
  organization: string
  startDate: Date
  endDate: Date | 'Present'
  type: string
  level: number
  skills: string[]
  impact: any[]
}

export interface CareerProjection {
  timeframe: string
  possibleRoles: string[]
  requiredSkills: string[]
  probability: number
}

export interface CareerTrajectory {
  timeline: TimelineEntry[]
  milestones: CareerMilestone[]
  transitions: CareerTransition[]
  careerVelocity: number
  projectedPath: CareerProjection[]
}

// Achievement Quantification Types
export interface MetricValue {
  value: number
  unit: string
  context: string
}

export interface ExtractedMetrics {
  revenue?: MetricValue
  costSavings?: MetricValue
  efficiency?: MetricValue
  teamSize?: MetricValue
  projectScale?: MetricValue
  other: MetricValue[]
}

export interface ImpactScores {
  revenue: number
  efficiency: number
  teamGrowth: number
  innovation: number
  overall: number
}

export interface ImpactSuggestion {
  category: string
  suggestion: string
}

export interface AchievementQuantification {
  experienceId: string
  metrics: ExtractedMetrics
  impactScores: ImpactScores
  suggestions: ImpactSuggestion[]
}

// Analytics Summary Types
export interface AnalyticsSummary {
  summaryId: string
  analysisDate: Date
  totalYearsExperience: number
  careerVelocityScore: number
  skillDiversityScore: number
  leadershipScore: number
  technicalDepthScore: number
  industryExpertiseScore: number
  topSkills: TopSkill[]
  skillGaps: SkillGap[]
  careerTrajectory: CareerTrajectory
  recommendations: Recommendation[]
}

export interface TopSkill {
  name: string
  category: string
  proficiencyLevel: number
  monthsUsed: number
}

export interface SkillGap {
  skill: string
  importance: 'high' | 'medium' | 'low'
  reason: string
}

export interface Recommendation {
  type: 'skill_development' | 'career_growth' | 'impact_documentation'
  priority: 'high' | 'medium' | 'low'
  recommendation: string
  action: string
}

// Impact Score Types
export interface ExperienceImpactScore {
  scoreId: string
  experienceId: string
  impactCategory: string
  impactScore: number
  quantifiedValue?: number
  valueUnit?: string
  confidenceLevel: number
  calculationMethod?: string
  supportingEvidence?: string
  createdAt: Date
}

// Career Insights Types
export interface CareerInsights {
  strengths: string[]
  growthAreas: string[]
  industryPosition: string
  marketDemand: string[]
  competitiveAdvantage: string[]
}

// Skill Recommendation Types
export interface SkillRecommendation {
  skill: string
  priority: 'high' | 'medium' | 'low'
  reason: string
  learningResources?: string[]
  timeToAcquire?: string
}

export interface SkillRecommendationRequest {
  targetRole: string
  currentSkills?: string[]
}

// Export Types
export type ExportFormat = 'json' | 'csv' | 'pdf'

// Chart Data Types for Visualization
export interface SkillProgressionChartData {
  labels: string[]
  datasets: {
    label: string
    data: number[]
    backgroundColor?: string
    borderColor?: string
  }[]
}

export interface CareerVelocityChartData {
  labels: string[]
  datasets: {
    label: string
    data: { x: Date; y: number }[]
    borderColor?: string
    tension?: number
  }[]
}

export interface SkillCategoryDistribution {
  category: string
  count: number
  percentage: number
}

// Analytics Filter Types
export interface AnalyticsFilters {
  dateRange?: {
    start: Date
    end: Date
  }
  experienceTypes?: string[]
  skillCategories?: string[]
}