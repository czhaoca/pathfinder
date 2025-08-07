import api from './api'

// Course Types
export interface Course {
  id: string
  course_name: string
  description: string
  provider: string
  provider_course_id?: string
  difficulty_level: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  duration_hours: number
  price_usd?: number
  currency?: string
  language: string
  has_certificate: boolean
  skills_covered: string[]
  prerequisites?: string[]
  rating?: number
  rating_count?: number
  enrolled_count?: number
  updated_at: string
  course_url?: string
  thumbnail_url?: string
}

export interface CourseEnrollment {
  id: string
  course_id: string
  course_name: string
  provider: string
  enrollment_date: string
  start_date?: string
  expected_completion_date?: string
  actual_completion_date?: string
  progress_percentage: number
  time_spent_hours: number
  status: 'enrolled' | 'in_progress' | 'completed' | 'abandoned'
  user_rating?: number
  user_review?: string
  certificate_url?: string
  notes?: string
}

export interface CourseStats {
  total_enrolled: number
  completed: number
  in_progress: number
  abandoned: number
  total_hours_spent: number
  average_completion_time: number
  completion_rate: number
  by_provider: Record<string, number>
  by_difficulty: Record<string, number>
}

// Assessment Types
export interface Assessment {
  id: string
  assessment_name: string
  description?: string
  skill_id?: string
  skill_name?: string
  assessment_type: 'quiz' | 'project' | 'peer_review' | 'self_assessment'
  difficulty_level: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  time_limit_minutes?: number
  passing_score?: number
  total_questions?: number
  is_active: boolean
  created_at: string
}

export interface AssessmentResult {
  id: string
  assessment_id: string
  assessment_name: string
  skill_name?: string
  start_time: string
  end_time?: string
  score?: number
  passed?: boolean
  feedback?: string
  time_spent_minutes?: number
  answers?: Record<string, any>
}

export interface SkillAssessmentSummary {
  total_assessments_taken: number
  passed: number
  failed: number
  average_score: number
  skills_assessed: Array<{
    skill_id: string
    skill_name: string
    current_level: string
    assessments_taken: number
    last_assessment_date: string
    average_score: number
  }>
}

// Certification Types
export interface Certification {
  id: string
  certification_name: string
  organization: string
  level?: 'foundational' | 'associate' | 'professional' | 'expert'
  description?: string
  skills_validated: string[]
  industries?: string[]
  typical_job_roles?: string[]
  exam_format?: string
  cost_usd?: number
  currency?: string
  renewal_period_years?: number
  market_demand_score?: number
  average_salary_impact?: number
  preparation_hours_required?: number
  passing_score?: number
  website_url?: string
  exam_guide_url?: string
}

export interface UserCertification {
  id: string
  certification_id: string
  certification_name: string
  organization: string
  credential_number?: string
  issue_date: string
  expiry_date?: string
  status: 'active' | 'expired' | 'revoked' | 'renewing'
  verification_url?: string
  certificate_file_url?: string
  cpe_credits_earned?: number
  preparation_hours?: number
  exam_score?: string
  exam_date?: string
  notes?: string
}

export interface CertificationStats {
  total_certifications: number
  active: number
  expired: number
  expiring_soon: number
  by_organization: Record<string, number>
  by_level: Record<string, number>
  total_cpe_credits: number
  average_preparation_hours: number
}

// Learning Path Types
export interface LearningPath {
  id: string
  path_name: string
  path_description?: string
  creator_id?: string
  target_role?: string
  target_level?: 'entry' | 'mid' | 'senior' | 'expert'
  estimated_duration_weeks?: number
  difficulty_level?: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  skills_gained?: string[]
  prerequisites?: string[]
  is_public: boolean
  popularity_score?: number
  completion_count?: number
  average_rating?: number
  tags?: string[]
  created_at: string
  updated_at?: string
}

export interface LearningPathStep {
  id: string
  path_id: string
  step_order: number
  step_name: string
  step_type: 'course' | 'assessment' | 'project' | 'reading' | 'practice'
  resource_id?: string
  resource_url?: string
  description?: string
  estimated_hours?: number
  is_required: boolean
  skills_developed?: string[]
}

