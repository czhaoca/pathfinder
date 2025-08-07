import { 
  TrendingUp, 
  Clock, 
  Award, 
  BookOpen,
  Zap,
  BarChart,
  Users,
  Target
} from 'lucide-react'
import type { LearningAnalytics } from '@/services/learningService'

interface LearningStatsProps {
  analytics: LearningAnalytics
}

export default function LearningStats({ analytics }: LearningStatsProps) {
  const getSkillLevelColor = (level: string) => {
    switch (level) {
      case 'expert': return 'text-purple-600'
      case 'proficient': return 'text-blue-600'
      case 'competent': return 'text-green-600'
      default: return 'text-gray-600'
    }
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-8 h-8 text-blue-600" />
            <span className="text-2xl font-bold">{analytics.total_learning_hours.toFixed(0)}</span>
          </div>
          <p className="text-sm text-gray-600">Total Learning Hours</p>
        </div>

        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center justify-between mb-2">
            <BookOpen className="w-8 h-8 text-green-600" />
            <span className="text-2xl font-bold">{analytics.courses_completed}</span>
          </div>
          <p className="text-sm text-gray-600">Courses Completed</p>
        </div>

        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center justify-between mb-2">
            <Award className="w-8 h-8 text-purple-600" />
            <span className="text-2xl font-bold">{analytics.certifications_earned}</span>
          </div>
          <p className="text-sm text-gray-600">Certifications Earned</p>
        </div>

        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center justify-between mb-2">
            <Target className="w-8 h-8 text-orange-600" />
            <span className="text-2xl font-bold">{analytics.skills_developed}</span>
          </div>
          <p className="text-sm text-gray-600">Skills Developed</p>
        </div>
      </div>

      {/* Learning Streaks */}
      <div className="bg-white p-6 rounded-lg border">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-500" />
          Learning Streaks
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600 mb-1">Current Streak</p>
            <p className="text-3xl font-bold text-orange-600">
              {analytics.current_streak_days} days
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Longest Streak</p>
            <p className="text-3xl font-bold text-purple-600">
              {analytics.longest_streak_days} days
            </p>
          </div>
        </div>
      </div>

      {/* Learning Velocity */}
      <div className="bg-white p-6 rounded-lg border">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          Learning Velocity
        </h3>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-gray-600">Last 7 days</span>
              <span className="font-semibold">{analytics.learning_velocity.last_7_days.toFixed(1)} hrs</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full" 
                style={{ width: `${Math.min(100, (analytics.learning_velocity.last_7_days / 20) * 100)}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-gray-600">Last 30 days</span>
              <span className="font-semibold">{analytics.learning_velocity.last_30_days.toFixed(1)} hrs</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-600 h-2 rounded-full" 
                style={{ width: `${Math.min(100, (analytics.learning_velocity.last_30_days / 80) * 100)}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-gray-600">Last 90 days</span>
              <span className="font-semibold">{analytics.learning_velocity.last_90_days.toFixed(1)} hrs</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-purple-600 h-2 rounded-full" 
                style={{ width: `${Math.min(100, (analytics.learning_velocity.last_90_days / 240) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Skill Progression */}
      <div className="bg-white p-6 rounded-lg border">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <BarChart className="w-5 h-5 text-green-600" />
          Skill Progression
        </h3>
        <div className="space-y-3">
          {analytics.skill_progression.slice(0, 5).map((skill) => (
            <div key={skill.skill_id} className="border-b pb-3 last:border-0">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-medium">{skill.skill_name}</p>
                  <p className={`text-sm ${getSkillLevelColor(skill.current_level)}`}>
                    {skill.current_level}
                  </p>
                </div>
                <span className="text-sm text-gray-600">
                  {skill.hours_invested.toFixed(1)} hrs
                </span>
              </div>
              <div>
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>Progress to next level</span>
                  <span>{skill.progress_to_next}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-purple-500 h-1.5 rounded-full" 
                    style={{ width: `${skill.progress_to_next}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Providers */}
      <div className="bg-white p-6 rounded-lg border">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-600" />
          Top Learning Providers
        </h3>
        <div className="space-y-2">
          {analytics.top_providers.map((provider, index) => (
            <div key={provider.provider} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-semibold">
                  {index + 1}
                </span>
                <span className="font-medium">{provider.provider}</span>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">{provider.courses_taken} courses</p>
                <p className="text-xs text-gray-600">{provider.hours_spent.toFixed(1)} hours</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Monthly Activity */}
      <div className="bg-white p-6 rounded-lg border">
        <h3 className="font-semibold mb-4">Monthly Learning Activity</h3>
        <div className="space-y-2">
          {analytics.monthly_activity.slice(-6).map((month) => (
            <div key={month.month} className="flex items-center gap-4">
              <span className="text-sm text-gray-600 w-20">{month.month}</span>
              <div className="flex-1 bg-gray-200 rounded-full h-4">
                <div 
                  className="bg-blue-600 h-4 rounded-full" 
                  style={{ 
                    width: `${(month.hours / Math.max(...analytics.monthly_activity.map(m => m.hours))) * 100}%` 
                  }}
                />
              </div>
              <div className="text-right text-sm">
                <span className="font-semibold">{month.hours.toFixed(0)} hrs</span>
                <span className="text-gray-600 ml-2">
                  ({month.courses_completed} completed)
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}