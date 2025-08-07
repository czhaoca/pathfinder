import { BarChart3, TrendingUp, Users, Activity } from 'lucide-react'
import type { NetworkingInsights, ContactAnalytics } from '@/services/networkingService'

interface Props {
  insights: NetworkingInsights | null
  analytics: ContactAnalytics | null
  onRefresh: () => void
}

export default function NetworkInsights({ insights, analytics, onRefresh }: Props) {
  if (!insights || !analytics) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="text-center py-12">
          <BarChart3 className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-semibold mb-2">Loading Insights...</h3>
          <button
            onClick={onRefresh}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Load Insights
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Network Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-gray-700">Network Size</h4>
            <Users className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{insights.network_size}</p>
          <p className="text-sm text-gray-600 mt-1">Total connections</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-gray-700">Diversity Score</h4>
            <Activity className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {(insights.network_diversity_score * 100).toFixed(0)}%
          </p>
          <p className="text-sm text-gray-600 mt-1">Network variety</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-gray-700">Avg Interactions</h4>
            <TrendingUp className="w-5 h-5 text-purple-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {insights.interaction_frequency.weekly_average.toFixed(1)}
          </p>
          <p className="text-sm text-gray-600 mt-1">Per week</p>
        </div>
      </div>

      {/* Relationship Health */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold mb-4">Relationship Health</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Strong</span>
            <div className="flex items-center gap-2">
              <div className="w-48 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full"
                  style={{ width: `${(insights.relationship_health.strong / insights.network_size) * 100}%` }}
                />
              </div>
              <span className="text-sm font-medium">{insights.relationship_health.strong}</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Moderate</span>
            <div className="flex items-center gap-2">
              <div className="w-48 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-yellow-500 h-2 rounded-full"
                  style={{ width: `${(insights.relationship_health.moderate / insights.network_size) * 100}%` }}
                />
              </div>
              <span className="text-sm font-medium">{insights.relationship_health.moderate}</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Weak</span>
            <div className="flex items-center gap-2">
              <div className="w-48 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-orange-500 h-2 rounded-full"
                  style={{ width: `${(insights.relationship_health.weak / insights.network_size) * 100}%` }}
                />
              </div>
              <span className="text-sm font-medium">{insights.relationship_health.weak}</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Dormant</span>
            <div className="flex items-center gap-2">
              <div className="w-48 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-red-500 h-2 rounded-full"
                  style={{ width: `${(insights.relationship_health.dormant / insights.network_size) * 100}%` }}
                />
              </div>
              <span className="text-sm font-medium">{insights.relationship_health.dormant}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Network Growth */}
      {analytics.network_growth && analytics.network_growth.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4">Network Growth</h3>
          <div className="space-y-2">
            {analytics.network_growth.map((growth, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{growth.month}</span>
                <span className="font-medium">+{growth.contacts_added} contacts</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Growth Opportunities */}
      {insights.growth_opportunities && insights.growth_opportunities.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4">Growth Opportunities</h3>
          <ul className="space-y-2">
            {insights.growth_opportunities.map((opportunity, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <TrendingUp className="w-4 h-4 text-green-500 mt-0.5" />
                <span className="text-sm text-gray-700">{opportunity}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}