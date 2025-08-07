import { TrendingUp, Users, Clock, MessageSquare, X } from 'lucide-react'
import type { NetworkingRecommendation } from '@/services/networkingService'

interface Props {
  recommendations: NetworkingRecommendation[]
  onDismiss: (id: string) => void
  onAction: (recommendation: NetworkingRecommendation) => void
}

export default function NetworkingRecommendations({ recommendations, onDismiss, onAction }: Props) {
  const getIcon = (type: string) => {
    switch (type) {
      case 'reconnect':
        return <Clock className="w-5 h-5" />
      case 'introduce':
        return <Users className="w-5 h-5" />
      case 'follow_up':
        return <MessageSquare className="w-5 h-5" />
      default:
        return <TrendingUp className="w-5 h-5" />
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'border-red-200 bg-red-50'
      case 'medium':
        return 'border-yellow-200 bg-yellow-50'
      default:
        return 'border-gray-200 bg-gray-50'
    }
  }

  if (recommendations.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="text-center py-12">
          <TrendingUp className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-semibold mb-2">No Recommendations</h3>
          <p className="text-gray-600">Check back later for networking suggestions</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {recommendations.map((rec) => (
        <div
          key={rec.recommendation_id}
          className={`bg-white rounded-lg shadow-sm border-2 p-6 ${getPriorityColor(rec.priority)}`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="text-gray-600">{getIcon(rec.type)}</div>
              <div>
                <h4 className="font-semibold text-gray-900 capitalize">
                  {rec.type.replace('_', ' ')} Recommendation
                </h4>
                <p className="text-gray-700 mt-1">{rec.reason}</p>
                <p className="text-sm text-gray-600 mt-2">{rec.action_suggested}</p>
                <button
                  onClick={() => onAction(rec)}
                  className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  Take Action
                </button>
              </div>
            </div>
            <button
              onClick={() => onDismiss(rec.recommendation_id)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}