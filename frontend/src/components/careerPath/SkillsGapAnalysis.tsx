import { useState } from 'react'
import { 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  ArrowUpRight,
  Target
} from 'lucide-react'
import type { SkillsGap, SkillAssessment } from '@/services/careerPathService'
import careerPathService from '@/services/careerPathService'
import { toast } from 'sonner'

interface Props {
  skillsGap: SkillsGap | null
  onRefresh: () => void
}

export default function SkillsGapAnalysis({ skillsGap, onRefresh }: Props) {
  const [assessmentMode, setAssessmentMode] = useState(false)
  const [skillAssessments, setSkillAssessments] = useState<Record<string, number>>({})
  const [submitting, setSubmitting] = useState(false)

  if (!skillsGap) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="text-center py-12">
          <TrendingUp className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-semibold mb-2">No Skills Gap Analysis Available</h3>
          <p className="text-gray-600">
            Select a career goal to see your skills gap analysis
          </p>
        </div>
      </div>
    )
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-600 bg-red-50'
      case 'medium':
        return 'text-yellow-600 bg-yellow-50'
      case 'low':
        return 'text-green-600 bg-green-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  const getSkillLevelLabel = (level: number) => {
    const labels = ['Beginner', 'Novice', 'Intermediate', 'Advanced', 'Expert']
    return labels[level - 1] || 'Unknown'
  }

  const getProgressPercentage = (current: number, target: number) => {
    return Math.min(100, Math.round((current / target) * 100))
  }

  const handleSelfAssessment = async () => {
    if (Object.keys(skillAssessments).length === 0) {
      toast.error('Please assess at least one skill')
      return
    }

    setSubmitting(true)
    try {
      const skills: SkillAssessment[] = Object.entries(skillAssessments).map(([skillId, level]) => {
        const targetSkill = skillsGap.targetSkills.find(s => s.skill_id === skillId)
        return {
          skill_id: skillId,
          skill_name: targetSkill?.skill_name || '',
          current_level: level,
          target_level: targetSkill?.target_level
        }
      })

      // Assuming we have a goal ID - in real app this would come from context
      await careerPathService.submitSkillsAssessment('current-goal-id', skills)
      
      toast.success('Skills assessment submitted successfully!')
      setAssessmentMode(false)
      onRefresh()
    } catch (error) {
      console.error('Error submitting assessment:', error)
      toast.error('Failed to submit skills assessment')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Skills to Develop</p>
              <p className="text-2xl font-bold text-gray-900">{skillsGap.gap.length}</p>
            </div>
            <Target className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">High Priority</p>
              <p className="text-2xl font-bold text-red-600">
                {skillsGap.gap.filter(g => g.priority === 'high').length}
              </p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ready Skills</p>
              <p className="text-2xl font-bold text-green-600">
                {skillsGap.currentSkills.filter(s => 
                  s.current_level >= (s.target_level || 3)
                ).length}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>
      </div>

      {/* Skills Gap Table */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Skills Gap Analysis</h3>
            <button
              onClick={() => setAssessmentMode(!assessmentMode)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              {assessmentMode ? 'Cancel Assessment' : 'Self-Assess Skills'}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Skill
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Current Level
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Target Level
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Gap
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Progress
                </th>
                {assessmentMode && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Self-Assessment
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {skillsGap.gap.map((gapItem) => {
                const currentSkill = skillsGap.currentSkills.find(
                  s => s.skill_id === gapItem.skill_id
                )
                const progress = getProgressPercentage(
                  gapItem.current_level,
                  gapItem.target_level
                )

                return (
                  <tr key={gapItem.skill_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {gapItem.skill_name}
                      </div>
                      {currentSkill?.category && (
                        <div className="text-xs text-gray-500">{currentSkill.category}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="text-sm text-gray-900">
                          {getSkillLevelLabel(gapItem.current_level)}
                        </span>
                        <span className="ml-2 text-xs text-gray-500">
                          ({gapItem.current_level}/5)
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="text-sm text-gray-900">
                          {getSkillLevelLabel(gapItem.target_level)}
                        </span>
                        <span className="ml-2 text-xs text-gray-500">
                          ({gapItem.target_level}/5)
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <ArrowUpRight className="w-4 h-4 text-gray-400 mr-1" />
                        <span className="text-sm font-medium text-gray-900">
                          +{gapItem.gap_size} levels
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(gapItem.priority)}`}>
                        {gapItem.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-1 mr-3">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-xs text-gray-600">{progress}%</span>
                      </div>
                    </td>
                    {assessmentMode && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={skillAssessments[gapItem.skill_id] || gapItem.current_level}
                          onChange={(e) => setSkillAssessments({
                            ...skillAssessments,
                            [gapItem.skill_id]: parseInt(e.target.value)
                          })}
                          className="text-sm border border-gray-300 rounded-md px-2 py-1"
                        >
                          <option value="1">Beginner (1)</option>
                          <option value="2">Novice (2)</option>
                          <option value="3">Intermediate (3)</option>
                          <option value="4">Advanced (4)</option>
                          <option value="5">Expert (5)</option>
                        </select>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {assessmentMode && (
          <div className="p-4 bg-gray-50 border-t border-gray-200">
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setAssessmentMode(false)
                  setSkillAssessments({})
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSelfAssessment}
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Assessment'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Skills by Category */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold mb-4">Skills by Category</h3>
        <div className="space-y-4">
          {Object.entries(
            skillsGap.gap.reduce((acc, skill) => {
              const category = skillsGap.currentSkills.find(
                s => s.skill_id === skill.skill_id
              )?.category || 'Other'
              
              if (!acc[category]) acc[category] = []
              acc[category].push(skill)
              return acc
            }, {} as Record<string, typeof skillsGap.gap>)
          ).map(([category, skills]) => (
            <div key={category}>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-700">{category}</h4>
                <span className="text-xs text-gray-500">{skills.length} skills</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {skills.map(skill => (
                  <span
                    key={skill.skill_id}
                    className={`inline-flex px-2 py-1 text-xs rounded-md ${
                      skill.priority === 'high'
                        ? 'bg-red-100 text-red-700'
                        : skill.priority === 'medium'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {skill.skill_name} (+{skill.gap_size})
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}