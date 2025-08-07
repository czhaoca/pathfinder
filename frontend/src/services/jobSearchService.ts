import api from './api'

export interface JobListing {
  id: string
  job_title: string
  company_id: string
  company_name: string
  location: string
  is_remote: boolean
  job_type: 'full-time' | 'part-time' | 'contract' | 'internship'
  experience_level: 'entry' | 'mid' | 'senior' | 'executive'
  salary_min?: number
  salary_max?: number
  description: string
  requirements?: string[]
  responsibilities?: string[]
  benefits?: string[]
  skills_required?: string[]
  posting_date: string
  application_deadline?: string
  source_url?: string
  match_score?: number
  is_saved?: boolean
}

export interface JobSearchParams {
  q?: string
  location?: string
  remoteOnly?: boolean
  experienceLevel?: 'entry' | 'mid' | 'senior' | 'executive'
  jobType?: 'full-time' | 'part-time' | 'contract' | 'internship'
  salaryMin?: number
  salaryMax?: number
  skills?: string
  companies?: string
  industries?: string
  sortBy?: 'posting_date' | 'salary_max' | 'match_score' | 'company_name'
  sortOrder?: 'ASC' | 'DESC'
  limit?: number
  offset?: number
}

export interface JobPreferences {
  target_roles?: string[]
  target_companies?: string[]
  industries?: string[]
  locations?: string[]
  remote_preference?: 'only_remote' | 'prefer_remote' | 'open_to_remote' | 'prefer_onsite' | 'only_onsite'
  salary_min_expected?: number
  salary_max_expected?: number
  job_types?: string[]
  company_sizes?: string[]
  must_have_benefits?: string[]
  deal_breakers?: string[]
  search_status?: 'active' | 'passive' | 'not_looking'
  urgency_level?: 'immediate' | '3_months' | '6_months' | 'exploring'
}

export interface JobApplication {
  id: string
  job_id: string
  job_title: string
  company_name: string
  status: 'interested' | 'applied' | 'screening' | 'interviewing' | 'offer' | 'rejected' | 'withdrawn'
  application_date?: string
  resume_version_id?: string
  cover_letter_id?: string
  application_method?: 'platform' | 'email' | 'referral' | 'direct'
  referral_contact_id?: string
  application_notes?: string
  excitement_level?: number
  fit_score?: number
  salary_expectation_min?: number
  salary_expectation_max?: number
  last_activity_date?: string
  next_step?: string
  next_step_date?: string
}

export interface ApplicationTimeline {
  application_id: string
  events: Array<{
    event_type: string
    event_date: string
    description: string
    notes?: string
  }>
}

export interface ApplicationStats {
  total_applications: number
  active_applications: number
  interviews_scheduled: number
  offers_received: number
  average_response_time: number
  conversion_rates: {
    applied_to_interview: number
    interview_to_offer: number
    offer_acceptance: number
  }
  by_status: Record<string, number>
  by_month: Array<{
    month: string
    count: number
  }>
}

export interface InterviewQuestion {
  id: string
  question_text: string
  company_id?: string
  company_name?: string
  role_category?: string
  question_type: 'behavioral' | 'technical' | 'situational'
  difficulty_level: 'easy' | 'medium' | 'hard'
  sample_answer?: string
  answer_framework?: string
  tips?: string
  tags?: string[]
}

export interface InterviewResponse {
  id: string
  prep_id: string
  question_text: string
  response_text: string
  interview_id?: string
  self_rating?: number
  needs_improvement?: boolean
  feedback?: string
  created_at: string
  updated_at?: string
}

export interface InterviewPrep {
  application_id: string
  company_name: string
  role_title: string
  interview_date?: string
  questions: InterviewQuestion[]
  responses: InterviewResponse[]
  tips: string[]
  company_insights?: {
    culture?: string
    interview_process?: string
    common_questions?: string[]
  }
}

export interface SavedSearch {
  id: string
  search_name: string
  criteria: JobSearchParams
  notification_frequency?: 'daily' | 'weekly' | 'instant'
  last_run?: string
  new_results_count?: number
  created_at: string
}

export interface Company {
  id: string
  company_name: string
  industry?: string
  company_size?: string
  headquarters_location?: string
  website_url?: string
  linkedin_url?: string
  glassdoor_url?: string
  description?: string
  culture_values?: string[]
  tech_stack?: string[]
  benefits_summary?: string
  rating_glassdoor?: number
  rating_indeed?: number
  logo_url?: string
  open_positions_count?: number
}

class JobSearchService {
  // Job Search
  async searchJobs(params: JobSearchParams): Promise<JobListing[]> {
    const response = await api.get('/api/job-search/jobs/search', { params })
    return response.data
  }

  async getRecommendedJobs(limit: number = 10): Promise<JobListing[]> {
    const response = await api.get('/api/job-search/jobs/recommended', { params: { limit } })
    return response.data
  }

  async getJobDetails(jobId: string): Promise<JobListing> {
    const response = await api.get(`/api/job-search/jobs/${jobId}`)
    return response.data
  }

  async calculateMatchScores(jobIds: string[]): Promise<Array<{ job_id: string; match_score: number }>> {
    const response = await api.post('/api/job-search/jobs/match-scores', { jobIds })
    return response.data
  }

  async importJob(jobData: {
    url: string
    source: string
    jobTitle?: string
    companyName?: string
    description?: string
  }): Promise<JobListing> {
    const response = await api.post('/api/job-search/jobs/import', jobData)
    return response.data
  }

