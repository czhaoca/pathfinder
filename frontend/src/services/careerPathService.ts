import api from '@/lib/api'

export interface CareerNode {
  node_id: string
  title: string
  industry: string
  level: string
  description?: string
  required_skills?: string[]
  average_salary?: number
  demand_level?: string
  years_experience?: number
}

export interface CareerTransition {
  from_node_id: string
  to_node_id: string
  typical_time_months: number
  required_skills: string[]
  difficulty: string
  success_rate?: number
}

export interface CareerPathVisualization {
  nodes: CareerNode[]
  transitions: CareerTransition[]
  currentPosition?: string
  targetPosition: string
  recommendedPath?: string[]
}

export interface SkillsGap {
  currentSkills: SkillAssessment[]
  targetSkills: SkillAssessment[]
  gap: SkillGapItem[]
  recommendations: LearningRecommendation[]
}

export interface SkillAssessment {
  skill_id: string
  skill_name: string
  current_level: number
  target_level?: number
  category?: string
}

export interface SkillGapItem {
  skill_id: string
  skill_name: string
  current_level: number
  target_level: number
  gap_size: number
  priority: 'high' | 'medium' | 'low'
}

export interface LearningRecommendation {
  resource_id: string
  skill_id: string
  title: string
  provider: string
  resource_type: 'course' | 'book' | 'tutorial' | 'certification' | 'workshop' | 'webinar'
  url?: string
  cost?: number
  duration_hours?: number
  difficulty_level: 'beginner' | 'intermediate' | 'advanced'
  rating?: number
  reviews_count?: number
}

export interface CareerGoal {
  goal_id: string
  user_id: string
  current_node_id: string
  target_node_id: string
  target_date: string
  status: 'active' | 'achieved' | 'abandoned' | 'paused'
  progress_percentage?: number
  notes?: string
  created_at: string
  updated_at: string
}

export interface GoalMilestone {
  milestone_id: string
  goal_id: string
  title: string
  description?: string
  target_date: string
  status: 'pending' | 'in_progress' | 'completed'
  completion_date?: string
  order_index: number
}

export interface LearningProgress {
  progress_id: string
  user_id: string
  resource_id?: string
  skill_id: string
  activity_type: 'started' | 'progress' | 'completed' | 'certified'
  hours_spent?: number
  progress_percentage?: number
  notes?: string
  created_at: string
}

export const careerPathService = {
  // Career Path endpoints
  searchCareerPaths: async (params?: {
    query?: string
    industry?: string
    level?: 'entry' | 'mid' | 'senior' | 'executive'
    limit?: number
  }) => {
    const response = await api.get('/api/career-paths/search', { params })
    return response.data
  },

  getCareerNode: async (nodeId: string) => {
    const response = await api.get(`/api/career-paths/${nodeId}`)
    return response.data
  },

  getCareerTransitions: async (nodeId: string) => {
    const response = await api.get(`/api/career-paths/${nodeId}/transitions`)
    return response.data
  },

  visualizeCareerPath: async (targetNodeId: string, currentNodeId?: string) => {
    const response = await api.post('/api/career-paths/visualize', {
      targetNodeId,
      currentNodeId
    })
    return response.data
  },

  // Skills Gap endpoints
  analyzeSkillsGap: async (currentRole: string, targetRole: string) => {
    const response = await api.get(`/api/skills-gap/${currentRole}/${targetRole}`)
    return response.data
  },

  getUserSkillsGap: async (userId: string) => {
    const response = await api.get(`/api/skills-gap/user/${userId}`)
    return response.data
  },

  submitSkillsAssessment: async (goalId: string, skills: SkillAssessment[]) => {
    const response = await api.post('/api/skills-gap/assessment', {
      goalId,
      skills
    })
    return response.data
  },

  // Learning endpoints
  getLearningRecommendations: async (
    skillId: string,
    filters?: {
      maxCost?: number
      difficultyLevel?: 'beginner' | 'intermediate' | 'advanced'
      resourceType?: 'course' | 'book' | 'tutorial' | 'certification' | 'workshop' | 'webinar'
      freeOnly?: boolean
    }
  ) => {
    const response = await api.get(`/api/learning/recommendations/${skillId}`, {
      params: filters
    })
    return response.data
  },

  getLearningPlan: async (userId: string) => {
    const response = await api.get(`/api/learning/user/${userId}/plan`)
    return response.data
  },

  logLearningProgress: async (progress: {
    resourceId?: string
    skillId: string
    activityType: 'started' | 'progress' | 'completed' | 'certified'
    hoursSpent?: number
    progressPercentage?: number
    notes?: string
  }) => {
    const response = await api.post('/api/learning/progress', progress)
    return response.data
  },

  // Goal endpoints
  getUserGoals: async (userId: string) => {
    const response = await api.get(`/api/goals/user/${userId}`)
    return response.data
  },

  createGoal: async (goal: {
    currentNodeId: string
    targetNodeId: string
    targetDate: string
    notes?: string
  }) => {
    const response = await api.post('/api/goals', goal)
    return response.data
  },

  updateGoal: async (
    goalId: string,
    updates: {
      status?: 'active' | 'achieved' | 'abandoned' | 'paused'
      notes?: string
    }
  ) => {
    const response = await api.put(`/api/goals/${goalId}`, updates)
    return response.data
  },

  getGoalMilestones: async (goalId: string) => {
    const response = await api.get(`/api/goals/${goalId}/milestones`)
    return response.data
  }
}

export default careerPathService