export interface UserLearningPath {
  id: string
  path_id: string
  path_name: string
  enrollment_date: string
  target_completion_date?: string
  actual_completion_date?: string
  current_step?: number
  total_steps: number
  progress_percentage: number
  status: 'enrolled' | 'in_progress' | 'completed' | 'abandoned'
  time_spent_hours: number
  user_rating?: number
  user_feedback?: string
}

export interface PathProgress {
  user_path_id: string
  path_name: string
  steps: Array<{
    step_id: string
    step_name: string
    step_order: number
    status: 'not_started' | 'in_progress' | 'completed' | 'skipped'
    time_spent?: number
    score?: number
    feedback?: string
    completed_at?: string
  }>
  overall_progress: number
  estimated_time_remaining: number
}

// Learning Goal Types
export interface LearningGoal {
  id: string
  goal_title: string
  goal_description?: string
  target_date: string
  goal_type: 'skill_acquisition' | 'certification' | 'course_completion' | 'project'
  target_skill_id?: string
  target_skill_level?: 'novice' | 'competent' | 'proficient' | 'expert'
  related_path_id?: string
  progress_percentage: number
  status: 'active' | 'completed' | 'missed' | 'cancelled'
  created_at: string
  completed_at?: string
  notes?: string
}

// Analytics Types
export interface LearningAnalytics {
  total_learning_hours: number
  courses_completed: number
  certifications_earned: number
  skills_developed: number
  current_streak_days: number
  longest_streak_days: number
  learning_velocity: {
    last_7_days: number
    last_30_days: number
    last_90_days: number
  }
  skill_progression: Array<{
    skill_id: string
    skill_name: string
    current_level: string
    progress_to_next: number
    hours_invested: number
  }>
  top_providers: Array<{
    provider: string
    courses_taken: number
    hours_spent: number
  }>
  monthly_activity: Array<{
    month: string
    hours: number
    courses_started: number
    courses_completed: number
  }>
}

class LearningService {
  // Course Methods
  async searchCourses(params?: {
    q?: string
    provider?: string
    skills?: string
    difficulty?: 'beginner' | 'intermediate' | 'advanced' | 'expert'
    maxPrice?: number
    minRating?: number
    certificateRequired?: boolean
    language?: string
    sortBy?: 'rating' | 'price_usd' | 'duration_hours' | 'enrolled_count'
    sortOrder?: 'ASC' | 'DESC'
    limit?: number
    offset?: number
  }): Promise<Course[]> {
    const response = await api.get('/api/learning/courses/search', { params })
    return response.data
  }

  async getRecommendedCourses(limit: number = 10): Promise<Course[]> {
    const response = await api.get('/api/learning/courses/recommended', { params: { limit } })
    return response.data
  }

  async getEnrolledCourses(params?: {
    status?: string
    provider?: string
    sortBy?: string
    sortOrder?: 'ASC' | 'DESC'
  }): Promise<CourseEnrollment[]> {
    const response = await api.get('/api/learning/courses/enrolled', { params })
    return response.data
  }

  async getCourseStats(): Promise<CourseStats> {
    const response = await api.get('/api/learning/courses/stats')
    return response.data
  }

  async getCourseDetails(courseId: string): Promise<Course> {
    const response = await api.get(`/api/learning/courses/${courseId}`)
    return response.data
  }

  async enrollInCourse(data: {
    courseId: string
    startDate?: string
    expectedCompletionDate?: string
    notes?: string
  }): Promise<CourseEnrollment> {
    const response = await api.post('/api/learning/courses/enroll', data)
    return response.data
  }

  async updateCourseProgress(enrollmentId: string, data: {
    progressPercentage?: number
    timeSpentHours?: number
    status?: 'enrolled' | 'in_progress' | 'completed' | 'abandoned'
  }): Promise<CourseEnrollment> {
    const response = await api.put(`/api/learning/courses/${enrollmentId}/progress`, data)
    return response.data
  }

  async completeCourse(enrollmentId: string, data: {
    userRating?: number
    userReview?: string
    certificateUrl?: string
  }): Promise<CourseEnrollment> {
    const response = await api.post(`/api/learning/courses/${enrollmentId}/complete`, data)
    return response.data
  }

