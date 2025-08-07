import { 
  MapPin, 
  Building, 
  DollarSign, 
  Clock, 
  Briefcase,
  ExternalLink,
  BookmarkPlus,
  ChevronRight
} from 'lucide-react'
import type { JobListing } from '@/services/jobSearchService'

interface JobListingCardProps {
  job: JobListing
  onApply: () => void
  onView: () => void
  expanded?: boolean
}

export default function JobListingCard({ job, onApply, onView, expanded }: JobListingCardProps) {
  const formatSalary = (min?: number, max?: number) => {
    if (!min && !max) return null
    if (min && max) return `$${(min / 1000).toFixed(0)}k - $${(max / 1000).toFixed(0)}k`
    if (min) return `From $${(min / 1000).toFixed(0)}k`
    if (max) return `Up to $${(max / 1000).toFixed(0)}k`
  }

  const formatDate = (date: string) => {
    const days = Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24))
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`
    return `${Math.floor(days / 30)} months ago`
  }

  const experienceLevelLabels = {
    entry: 'Entry Level',
    mid: 'Mid Level',
    senior: 'Senior Level',
    executive: 'Executive'
  }

  const jobTypeLabels = {
    'full-time': 'Full Time',
    'part-time': 'Part Time',
    contract: 'Contract',
    internship: 'Internship'
  }

  return (
    <div className={`border rounded-lg p-4 hover:shadow-lg transition-shadow ${expanded ? 'p-6' : ''}`}>
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 hover:text-blue-600 cursor-pointer" onClick={onView}>
            {job.job_title}
          </h3>
          <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <Building className="w-4 h-4" />
              {job.company_name}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {job.location}
              {job.is_remote && ' (Remote)'}
            </span>
          </div>
        </div>
        {job.match_score && (
          <div className="text-right">
            <div className="text-2xl font-bold text-green-600">{Math.round(job.match_score * 100)}%</div>
            <div className="text-xs text-gray-500">Match</div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
          {jobTypeLabels[job.job_type]}
        </span>
        <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
          {experienceLevelLabels[job.experience_level]}
        </span>
        {formatSalary(job.salary_min, job.salary_max) && (
          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full flex items-center gap-1">
            <DollarSign className="w-3 h-3" />
            {formatSalary(job.salary_min, job.salary_max)}
          </span>
        )}
        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {formatDate(job.posting_date)}
        </span>
      </div>

      {expanded && (
        <>
          <p className="text-gray-600 text-sm mb-3 line-clamp-3">
            {job.description}
          </p>

          {job.skills_required && job.skills_required.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-gray-700 mb-1">Required Skills:</p>
              <div className="flex flex-wrap gap-1">
                {job.skills_required.slice(0, 5).map((skill, index) => (
                  <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                    {skill}
                  </span>
                ))}
                {job.skills_required.length > 5 && (
                  <span className="px-2 py-1 text-gray-500 text-xs">
                    +{job.skills_required.length - 5} more
                  </span>
                )}
              </div>
            </div>
          )}
        </>
      )}

      <div className="flex gap-2 mt-4">
        <button
          onClick={onApply}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
        >
          <Briefcase className="w-4 h-4" />
          Apply
        </button>
        <button
          onClick={onView}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
        >
          View Details
          <ChevronRight className="w-4 h-4" />
        </button>
        {job.source_url && (
          <a
            href={job.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
        <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
          <BookmarkPlus className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}