  // Job Preferences
  async getJobPreferences(): Promise<JobPreferences> {
    const response = await api.get('/api/job-search/job-preferences')
    return response.data
  }

  async updateJobPreferences(preferences: Partial<JobPreferences>): Promise<JobPreferences> {
    const response = await api.put('/api/job-search/job-preferences', preferences)
    return response.data
  }

  // Saved Searches
  async saveSearch(searchData: {
    searchName: string
    criteria: JobSearchParams
    notificationFrequency?: 'daily' | 'weekly' | 'instant'
  }): Promise<SavedSearch> {
    const response = await api.post('/api/job-search/saved-searches', searchData)
    return response.data
  }

  async getSavedSearches(): Promise<SavedSearch[]> {
    const response = await api.get('/api/job-search/saved-searches')
    return response.data
  }

  async deleteSavedSearch(searchId: string): Promise<void> {
    await api.delete(`/api/job-search/saved-searches/${searchId}`)
  }

  // Applications
  async getApplications(params?: {
    status?: string
    startDate?: string
    endDate?: string
    company?: string
    sortBy?: 'application_date' | 'status' | 'company_name' | 'excitement_level'
    sortOrder?: 'ASC' | 'DESC'
    limit?: number
    offset?: number
  }): Promise<JobApplication[]> {
    const response = await api.get('/api/job-search/applications', { params })
    return response.data
  }

  async getApplicationDetails(applicationId: string): Promise<JobApplication> {
    const response = await api.get(`/api/job-search/applications/${applicationId}`)
    return response.data
  }

  async createApplication(applicationData: Partial<JobApplication> & { jobId: string }): Promise<JobApplication> {
    const response = await api.post('/api/job-search/applications', applicationData)
    return response.data
  }

  async updateApplication(applicationId: string, updates: Partial<JobApplication>): Promise<JobApplication> {
    const response = await api.put(`/api/job-search/applications/${applicationId}`, updates)
    return response.data
  }

  async withdrawApplication(applicationId: string, reason?: string): Promise<void> {
    await api.delete(`/api/job-search/applications/${applicationId}`, { data: { reason } })
  }

  async getApplicationTimeline(applicationId: string): Promise<ApplicationTimeline> {
    const response = await api.get(`/api/job-search/applications/${applicationId}/timeline`)
    return response.data
  }

  async getApplicationStats(timeframe: number = 30): Promise<ApplicationStats> {
    const response = await api.get('/api/job-search/applications/stats', { params: { timeframe } })
    return response.data
  }

  async bulkUpdateStatus(applicationIds: string[], newStatus: string, notes?: string): Promise<void> {
    await api.post('/api/job-search/applications/bulk-update', {
      applicationIds,
      newStatus,
      notes
    })
  }

  // Interview Preparation
  async getInterviewQuestions(params?: {
    companyId?: string
    roleCategory?: string
    questionType?: 'behavioral' | 'technical' | 'situational'
    difficulty?: 'easy' | 'medium' | 'hard'
    limit?: number
    offset?: number
  }): Promise<InterviewQuestion[]> {
    const response = await api.get('/api/job-search/interview-prep/questions', { params })
    return response.data
  }

  async getApplicationInterviewPrep(applicationId: string): Promise<InterviewPrep> {
    const response = await api.get(`/api/job-search/interview-prep/application/${applicationId}`)
    return response.data
  }

  async saveInterviewResponse(responseData: {
    prepId: string
    responseText: string
    interviewId?: string
    selfRating?: number
    needsImprovement?: boolean
    requestFeedback?: boolean
  }): Promise<InterviewResponse> {
    const response = await api.post('/api/job-search/interview-prep/responses', responseData)
    return response.data
  }

  async updateInterviewResponse(
    responseId: string,
    updates: {
      responseText?: string
      selfRating?: number
      needsImprovement?: boolean
    }
  ): Promise<InterviewResponse> {
    const response = await api.put(`/api/job-search/interview-prep/responses/${responseId}`, updates)
    return response.data
  }

  async getUserResponses(params?: {
    prepId?: string
    interviewId?: string
    needsImprovement?: boolean
    limit?: number
    offset?: number
  }): Promise<InterviewResponse[]> {
    const response = await api.get('/api/job-search/interview-prep/responses', { params })
    return response.data
  }

  async addCustomQuestion(questionData: {
    questionText: string
    companyId?: string
    roleCategory?: string
    questionType?: 'behavioral' | 'technical' | 'situational'
    difficultyLevel?: 'easy' | 'medium' | 'hard'
    sampleAnswer?: string
    answerFramework?: string
    tips?: string
  }): Promise<InterviewQuestion> {
    const response = await api.post('/api/job-search/interview-prep/questions', questionData)
    return response.data
  }

  async getInterviewInsights(): Promise<any> {
    const response = await api.get('/api/job-search/interview-prep/insights')
    return response.data
  }

  // Companies
  async searchCompanies(params?: {
    q?: string
    industry?: string
    size?: string
  }): Promise<Company[]> {
    const response = await api.get('/api/job-search/companies/search', { params })
    return response.data
  }

  async getCompanyDetails(companyId: string): Promise<Company> {
    const response = await api.get(`/api/job-search/companies/${companyId}`)
    return response.data
  }

  async updateCompany(companyId: string, updates: Partial<Company>): Promise<Company> {
    const response = await api.put(`/api/job-search/companies/${companyId}`, updates)
    return response.data
  }
}

export default new JobSearchService()