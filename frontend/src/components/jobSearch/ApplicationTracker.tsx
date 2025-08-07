import { useState } from 'react'
import { 
  Calendar, 
  Building, 
  ChevronRight, 
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Star,
  FileText,
  Phone
} from 'lucide-react'
import type { JobApplication } from '@/services/jobSearchService'

interface ApplicationTrackerProps {
  applications: JobApplication[]
  onUpdateApplication: (id: string, updates: Partial<JobApplication>) => void
}

export default function ApplicationTracker({ applications, onUpdateApplication }: ApplicationTrackerProps) {
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'date' | 'status' | 'company'>('date')

  const statusColors = {
    interested: 'bg-gray-100 text-gray-700',
    applied: 'bg-blue-100 text-blue-700',
    screening: 'bg-purple-100 text-purple-700',
    interviewing: 'bg-yellow-100 text-yellow-700',
    offer: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    withdrawn: 'bg-gray-100 text-gray-500'
  }

  const statusIcons = {
    interested: <Star className="w-4 h-4" />,
    applied: <FileText className="w-4 h-4" />,
    screening: <AlertCircle className="w-4 h-4" />,
    interviewing: <Phone className="w-4 h-4" />,
    offer: <CheckCircle className="w-4 h-4" />,
    rejected: <XCircle className="w-4 h-4" />,
    withdrawn: <XCircle className="w-4 h-4" />
  }

  const filteredApplications = applications
    .filter(app => filterStatus === 'all' || app.status === filterStatus)
    .sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(b.application_date || b.last_activity_date || '').getTime() - 
               new Date(a.application_date || a.last_activity_date || '').getTime()
      }
      if (sortBy === 'status') {
        return a.status.localeCompare(b.status)
      }
      if (sortBy === 'company') {
        return a.company_name.localeCompare(b.company_name)
      }
      return 0
    })

  const statusCounts = applications.reduce((acc, app) => {
    acc[app.status] = (acc[app.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div>
      {/* Status Filter Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        <button
          onClick={() => setFilterStatus('all')}
          className={`px-4 py-2 rounded-lg whitespace-nowrap ${
            filterStatus === 'all' 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All ({applications.length})
        </button>
        {Object.entries(statusCounts).map(([status, count]) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-4 py-2 rounded-lg whitespace-nowrap flex items-center gap-2 ${
              filterStatus === status 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {statusIcons[status as keyof typeof statusIcons]}
            {status.charAt(0).toUpperCase() + status.slice(1)} ({count})
          </button>
        ))}
      </div>

      {/* Sort Options */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold">{filteredApplications.length} Applications</h3>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="px-3 py-2 border rounded-lg"
        >
          <option value="date">Sort by Date</option>
          <option value="status">Sort by Status</option>
          <option value="company">Sort by Company</option>
        </select>
      </div>

      {/* Applications List */}
      {filteredApplications.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No applications found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredApplications.map((application) => (
            <div key={application.id} className="border rounded-lg p-4 hover:shadow-lg transition-shadow">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h4 className="font-semibold text-lg">{application.job_title}</h4>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <Building className="w-4 h-4" />
                      {application.company_name}
                    </span>
                    {application.application_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        Applied {new Date(application.application_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Status Badge */}
                <div className="flex flex-col items-end gap-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 ${
                    statusColors[application.status as keyof typeof statusColors]
                  }`}>
                    {statusIcons[application.status as keyof typeof statusIcons]}
                    {application.status.charAt(0).toUpperCase() + application.status.slice(1)}
                  </span>
                  {application.excitement_level && (
                    <div className="flex gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-4 h-4 ${
                            i < application.excitement_level! 
                              ? 'text-yellow-500 fill-current' 
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Application Notes */}
              {application.application_notes && (
                <div className="mt-3 p-3 bg-gray-50 rounded text-sm text-gray-600">
                  {application.application_notes}
                </div>
              )}

              {/* Next Steps */}
              {application.next_step && (
                <div className="mt-3 p-3 bg-blue-50 rounded">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-900">Next Step:</p>
                      <p className="text-sm text-blue-700">{application.next_step}</p>
                    </div>
                    {application.next_step_date && (
                      <div className="text-right">
                        <p className="text-xs text-blue-600">Due:</p>
                        <p className="text-sm font-medium text-blue-900">
                          {new Date(application.next_step_date).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div className="mt-4 flex gap-2">
                <select
                  value={application.status}
                  onChange={(e) => onUpdateApplication(application.id, { status: e.target.value as any })}
                  className="px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="interested">Interested</option>
                  <option value="applied">Applied</option>
                  <option value="screening">Screening</option>
                  <option value="interviewing">Interviewing</option>
                  <option value="offer">Offer</option>
                  <option value="rejected">Rejected</option>
                  <option value="withdrawn">Withdrawn</option>
                </select>
                
                <button className="px-3 py-2 border rounded-lg hover:bg-gray-50 text-sm">
                  Add Note
                </button>
                
                <button className="px-3 py-2 border rounded-lg hover:bg-gray-50 text-sm">
                  Timeline
                </button>
                
                <button className="px-3 py-2 border rounded-lg hover:bg-gray-50 text-sm flex items-center gap-1">
                  View Details
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}