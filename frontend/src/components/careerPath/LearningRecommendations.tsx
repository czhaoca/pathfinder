import { useState, useEffect } from 'react'
import { 
  BookOpen, 
  Video, 
  Award, 
  Clock, 
  DollarSign, 
  Star,
  ExternalLink,
  ChevronDown,
  CheckCircle,
  PlayCircle
} from 'lucide-react'
import type { SkillsGap, LearningRecommendation } from '@/services/careerPathService'
import careerPathService from '@/services/careerPathService'
import { toast } from 'sonner'

interface Props {
  skillsGap: SkillsGap | null
  userId?: string
}

export default function LearningRecommendations({ skillsGap, userId }: Props) {
  const [recommendations, setRecommendations] = useState<LearningRecommendation[]>([])
  const [selectedSkill, setSelectedSkill] = useState<string>('')
  const [filters, setFilters] = useState({
    resourceType: '',
    difficultyLevel: '',
    maxCost: 0,
    freeOnly: false
  })
  const [loading, setLoading] = useState(false)
  const [expandedRecommendation, setExpandedRecommendation] = useState<string | null>(null)

  useEffect(() => {
    if (skillsGap && skillsGap.gap.length > 0) {
      // Load recommendations for the highest priority skill by default
      const highPrioritySkill = skillsGap.gap.find(g => g.priority === 'high') || skillsGap.gap[0]
      setSelectedSkill(highPrioritySkill.skill_id)
      loadRecommendations(highPrioritySkill.skill_id)
    }
  }, [skillsGap])

  const loadRecommendations = async (skillId: string) => {
    setLoading(true)
    try {
      const recs = await careerPathService.getLearningRecommendations(skillId, {
        maxCost: filters.maxCost || undefined,
        difficultyLevel: filters.difficultyLevel as 'beginner' | 'intermediate' | 'advanced' | undefined,
        resourceType: filters.resourceType as 'course' | 'book' | 'tutorial' | 'certification' | 'workshop' | 'webinar' | undefined,
        freeOnly: filters.freeOnly
      })
      setRecommendations(recs)
    } catch (error) {
      console.error('Error loading recommendations:', error)
      toast.error('Failed to load learning recommendations')
    } finally {
      setLoading(false)
    }
  }

  const handleStartLearning = async (recommendation: LearningRecommendation) => {
    if (!userId) {
      toast.error('Please log in to track your learning progress')
      return
    }

    try {
      await careerPathService.logLearningProgress({
        resourceId: recommendation.resource_id,
        skillId: recommendation.skill_id,
        activityType: 'started',
        notes: `Started learning: ${recommendation.title}`
      })
      toast.success('Learning activity tracked!')
    } catch (error) {
      console.error('Error logging learning progress:', error)
      toast.error('Failed to track learning progress')
    }
  }

  const getResourceIcon = (type: string) => {
    switch (type) {
      case 'course':
        return <Video className="w-5 h-5" />
      case 'book':
        return <BookOpen className="w-5 h-5" />
      case 'certification':
        return <Award className="w-5 h-5" />
      case 'tutorial':
        return <PlayCircle className="w-5 h-5" />
      default:
        return <BookOpen className="w-5 h-5" />
    }
  }

  const getDifficultyColor = (level: string) => {
    switch (level) {
      case 'beginner':
        return 'text-green-600 bg-green-50'
      case 'intermediate':
        return 'text-yellow-600 bg-yellow-50'
      case 'advanced':
        return 'text-red-600 bg-red-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  if (!skillsGap || skillsGap.gap.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="text-center py-12">
          <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-semibold mb-2">No Learning Recommendations</h3>
          <p className="text-gray-600">
            Complete a skills gap analysis to see personalized learning recommendations
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Learning Recommendations</h3>
          <button
            onClick={() => loadRecommendations(selectedSkill)}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <select
            value={selectedSkill}
            onChange={(e) => {
              setSelectedSkill(e.target.value)
              loadRecommendations(e.target.value)
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select Skill</option>
            {skillsGap.gap.map(skill => (
              <option key={skill.skill_id} value={skill.skill_id}>
                {skill.skill_name} ({skill.priority})
              </option>
            ))}
          </select>

          <select
            value={filters.resourceType}
            onChange={(e) => setFilters({ ...filters, resourceType: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Types</option>
            <option value="course">Courses</option>
            <option value="book">Books</option>
            <option value="tutorial">Tutorials</option>
            <option value="certification">Certifications</option>
            <option value="workshop">Workshops</option>
            <option value="webinar">Webinars</option>
          </select>

          <select
            value={filters.difficultyLevel}
            onChange={(e) => setFilters({ ...filters, difficultyLevel: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Levels</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>

          <input
            type="number"
            placeholder="Max Cost ($)"
            value={filters.maxCost || ''}
            onChange={(e) => setFilters({ ...filters, maxCost: parseInt(e.target.value) || 0 })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />

          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.freeOnly}
              onChange={(e) => setFilters({ ...filters, freeOnly: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Free Only</span>
          </label>
        </div>

        <button
          onClick={() => loadRecommendations(selectedSkill)}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Apply Filters
        </button>
      </div>

      {/* Recommendations List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {recommendations.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-6 text-center">
              <p className="text-gray-600">No recommendations found for the selected filters</p>
            </div>
          ) : (
            recommendations.map((rec) => (
              <div
                key={rec.resource_id}
                className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <div className="text-blue-600">
                          {getResourceIcon(rec.resource_type)}
                        </div>
                        <h4 className="text-lg font-semibold text-gray-900">{rec.title}</h4>
                      </div>

                      <div className="flex items-center space-x-4 mb-3">
                        <span className="text-sm text-gray-600">{rec.provider}</span>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getDifficultyColor(rec.difficulty_level)}`}>
                          {rec.difficulty_level}
                        </span>
                        {rec.duration_hours && (
                          <span className="flex items-center text-sm text-gray-600">
                            <Clock className="w-4 h-4 mr-1" />
                            {rec.duration_hours} hours
                          </span>
                        )}
                        {rec.cost !== undefined && (
                          <span className="flex items-center text-sm text-gray-600">
                            <DollarSign className="w-4 h-4 mr-1" />
                            {rec.cost === 0 ? 'Free' : `$${rec.cost}`}
                          </span>
                        )}
                      </div>

                      {rec.rating && (
                        <div className="flex items-center space-x-2 mb-3">
                          <div className="flex items-center">
                            <Star className="w-4 h-4 text-yellow-400 fill-current" />
                            <span className="ml-1 text-sm font-medium">{rec.rating.toFixed(1)}</span>
                          </div>
                          {rec.reviews_count && (
                            <span className="text-sm text-gray-500">
                              ({rec.reviews_count} reviews)
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => handleStartLearning(rec)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                        >
                          Start Learning
                        </button>
                        {rec.url && (
                          <a
                            href={rec.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm"
                          >
                            View Resource
                            <ExternalLink className="w-4 h-4 ml-2" />
                          </a>
                        )}
                        <button
                          onClick={() => setExpandedRecommendation(
                            expandedRecommendation === rec.resource_id ? null : rec.resource_id
                          )}
                          className="p-2 text-gray-400 hover:text-gray-600"
                        >
                          <ChevronDown
                            className={`w-5 h-5 transform transition-transform ${
                              expandedRecommendation === rec.resource_id ? 'rotate-180' : ''
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>

                  {expandedRecommendation === rec.resource_id && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h5 className="text-sm font-semibold text-gray-700 mb-2">
                            What you'll learn
                          </h5>
                          <ul className="space-y-1">
                            <li className="flex items-start">
                              <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                              <span className="text-sm text-gray-600">
                                Core concepts and fundamentals
                              </span>
                            </li>
                            <li className="flex items-start">
                              <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                              <span className="text-sm text-gray-600">
                                Practical applications and examples
                              </span>
                            </li>
                            <li className="flex items-start">
                              <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                              <span className="text-sm text-gray-600">
                                Industry best practices
                              </span>
                            </li>
                          </ul>
                        </div>
                        <div>
                          <h5 className="text-sm font-semibold text-gray-700 mb-2">
                            Prerequisites
                          </h5>
                          <p className="text-sm text-gray-600">
                            {rec.difficulty_level === 'beginner'
                              ? 'No prior experience required'
                              : rec.difficulty_level === 'intermediate'
                              ? 'Basic understanding of the topic recommended'
                              : 'Strong foundation in the subject area required'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Learning Plan Summary */}
      {recommendations.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4">Learning Plan Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Resources</p>
              <p className="text-2xl font-bold text-gray-900">{recommendations.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Estimated Time</p>
              <p className="text-2xl font-bold text-gray-900">
                {recommendations.reduce((sum, r) => sum + (r.duration_hours || 0), 0)} hours
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Cost</p>
              <p className="text-2xl font-bold text-gray-900">
                ${recommendations.reduce((sum, r) => sum + (r.cost || 0), 0)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}