  // Assessment Methods
  async getAssessments(params?: {
    skillId?: string
    type?: 'quiz' | 'project' | 'peer_review' | 'self_assessment'
    difficulty?: 'beginner' | 'intermediate' | 'advanced' | 'expert'
    isActive?: boolean
    limit?: number
    offset?: number
  }): Promise<Assessment[]> {
    const response = await api.get('/api/learning/assessments', { params })
    return response.data
  }

  async getAssessmentResults(params?: {
    skillId?: string
    passed?: boolean
    limit?: number
    offset?: number
  }): Promise<AssessmentResult[]> {
    const response = await api.get('/api/learning/assessments/results', { params })
    return response.data
  }

  async getSkillAssessmentSummary(): Promise<SkillAssessmentSummary> {
    const response = await api.get('/api/learning/assessments/summary')
    return response.data
  }

  async getAssessmentDetails(assessmentId: string): Promise<Assessment> {
    const response = await api.get(`/api/learning/assessments/${assessmentId}`)
    return response.data
  }

  async startAssessment(assessmentId: string): Promise<AssessmentResult> {
    const response = await api.post(`/api/learning/assessments/${assessmentId}/start`)
    return response.data
  }

  async submitAssessment(assessmentId: string, data: {
    resultId: string
    answers: Record<string, any>
    timeSpent?: number
  }): Promise<AssessmentResult> {
    const response = await api.post(`/api/learning/assessments/${assessmentId}/submit`, data)
    return response.data
  }

  async generateAIAssessment(data: {
    skillId: string
    difficultyLevel?: 'beginner' | 'intermediate' | 'advanced' | 'expert'
    questionCount?: number
    assessmentType?: 'quiz' | 'project' | 'peer_review' | 'self_assessment'
  }): Promise<Assessment> {
    const response = await api.post('/api/learning/assessments/generate', data)
    return response.data
  }

  // Certification Methods
  async browseCertifications(params?: {
    industry?: string
    level?: 'foundational' | 'associate' | 'professional' | 'expert'
    organization?: string
    q?: string
    minDemand?: number
    maxCost?: number
    sortBy?: 'market_demand_score' | 'average_salary_impact' | 'cost_usd' | 'certification_name'
    sortOrder?: 'ASC' | 'DESC'
    limit?: number
    offset?: number
  }): Promise<Certification[]> {
    const response = await api.get('/api/learning/certifications/catalog', { params })
    return response.data
  }

  async getUserCertifications(includeExpired: boolean = false): Promise<UserCertification[]> {
    const response = await api.get('/api/learning/certifications/my', { params: { includeExpired } })
    return response.data
  }

  async getExpiringCertifications(days: number = 90): Promise<UserCertification[]> {
    const response = await api.get('/api/learning/certifications/expiring', { params: { days } })
    return response.data
  }

  async getRecommendedCertifications(limit: number = 5): Promise<Certification[]> {
    const response = await api.get('/api/learning/certifications/recommended', { params: { limit } })
    return response.data
  }

  async getCertificationStats(): Promise<CertificationStats> {
    const response = await api.get('/api/learning/certifications/stats')
    return response.data
  }

  async calculateCPECredits(startDate: string, endDate: string): Promise<number> {
    const response = await api.get('/api/learning/certifications/cpe-credits', { 
      params: { startDate, endDate } 
    })
    return response.data
  }

  async getCertificationDetails(certificationId: string): Promise<Certification> {
    const response = await api.get(`/api/learning/certifications/${certificationId}`)
    return response.data
  }

  async addUserCertification(data: {
    certificationId: string
    credentialNumber?: string
    issueDate: string
    expiryDate?: string
    verificationUrl?: string
    certificateFileUrl?: string
    cpeCreditsEarned?: number
    preparationHours?: number
    examScore?: string
    examDate?: string
    notes?: string
  }): Promise<UserCertification> {
    const response = await api.post('/api/learning/certifications/add', data)
    return response.data
  }

  async updateUserCertification(userCertId: string, data: Partial<UserCertification>): Promise<UserCertification> {
    const response = await api.put(`/api/learning/certifications/${userCertId}`, data)
    return response.data
  }

