import { useState, useEffect } from 'react'
import { 
  Target, 
  TrendingUp, 
  BookOpen, 
  CheckCircle, 
  AlertCircle,
  Search,
  Filter,
  Plus,
  ChevronRight,
  Clock,
  Award
} from 'lucide-react'
import { toast } from 'sonner'
import careerPathService from '@/services/careerPathService'
import type { 
  CareerNode, 
  CareerGoal, 
  SkillsGap,
  CareerPathVisualization 
} from '@/services/careerPathService'
import { authStore } from '@/stores/authStore'
import CareerPathViz from '@/components/careerPath/CareerPathVisualization'
import SkillsGapAnalysis from '@/components/careerPath/SkillsGapAnalysis'
import LearningRecommendations from '@/components/careerPath/LearningRecommendations'
import GoalTracking from '@/components/careerPath/GoalTracking'

export default function CareerPath() {
  const { user } = authStore()
  const [activeTab, setActiveTab] = useState<'visualization' | 'skills' | 'learning' | 'goals'>('visualization')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIndustry, setSelectedIndustry] = useState('')
  const [selectedLevel, setSelectedLevel] = useState<'entry' | 'mid' | 'senior' | 'executive' | ''>('')
  const [careerNodes, setCareerNodes] = useState<CareerNode[]>([])
  const [userGoals, setUserGoals] = useState<CareerGoal[]>([])
  const [selectedNode, setSelectedNode] = useState<CareerNode | null>(null)
  const [currentVisualization, setCurrentVisualization] = useState<CareerPathVisualization | null>(null)
  const [skillsGap, setSkillsGap] = useState<SkillsGap | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadInitialData()
  }, [])

  const loadInitialData = async () => {
    if (!user?.id) return
    
    setLoading(true)
    try {
      // Load user's goals
      const goals = await careerPathService.getUserGoals(user.id)
      setUserGoals(goals)

      // Load career paths based on search
      await searchCareerPaths()

      // If user has active goals, load visualization for the first one
      const activeGoal = goals.find((g: CareerGoal) => g.status === 'active')
      if (activeGoal) {
        await loadVisualization(activeGoal.target_node_id, activeGoal.current_node_id)
      }
    } catch (error) {
      console.error('Error loading initial data:', error)
      toast.error('Failed to load career path data')
    } finally {
      setLoading(false)
    }
  }

  const searchCareerPaths = async () => {
    setLoading(true)
    try {
      const results = await careerPathService.searchCareerPaths({
        query: searchQuery,
        industry: selectedIndustry,
        level: selectedLevel as any,
        limit: 50
      })
      setCareerNodes(results)
    } catch (error) {
      console.error('Error searching career paths:', error)
      toast.error('Failed to search career paths')
    } finally {
      setLoading(false)
    }
  }

  const loadVisualization = async (targetNodeId: string, currentNodeId?: string) => {
    setLoading(true)
    try {
      const visualization = await careerPathService.visualizeCareerPath(targetNodeId, currentNodeId)
      setCurrentVisualization(visualization)
      
      // Also load skills gap if we have both current and target
      if (currentNodeId) {
        const gap = await careerPathService.analyzeSkillsGap(currentNodeId, targetNodeId)
        setSkillsGap(gap)
      }
    } catch (error) {
      console.error('Error loading visualization:', error)
      toast.error('Failed to load career path visualization')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateGoal = async (targetNode: CareerNode) => {
    if (!user?.id) return

    try {
      // Prompt for current role and target date
      const currentRole = prompt('What is your current role/position?')
      if (!currentRole) return

      const targetDate = prompt('When do you want to achieve this goal? (YYYY-MM-DD)')
      if (!targetDate) return

      const goal = await careerPathService.createGoal({
        currentNodeId: currentRole,
        targetNodeId: targetNode.node_id,
        targetDate,
        notes: `Goal to transition to ${targetNode.title}`
      })

      setUserGoals([...userGoals, goal])
      toast.success('Career goal created successfully!')
      
      // Load visualization for the new goal
      await loadVisualization(targetNode.node_id, currentRole)
    } catch (error) {
      console.error('Error creating goal:', error)
      toast.error('Failed to create career goal')
    }
  }

  const tabContent = {
    visualization: (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4">Career Path Visualization</h3>
          {currentVisualization ? (
            <CareerPathViz 
              visualization={currentVisualization}
              onNodeClick={(node) => setSelectedNode(node)}
            />
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Target className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>Select a career goal or search for career paths to visualize your journey</p>
            </div>
          )}
        </div>

        {selectedNode && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h4 className="font-semibold mb-3">{selectedNode.title}</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Industry:</span>
                <span className="ml-2 font-medium">{selectedNode.industry}</span>
              </div>
              <div>
                <span className="text-gray-600">Level:</span>
                <span className="ml-2 font-medium capitalize">{selectedNode.level}</span>
              </div>
              {selectedNode.average_salary && (
                <div>
                  <span className="text-gray-600">Avg Salary:</span>
                  <span className="ml-2 font-medium">
                    ${selectedNode.average_salary.toLocaleString()}
                  </span>
                </div>
              )}
              {selectedNode.years_experience && (
                <div>
                  <span className="text-gray-600">Experience:</span>
                  <span className="ml-2 font-medium">
                    {selectedNode.years_experience} years
                  </span>
                </div>
              )}
            </div>
            {selectedNode.description && (
              <p className="mt-4 text-sm text-gray-600">{selectedNode.description}</p>
            )}
            <button
              onClick={() => handleCreateGoal(selectedNode)}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Set as Career Goal
            </button>
          </div>
        )}
      </div>
    ),
    skills: (
      <SkillsGapAnalysis 
        skillsGap={skillsGap}
        onRefresh={() => {
          if (currentVisualization?.targetPosition && currentVisualization?.currentPosition) {
            loadVisualization(currentVisualization.targetPosition, currentVisualization.currentPosition)
          }
        }}
      />
    ),
    learning: (
      <LearningRecommendations 
        skillsGap={skillsGap}
        userId={user?.id}
      />
    ),
    goals: (
      <GoalTracking 
        goals={userGoals}
        onGoalUpdate={(goalId, updates) => {
          careerPathService.updateGoal(goalId, updates).then(() => {
            loadInitialData()
            toast.success('Goal updated successfully')
          })
        }}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow-sm rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Career Path Planning</h1>
            <p className="text-gray-600 mt-1">
              Visualize your career journey and plan your professional growth
            </p>
          </div>
          <button
            onClick={() => loadInitialData()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Refresh
          </button>
        </div>

        {/* Search and Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search career paths..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchCareerPaths()}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={selectedIndustry}
            onChange={(e) => setSelectedIndustry(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Industries</option>
            <option value="technology">Technology</option>
            <option value="finance">Finance</option>
            <option value="healthcare">Healthcare</option>
            <option value="education">Education</option>
            <option value="marketing">Marketing</option>
            <option value="sales">Sales</option>
            <option value="consulting">Consulting</option>
          </select>
          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Levels</option>
            <option value="entry">Entry Level</option>
            <option value="mid">Mid Level</option>
            <option value="senior">Senior Level</option>
            <option value="executive">Executive</option>
          </select>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('visualization')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'visualization'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Target className="w-4 h-4 inline mr-2" />
              Path Visualization
            </button>
            <button
              onClick={() => setActiveTab('skills')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'skills'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <TrendingUp className="w-4 h-4 inline mr-2" />
              Skills Gap Analysis
            </button>
            <button
              onClick={() => setActiveTab('learning')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'learning'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <BookOpen className="w-4 h-4 inline mr-2" />
              Learning Recommendations
            </button>
            <button
              onClick={() => setActiveTab('goals')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'goals'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <CheckCircle className="w-4 h-4 inline mr-2" />
              Goal Tracking
            </button>
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          tabContent[activeTab]
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Goals</p>
              <p className="text-2xl font-bold text-gray-900">
                {userGoals.filter(g => g.status === 'active').length}
              </p>
            </div>
            <Target className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Skills to Learn</p>
              <p className="text-2xl font-bold text-gray-900">
                {skillsGap?.gap.length || 0}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Completed Goals</p>
              <p className="text-2xl font-bold text-gray-900">
                {userGoals.filter(g => g.status === 'achieved').length}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Career Paths</p>
              <p className="text-2xl font-bold text-gray-900">
                {careerNodes.length}
              </p>
            </div>
            <Award className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>
    </div>
  )
}