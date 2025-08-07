import { 
  TrendingUp, 
  Users, 
  Calendar, 
  Target,
  Award,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react'
import type { ApplicationStats } from '@/services/jobSearchService'

interface JobSearchStatsProps {
  stats: ApplicationStats
}

export default function JobSearchStats({ stats }: JobSearchStatsProps) {
  const statusLabels: Record<string, string> = {
    interested: 'Interested',
    applied: 'Applied',
    screening: 'Screening',
    interviewing: 'Interviewing',
    offer: 'Offer',
    rejected: 'Rejected',
    withdrawn: 'Withdrawn'
  }

  const statusColors: Record<string, string> = {
    interested: 'bg-gray-500',
    applied: 'bg-blue-500',
    screening: 'bg-purple-500',
    interviewing: 'bg-yellow-500',
    offer: 'bg-green-500',
    rejected: 'bg-red-500',
    withdrawn: 'bg-gray-400'
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-8 h-8 text-blue-600" />
            <span className="text-2xl font-bold">{stats.total_applications}</span>
          </div>
          <p className="text-sm text-gray-600">Total Applications</p>
        </div>

        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center justify-between mb-2">
            <Target className="w-8 h-8 text-green-600" />
            <span className="text-2xl font-bold">{stats.active_applications}</span>
          </div>
          <p className="text-sm text-gray-600">Active Applications</p>
        </div>

        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center justify-between mb-2">
            <Calendar className="w-8 h-8 text-purple-600" />
            <span className="text-2xl font-bold">{stats.interviews_scheduled}</span>
          </div>
          <p className="text-sm text-gray-600">Interviews Scheduled</p>
        </div>

        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center justify-between mb-2">
            <Award className="w-8 h-8 text-yellow-600" />
            <span className="text-2xl font-bold">{stats.offers_received}</span>
          </div>
          <p className="text-sm text-gray-600">Offers Received</p>
        </div>
      </div>

      {/* Conversion Rates */}
      <div className="bg-white p-6 rounded-lg border">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Conversion Rates
        </h3>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-gray-600">Applied → Interview</span>
              <span className="font-semibold">
                {(stats.conversion_rates.applied_to_interview * 100).toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full" 
                style={{ width: `${stats.conversion_rates.applied_to_interview * 100}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-gray-600">Interview → Offer</span>
              <span className="font-semibold">
                {(stats.conversion_rates.interview_to_offer * 100).toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-600 h-2 rounded-full" 
                style={{ width: `${stats.conversion_rates.interview_to_offer * 100}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-gray-600">Offer Acceptance</span>
              <span className="font-semibold">
                {(stats.conversion_rates.offer_acceptance * 100).toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-purple-600 h-2 rounded-full" 
                style={{ width: `${stats.conversion_rates.offer_acceptance * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Applications by Status */}
      <div className="bg-white p-6 rounded-lg border">
        <h3 className="font-semibold mb-4">Applications by Status</h3>
        <div className="space-y-2">
          {Object.entries(stats.by_status).map(([status, count]) => (
            <div key={status} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${statusColors[status]}`} />
                <span className="text-sm">{statusLabels[status]}</span>
              </div>
              <span className="font-semibold">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Applications Timeline */}
      <div className="bg-white p-6 rounded-lg border">
        <h3 className="font-semibold mb-4">Application Activity (Last 12 Months)</h3>
        <div className="space-y-2">
          {stats.by_month.map((month) => (
            <div key={month.month} className="flex items-center gap-4">
              <span className="text-sm text-gray-600 w-20">{month.month}</span>
              <div className="flex-1 bg-gray-200 rounded-full h-4">
                <div 
                  className="bg-blue-600 h-4 rounded-full" 
                  style={{ 
                    width: `${(month.count / Math.max(...stats.by_month.map(m => m.count))) * 100}%` 
                  }}
                />
              </div>
              <span className="text-sm font-semibold w-10 text-right">{month.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Response Time */}
      <div className="bg-white p-6 rounded-lg border">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold mb-2">Average Response Time</h3>
            <p className="text-sm text-gray-600">
              Time from application to first response
            </p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2">
              <Clock className="w-8 h-8 text-blue-600" />
              <span className="text-3xl font-bold">
                {stats.average_response_time}
              </span>
              <span className="text-lg text-gray-600">days</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}