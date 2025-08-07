import { X } from 'lucide-react'
import type { JobSearchParams } from '@/services/jobSearchService'

interface JobFiltersProps {
  params: JobSearchParams
  onUpdateFilters: (params: Partial<JobSearchParams>) => void
  onClose: () => void
}

export default function JobFilters({ params, onUpdateFilters, onClose }: JobFiltersProps) {
  return (
    <div className="mb-6 p-4 border rounded-lg bg-gray-50">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold">Filters</h3>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Location
          </label>
          <input
            type="text"
            placeholder="City, state, or remote"
            value={params.location || ''}
            onChange={(e) => onUpdateFilters({ location: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Experience Level */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Experience Level
          </label>
          <select
            value={params.experienceLevel || ''}
            onChange={(e) => onUpdateFilters({ experienceLevel: e.target.value as any })}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Levels</option>
            <option value="entry">Entry Level</option>
            <option value="mid">Mid Level</option>
            <option value="senior">Senior Level</option>
            <option value="executive">Executive</option>
          </select>
        </div>

        {/* Job Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Job Type
          </label>
          <select
            value={params.jobType || ''}
            onChange={(e) => onUpdateFilters({ jobType: e.target.value as any })}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Types</option>
            <option value="full-time">Full Time</option>
            <option value="part-time">Part Time</option>
            <option value="contract">Contract</option>
            <option value="internship">Internship</option>
          </select>
        </div>

        {/* Remote Only */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Work Setting
          </label>
          <div className="flex items-center gap-2 mt-2">
            <input
              type="checkbox"
              id="remoteOnly"
              checked={params.remoteOnly || false}
              onChange={(e) => onUpdateFilters({ remoteOnly: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="remoteOnly" className="text-sm text-gray-700">
              Remote Only
            </label>
          </div>
        </div>

        {/* Salary Range */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Salary Range
          </label>
          <div className="flex gap-2 items-center">
            <input
              type="number"
              placeholder="Min"
              value={params.salaryMin || ''}
              onChange={(e) => onUpdateFilters({ salaryMin: parseInt(e.target.value) || undefined })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-500">to</span>
            <input
              type="number"
              placeholder="Max"
              value={params.salaryMax || ''}
              onChange={(e) => onUpdateFilters({ salaryMax: parseInt(e.target.value) || undefined })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Skills */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Skills (comma-separated)
          </label>
          <input
            type="text"
            placeholder="e.g., Python, React, AWS"
            value={params.skills || ''}
            onChange={(e) => onUpdateFilters({ skills: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Companies */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Companies (comma-separated)
          </label>
          <input
            type="text"
            placeholder="e.g., Google, Microsoft, Apple"
            value={params.companies || ''}
            onChange={(e) => onUpdateFilters({ companies: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Industries */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Industries (comma-separated)
          </label>
          <input
            type="text"
            placeholder="e.g., Technology, Finance, Healthcare"
            value={params.industries || ''}
            onChange={(e) => onUpdateFilters({ industries: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={() => {
            onUpdateFilters({
              location: '',
              remoteOnly: false,
              experienceLevel: undefined,
              jobType: undefined,
              salaryMin: undefined,
              salaryMax: undefined,
              skills: '',
              companies: '',
              industries: ''
            })
          }}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Clear Filters
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Apply Filters
        </button>
      </div>
    </div>
  )
}