  async trackRenewal(userCertId: string, data: {
    targetRenewalDate?: string
    notes?: string
    isComplete?: boolean
    newCredentialNumber?: string
    newIssueDate?: string
    newExpiryDate?: string
    verificationUrl?: string
    cpeCreditsUsed?: number
  }): Promise<any> {
    const response = await api.post(`/api/learning/certifications/${userCertId}/renew`, data)
    return response.data
  }

  // Learning Path Methods
  async browseLearningPaths(params?: {
    role?: string
    level?: 'entry' | 'mid' | 'senior' | 'expert'
    difficulty?: 'beginner' | 'intermediate' | 'advanced' | 'expert'
    public?: boolean
    createdBy?: string
    q?: string
    sortBy?: 'popularity_score' | 'completion_count' | 'average_rating' | 'created_at'
    sortOrder?: 'ASC' | 'DESC'
    limit?: number
    offset?: number
  }): Promise<LearningPath[]> {
    const response = await api.get('/api/learning/learning-paths', { params })
    return response.data
  }

  async getUserLearningPaths(params?: {
    status?: string
    sortBy?: string
    sortOrder?: 'ASC' | 'DESC'
  }): Promise<UserLearningPath[]> {
    const response = await api.get('/api/learning/learning-paths/my', { params })
    return response.data
  }

  async getRecommendedPaths(limit: number = 5): Promise<LearningPath[]> {
    const response = await api.get('/api/learning/learning-paths/recommended', { params: { limit } })
    return response.data
  }

  async getLearningPathDetails(pathId: string): Promise<LearningPath & { steps: LearningPathStep[] }> {
    const response = await api.get(`/api/learning/learning-paths/${pathId}`)
    return response.data
  }

  async createLearningPath(data: {
    pathName: string
    pathDescription?: string
    targetRole?: string
    targetLevel?: 'entry' | 'mid' | 'senior' | 'expert'
    estimatedDurationWeeks?: number
    difficultyLevel?: 'beginner' | 'intermediate' | 'advanced' | 'expert'
    skillsGained?: string[]
    prerequisites?: string[]
    isPublic?: boolean
    tags?: string[]
    steps?: Partial<LearningPathStep>[]
  }): Promise<LearningPath> {
    const response = await api.post('/api/learning/learning-paths', data)
    return response.data
  }

  async enrollInPath(pathId: string, targetCompletionDate?: string): Promise<UserLearningPath> {
    const response = await api.post(`/api/learning/learning-paths/${pathId}/enroll`, { targetCompletionDate })
    return response.data
  }

  async updatePathProgress(userPathId: string, data: {
    stepId: string
    status: 'not_started' | 'in_progress' | 'completed' | 'skipped'
    timeSpent?: number
    score?: number
    feedback?: string
  }): Promise<void> {
    await api.put(`/api/learning/learning-paths/${userPathId}/progress`, data)
  }

  async getPathProgress(userPathId: string): Promise<PathProgress> {
    const response = await api.get(`/api/learning/learning-paths/${userPathId}/progress`)
    return response.data
  }

  // Learning Goal Methods
  async getLearningGoals(includeCompleted: boolean = false): Promise<LearningGoal[]> {
    const response = await api.get('/api/learning/learning-goals', { params: { includeCompleted } })
    return response.data
  }

  async createLearningGoal(data: {
    goalTitle: string
    goalDescription?: string
    targetDate: string
    goalType: 'skill_acquisition' | 'certification' | 'course_completion' | 'project'
    targetSkillId?: string
    targetSkillLevel?: 'novice' | 'competent' | 'proficient' | 'expert'
    relatedPathId?: string
  }): Promise<LearningGoal> {
    const response = await api.post('/api/learning/learning-goals', data)
    return response.data
  }

  async updateLearningGoal(goalId: string, data: {
    progressPercentage?: number
    status?: 'active' | 'completed' | 'missed' | 'cancelled'
    notes?: string
  }): Promise<LearningGoal> {
    const response = await api.put(`/api/learning/learning-goals/${goalId}`, data)
    return response.data
  }

  async deleteLearningGoal(goalId: string): Promise<void> {
    await api.delete(`/api/learning/learning-goals/${goalId}`)
  }

  // Analytics
  async getLearningAnalytics(): Promise<LearningAnalytics> {
    const response = await api.get('/api/learning/learning/analytics')
    return response.data
  }
}

export default new LearningService()