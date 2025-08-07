import { 
  Target, 
  Clock, 
  BarChart, 
  Users,
  Star,
  ChevronRight,
  CheckCircle
} from 'lucide-react'
import type { LearningPath, UserLearningPath } from '@/services/learningService'

interface LearningPathCardProps {
  path: LearningPath | UserLearningPath
  isUserPath?: boolean
  onEnroll?: () => void
}

export default function LearningPathCard({ path, isUserPath, onEnroll }: LearningPathCardProps) {
  const difficultyColors = {
    beginner: 'bg-green-100 text-green-700',
    intermediate: 'bg-yellow-100 text-yellow-700',
    advanced: 'bg-orange-100 text-orange-700',
    expert: 'bg-red-100 text-red-700'
  }

  const levelColors = {
    entry: 'bg-blue-100 text-blue-700',
    mid: 'bg-purple-100 text-purple-700',
    senior: 'bg-indigo-100 text-indigo-700',
    expert: 'bg-red-100 text-red-700'
  }

  const isUserLearningPath = (p: any): p is UserLearningPath => {
    return 'path_id' in p
  }

  if (isUserPath && isUserLearningPath(path)) {
    return (
      <div className="border rounded-lg p-6 hover:shadow-lg transition-shadow">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h4 className="font-semibold text-lg mb-2">{path.path_name}</h4>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span>Step {path.current_step || 1} of {path.total_steps}</span>
              <span>•</span>
              <span>{path.time_spent_hours.toFixed(1)} hours spent</span>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            path.status === 'completed' ? 'bg-green-100 text-green-700' :
            path.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
            path.status === 'enrolled' ? 'bg-gray-100 text-gray-700' :
            'bg-red-100 text-red-700'
          }`}>
            {path.status.replace('_', ' ')}
          </span>
        </div>

        <div className="mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span>Overall Progress</span>
            <span className="font-medium">{path.progress_percentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className="bg-blue-600 h-3 rounded-full relative"
              style={{ width: `${path.progress_percentage}%` }}
            >
              {path.progress_percentage > 0 && (
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                  <CheckCircle className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
          </div>
        </div>

        {path.target_completion_date && (
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
            <Clock className="w-4 h-4" />
            <span>Target completion: {new Date(path.target_completion_date).toLocaleDateString()}</span>
          </div>
        )}

        <div className="flex gap-2">
          <button className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2">
            Continue Learning
            <ChevronRight className="w-4 h-4" />
          </button>
          {path.status === 'completed' && path.user_rating === undefined && (
            <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              Rate
            </button>
          )}
        </div>
      </div>
    )
  }

  // Regular Learning Path Card
  const learningPath = path as LearningPath

  return (
    <div className="border rounded-lg p-6 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <Target className="w-8 h-8 text-purple-600" />
        <div className="flex gap-2">
          {learningPath.difficulty_level && (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              difficultyColors[learningPath.difficulty_level]
            }`}>
              {learningPath.difficulty_level}
            </span>
          )}
          {learningPath.target_level && (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              levelColors[learningPath.target_level]
            }`}>
              {learningPath.target_level}
            </span>
          )}
        </div>
      </div>

      <h4 className="font-semibold text-lg mb-2">{learningPath.path_name}</h4>
      
      {learningPath.target_role && (
        <p className="text-sm text-gray-600 mb-3">Target Role: {learningPath.target_role}</p>
      )}

      {learningPath.path_description && (
        <p className="text-sm text-gray-700 mb-4 line-clamp-2">{learningPath.path_description}</p>
      )}

      <div className="grid grid-cols-2 gap-4 mb-4">
        {learningPath.estimated_duration_weeks && (
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-gray-500" />
            <span>{learningPath.estimated_duration_weeks} weeks</span>
          </div>
        )}
        
        {learningPath.completion_count !== undefined && learningPath.completion_count > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <Users className="w-4 h-4 text-gray-500" />
            <span>{learningPath.completion_count} completed</span>
          </div>
        )}
        
        {learningPath.average_rating && (
          <div className="flex items-center gap-2 text-sm">
            <Star className="w-4 h-4 text-yellow-500 fill-current" />
            <span>{learningPath.average_rating.toFixed(1)}</span>
          </div>
        )}
        
        {learningPath.popularity_score && (
          <div className="flex items-center gap-2 text-sm">
            <BarChart className="w-4 h-4 text-green-500" />
            <span>Popularity: {(learningPath.popularity_score * 100).toFixed(0)}%</span>
          </div>
        )}
      </div>

      {learningPath.skills_gained && learningPath.skills_gained.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-700 mb-2">Skills You'll Gain:</p>
          <div className="flex flex-wrap gap-1">
            {learningPath.skills_gained.slice(0, 4).map((skill, index) => (
              <span key={index} className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded">
                {skill}
              </span>
            ))}
            {learningPath.skills_gained.length > 4 && (
              <span className="px-2 py-1 text-gray-500 text-xs">
                +{learningPath.skills_gained.length - 4} more
              </span>
            )}
          </div>
        </div>
      )}

      {learningPath.prerequisites && learningPath.prerequisites.length > 0 && (
        <div className="mb-4 p-3 bg-yellow-50 rounded">
          <p className="text-xs font-semibold text-yellow-900 mb-1">Prerequisites:</p>
          <p className="text-xs text-yellow-700">{learningPath.prerequisites.join(', ')}</p>
        </div>
      )}

      <div className="flex gap-2">
        {onEnroll && (
          <button
            onClick={onEnroll}
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center justify-center gap-2"
          >
            Start Path
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
        <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
          View Details
        </button>
      </div>
    </div>
  )
}