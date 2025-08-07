import { useState } from 'react'
import { 
  Trophy, 
  Plus, 
  Calendar, 
  Target,
  CheckCircle,
  XCircle,
  Clock,
  Edit,
  Trash2
} from 'lucide-react'
import type { LearningGoal } from '@/services/learningService'

interface LearningGoalsProps {
  goals: LearningGoal[]
  onUpdateGoal: (goalId: string, updates: any) => void
  onCreateGoal: (data: any) => void
}

export default function LearningGoals({ goals, onUpdateGoal, onCreateGoal }: LearningGoalsProps) {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newGoal, setNewGoal] = useState({
    goalTitle: '',
    goalDescription: '',
    targetDate: '',
    goalType: 'skill_acquisition' as const,
    targetSkillLevel: 'competent' as const
  })

  const goalTypeIcons = {
    skill_acquisition: <Target className="w-5 h-5" />,
    certification: <Trophy className="w-5 h-5" />,
    course_completion: <CheckCircle className="w-5 h-5" />,
    project: <Clock className="w-5 h-5" />
  }

  const goalTypeColors = {
    skill_acquisition: 'bg-blue-100 text-blue-700',
    certification: 'bg-purple-100 text-purple-700',
    course_completion: 'bg-green-100 text-green-700',
    project: 'bg-orange-100 text-orange-700'
  }

  const statusColors = {
    active: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    missed: 'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-700'
  }

  const handleCreateGoal = () => {
    if (newGoal.goalTitle && newGoal.targetDate) {
      onCreateGoal(newGoal)
      setNewGoal({
        goalTitle: '',
        goalDescription: '',
        targetDate: '',
        goalType: 'skill_acquisition',
        targetSkillLevel: 'competent'
      })
      setShowCreateForm(false)
    }
  }

  const getDaysRemaining = (targetDate: string) => {
    const days = Math.floor((new Date(targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    if (days < 0) return { text: 'Overdue', color: 'text-red-600' }
    if (days === 0) return { text: 'Due today', color: 'text-yellow-600' }
    if (days === 1) return { text: 'Due tomorrow', color: 'text-yellow-600' }
    if (days <= 7) return { text: `${days} days left`, color: 'text-orange-600' }
    if (days <= 30) return { text: `${Math.floor(days / 7)} weeks left`, color: 'text-blue-600' }
    return { text: `${Math.floor(days / 30)} months left`, color: 'text-gray-600' }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold">Learning Goals</h3>
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Goal
        </button>
      </div>

      {/* Create Goal Form */}
      {showCreateForm && (
        <div className="mb-6 p-4 border rounded-lg bg-gray-50">
          <h4 className="font-semibold mb-4">Create New Learning Goal</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Goal Title
              </label>
              <input
                type="text"
                value={newGoal.goalTitle}
                onChange={(e) => setNewGoal({ ...newGoal, goalTitle: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Learn React Advanced Patterns"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (Optional)
              </label>
              <textarea
                value={newGoal.goalDescription}
                onChange={(e) => setNewGoal({ ...newGoal, goalDescription: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                placeholder="Additional details about your goal..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Goal Type
                </label>
                <select
                  value={newGoal.goalType}
                  onChange={(e) => setNewGoal({ ...newGoal, goalType: e.target.value as any })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="skill_acquisition">Skill Acquisition</option>
                  <option value="certification">Certification</option>
                  <option value="course_completion">Course Completion</option>
                  <option value="project">Project</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Date
                </label>
                <input
                  type="date"
                  value={newGoal.targetDate}
                  onChange={(e) => setNewGoal({ ...newGoal, targetDate: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {newGoal.goalType === 'skill_acquisition' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Skill Level
                </label>
                <select
                  value={newGoal.targetSkillLevel}
                  onChange={(e) => setNewGoal({ ...newGoal, targetSkillLevel: e.target.value as any })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="novice">Novice</option>
                  <option value="competent">Competent</option>
                  <option value="proficient">Proficient</option>
                  <option value="expert">Expert</option>
                </select>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleCreateGoal}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create Goal
              </button>
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Goals List */}
      {goals.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <Trophy className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-2">No learning goals yet</p>
          <p className="text-sm text-gray-500">
            Set goals to track your learning progress
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {goals.map((goal) => {
            const daysRemaining = goal.status === 'active' ? getDaysRemaining(goal.target_date) : null

            return (
              <div key={goal.id} className="border rounded-lg p-4 hover:shadow-lg transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${goalTypeColors[goal.goal_type]}`}>
                      {goalTypeIcons[goal.goal_type]}
                    </div>
                    <div>
                      <h4 className="font-semibold">{goal.goal_title}</h4>
                      {goal.goal_description && (
                        <p className="text-sm text-gray-600 mt-1">{goal.goal_description}</p>
                      )}
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    statusColors[goal.status]
                  }`}>
                    {goal.status}
                  </span>
                </div>

                <div className="mb-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Progress</span>
                    <span className="font-medium">{goal.progress_percentage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        goal.status === 'completed' ? 'bg-green-600' :
                        goal.status === 'missed' ? 'bg-red-600' :
                        goal.status === 'cancelled' ? 'bg-gray-400' :
                        'bg-blue-600'
                      }`}
                      style={{ width: `${goal.progress_percentage}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>Target: {new Date(goal.target_date).toLocaleDateString()}</span>
                    </div>
                    {daysRemaining && (
                      <span className={`font-medium ${daysRemaining.color}`}>
                        {daysRemaining.text}
                      </span>
                    )}
                  </div>

                  {goal.status === 'active' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const progress = Math.min(100, goal.progress_percentage + 10)
                          onUpdateGoal(goal.id, { 
                            progressPercentage: progress,
                            status: progress === 100 ? 'completed' : 'active'
                          })
                        }}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        +10%
                      </button>
                      <button
                        onClick={() => onUpdateGoal(goal.id, { status: 'completed' })}
                        className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        Complete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}