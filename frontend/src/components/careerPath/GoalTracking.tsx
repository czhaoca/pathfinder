import { useState, useEffect } from 'react'
import { 
  Target, 
  Calendar, 
  CheckCircle, 
  XCircle, 
  PauseCircle,
  Clock,
  TrendingUp,
  ChevronRight,
  Edit2
} from 'lucide-react'
import type { CareerGoal, GoalMilestone } from '@/services/careerPathService'
import careerPathService from '@/services/careerPathService'
import { toast } from 'sonner'

interface Props {
  goals: CareerGoal[]
  onGoalUpdate: (goalId: string, updates: any) => void
}

export default function GoalTracking({ goals, onGoalUpdate }: Props) {
  const [selectedGoal, setSelectedGoal] = useState<CareerGoal | null>(null)
  const [milestones, setMilestones] = useState<GoalMilestone[]>([])
  const [editingGoal, setEditingGoal] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (selectedGoal) {
      loadMilestones(selectedGoal.goal_id)
    }
  }, [selectedGoal])

  const loadMilestones = async (goalId: string) => {
    setLoading(true)
    try {
      const milestonesData = await careerPathService.getGoalMilestones(goalId)
      setMilestones(milestonesData)
    } catch (error) {
      console.error('Error loading milestones:', error)
      toast.error('Failed to load goal milestones')
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <TrendingUp className="w-5 h-5 text-blue-500" />
      case 'achieved':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'abandoned':
        return <XCircle className="w-5 h-5 text-red-500" />
      case 'paused':
        return <PauseCircle className="w-5 h-5 text-yellow-500" />
      default:
        return <Target className="w-5 h-5 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-blue-100 text-blue-700'
      case 'achieved':
        return 'bg-green-100 text-green-700'
      case 'abandoned':
        return 'bg-red-100 text-red-700'
      case 'paused':
        return 'bg-yellow-100 text-yellow-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const getDaysRemaining = (targetDate: string) => {
    const target = new Date(targetDate)
    const today = new Date()
    const diffTime = target.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const getProgressColor = (percentage: number) => {
    if (percentage >= 75) return 'bg-green-500'
    if (percentage >= 50) return 'bg-yellow-500'
    if (percentage >= 25) return 'bg-orange-500'
    return 'bg-red-500'
  }

  const handleStatusUpdate = (goalId: string, newStatus: CareerGoal['status']) => {
    onGoalUpdate(goalId, { status: newStatus })
  }

  const handleNotesUpdate = (goalId: string) => {
    if (notes.trim()) {
      onGoalUpdate(goalId, { notes })
      setEditingGoal(null)
      setNotes('')
    }
  }

  if (goals.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="text-center py-12">
          <Target className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-semibold mb-2">No Career Goals Yet</h3>
          <p className="text-gray-600">
            Start by setting a career goal in the Path Visualization tab
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Goals Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Goals List */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold">Your Career Goals</h3>
          </div>
          <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
            {goals.map((goal) => {
              const daysRemaining = getDaysRemaining(goal.target_date)
              const isOverdue = daysRemaining < 0 && goal.status === 'active'
              
              return (
                <div
                  key={goal.goal_id}
                  className={`p-4 hover:bg-gray-50 cursor-pointer ${
                    selectedGoal?.goal_id === goal.goal_id ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => setSelectedGoal(goal)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        {getStatusIcon(goal.status)}
                        <h4 className="font-medium text-gray-900">
                          {goal.target_node_id}
                        </h4>
                      </div>
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <span className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          {new Date(goal.target_date).toLocaleDateString()}
                        </span>
                        {goal.status === 'active' && (
                          <span className={`flex items-center ${isOverdue ? 'text-red-600' : ''}`}>
                            <Clock className="w-4 h-4 mr-1" />
                            {isOverdue 
                              ? `${Math.abs(daysRemaining)} days overdue`
                              : `${daysRemaining} days remaining`}
                          </span>
                        )}
                      </div>

                      {goal.progress_percentage !== undefined && (
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                            <span>Progress</span>
                            <span>{goal.progress_percentage}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${getProgressColor(goal.progress_percentage)}`}
                              style={{ width: `${goal.progress_percentage}%` }}
                            />
                          </div>
                        </div>
                      )}

                      <div className="mt-2">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(goal.status)}`}>
                          {goal.status}
                        </span>
                      </div>
                    </div>
                    
                    <ChevronRight className="w-5 h-5 text-gray-400 ml-2" />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Goal Details */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold">Goal Details</h3>
          </div>
          
          {selectedGoal ? (
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Current Position
                  </label>
                  <p className="text-gray-900">{selectedGoal.current_node_id}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Target Position
                  </label>
                  <p className="text-gray-900">{selectedGoal.target_node_id}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Target Date
                  </label>
                  <p className="text-gray-900">
                    {new Date(selectedGoal.target_date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <div className="flex items-center space-x-2">
                    <select
                      value={selectedGoal.status}
                      onChange={(e) => handleStatusUpdate(
                        selectedGoal.goal_id,
                        e.target.value as CareerGoal['status']
                      )}
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="active">Active</option>
                      <option value="paused">Paused</option>
                      <option value="achieved">Achieved</option>
                      <option value="abandoned">Abandoned</option>
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">
                      Notes
                    </label>
                    <button
                      onClick={() => {
                        setEditingGoal(selectedGoal.goal_id)
                        setNotes(selectedGoal.notes || '')
                      }}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {editingGoal === selectedGoal.goal_id ? (
                    <div>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        rows={3}
                        placeholder="Add notes about your progress..."
                      />
                      <div className="flex space-x-2 mt-2">
                        <button
                          onClick={() => handleNotesUpdate(selectedGoal.goal_id)}
                          className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingGoal(null)
                            setNotes('')
                          }}
                          className="px-3 py-1 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-600 text-sm">
                      {selectedGoal.notes || 'No notes added yet'}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Created
                  </label>
                  <p className="text-gray-600 text-sm">
                    {new Date(selectedGoal.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-gray-500">
              Select a goal to view details
            </div>
          )}
        </div>
      </div>

      {/* Milestones */}
      {selectedGoal && (
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold">Goal Milestones</h3>
          </div>
          
          {loading ? (
            <div className="p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : milestones.length > 0 ? (
            <div className="p-6">
              <div className="space-y-4">
                {milestones.map((milestone) => (
                  <div key={milestone.milestone_id} className="flex items-start space-x-4">
                    <div className="flex-shrink-0">
                      {milestone.status === 'completed' ? (
                        <CheckCircle className="w-6 h-6 text-green-500" />
                      ) : milestone.status === 'in_progress' ? (
                        <Clock className="w-6 h-6 text-yellow-500" />
                      ) : (
                        <Circle className="w-6 h-6 text-gray-300" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{milestone.title}</h4>
                      {milestone.description && (
                        <p className="text-sm text-gray-600 mt-1">{milestone.description}</p>
                      )}
                      <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                        <span>Target: {new Date(milestone.target_date).toLocaleDateString()}</span>
                        {milestone.completion_date && (
                          <span>Completed: {new Date(milestone.completion_date).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-gray-500">
              No milestones defined for this goal
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Circle({ className }: { className: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <circle cx="12" cy="12" r="10" strokeWidth="2" />
    </svg>
  )
}