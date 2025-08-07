import { useState, useEffect } from 'react'
import { 
  Search, 
  Filter, 
  MapPin, 
  Briefcase, 
  DollarSign,
  Clock,
  Building,
  Star,
  BookmarkPlus,
  ExternalLink,
  TrendingUp,
  ChevronRight,
  Plus,
  Settings
} from 'lucide-react'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'
import jobSearchService from '@/services/jobSearchService'
import type { 
  JobListing, 
  JobSearchParams, 
  JobApplication,
  ApplicationStats,
  SavedSearch
} from '@/services/jobSearchService'
import { authStore } from '@/stores/authStore'
import JobListingCard from '@/components/jobSearch/JobListingCard'
import JobFilters from '@/components/jobSearch/JobFilters'
import ApplicationTracker from '@/components/jobSearch/ApplicationTracker'
import JobSearchStats from '@/components/jobSearch/JobSearchStats'

export default function JobSearch() {
  const { user } = authStore()
  const [activeTab, setActiveTab] = useState<'search' | 'applications' | 'saved' | 'stats'>('search')
  const [searchParams, setSearchParams] = useState<JobSearchParams>({
    q: '',
    sortBy: 'posting_date',
    sortOrder: 'DESC',
    limit: 20,
    offset: 0
  })
  const [jobListings, setJobListings] = useState<JobListing[]>([])
  const [recommendedJobs, setRecommendedJobs] = useState<JobListing[]>([])
  const [applications, setApplications] = useState<JobApplication[]>([])
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([])
  const [applicationStats, setApplicationStats] = useState<ApplicationStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [selectedJob, setSelectedJob] = useState<JobListing | null>(null)

  useEffect(() => {
    loadInitialData()
  }, [])

  useEffect(() => {
    if (activeTab === 'search') {
      searchJobs()
    } else if (activeTab === 'applications') {
      loadApplications()
    } else if (activeTab === 'saved') {
      loadSavedSearches()
    } else if (activeTab === 'stats') {
      loadApplicationStats()
    }
  }, [activeTab])

  const loadInitialData = async () => {
    setLoading(true)
    try {
      // Load recommended jobs
      const recommended = await jobSearchService.getRecommendedJobs(5)
      setRecommendedJobs(recommended)
      
      // Load initial job search
      await searchJobs()
    } catch (error) {
      console.error('Error loading initial data:', error)
      toast.error('Failed to load job data')
    } finally {
      setLoading(false)
    }
  }

  const searchJobs = async () => {
    setLoading(true)
    try {
      const results = await jobSearchService.searchJobs(searchParams)
      setJobListings(results)
    } catch (error) {
      console.error('Error searching jobs:', error)
      toast.error('Failed to search jobs')
    } finally {
      setLoading(false)
    }
  }

  const loadApplications = async () => {
    setLoading(true)
    try {
      const apps = await jobSearchService.getApplications({
        sortBy: 'application_date',
        sortOrder: 'DESC'
      })
      setApplications(apps)
    } catch (error) {
      console.error('Error loading applications:', error)
      toast.error('Failed to load applications')
    } finally {
      setLoading(false)
    }
  }

  const loadSavedSearches = async () => {
    setLoading(true)
    try {
      const searches = await jobSearchService.getSavedSearches()
      setSavedSearches(searches)
    } catch (error) {
      console.error('Error loading saved searches:', error)
      toast.error('Failed to load saved searches')
    } finally {
      setLoading(false)
    }
  }

  const loadApplicationStats = async () => {
    setLoading(true)
    try {
      const stats = await jobSearchService.getApplicationStats(30)
      setApplicationStats(stats)
    } catch (error) {
      console.error('Error loading application stats:', error)
      toast.error('Failed to load statistics')
    } finally {
      setLoading(false)
    }
  }

  const handleApplyToJob = async (job: JobListing) => {
    try {
      const application = await jobSearchService.createApplication({
        jobId: job.id,
        status: 'interested'
      })
      toast.success(`Added ${job.job_title} to your applications`)
      setApplications([application, ...applications])
    } catch (error) {
      console.error('Error applying to job:', error)
      toast.error('Failed to save job application')
    }
  }

  const handleSaveSearch = async () => {
    const searchName = prompt('Enter a name for this search:')
    if (!searchName) return

    try {
      const savedSearch = await jobSearchService.saveSearch({
        searchName,
        criteria: searchParams,
        notificationFrequency: 'daily'
      })
      setSavedSearches([savedSearch, ...savedSearches])
      toast.success('Search saved successfully')
    } catch (error) {
      console.error('Error saving search:', error)
      toast.error('Failed to save search')
    }
  }

  const handleLoadSavedSearch = async (search: SavedSearch) => {
    setSearchParams(search.criteria)
    setActiveTab('search')
    await searchJobs()
  }

  const handleUpdateFilters = (newParams: Partial<JobSearchParams>) => {
    setSearchParams({ ...searchParams, ...newParams, offset: 0 })
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Job Search</h1>
        <p className="text-gray-600">Find your next opportunity</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 mb-6 border-b">
        <button
          onClick={() => setActiveTab('search')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'search'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >
          <Search className="inline-block w-4 h-4 mr-2" />
          Search Jobs
        </button>
        <button
          onClick={() => setActiveTab('applications')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'applications'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >
          <Briefcase className="inline-block w-4 h-4 mr-2" />
          Applications ({applications.length})
        </button>
        <button
          onClick={() => setActiveTab('saved')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'saved'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >
          <Star className="inline-block w-4 h-4 mr-2" />
          Saved Searches ({savedSearches.length})
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'stats'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >
          <TrendingUp className="inline-block w-4 h-4 mr-2" />
          Stats
        </button>
      </div>

      {/* Search Tab */}
      {activeTab === 'search' && (
        <div>
          {/* Search Bar */}
          <div className="mb-6">
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search job titles, companies, or keywords..."
                    value={searchParams.q}
                    onChange={(e) => handleUpdateFilters({ q: e.target.value })}
                    onKeyPress={(e) => e.key === 'Enter' && searchJobs()}
                    className="w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="px-4 py-3 border rounded-lg hover:bg-gray-50 flex items-center gap-2"
              >
                <Filter className="w-5 h-5" />
                Filters
              </button>
              <button
                onClick={searchJobs}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Search
              </button>
              <button
                onClick={handleSaveSearch}
                className="px-4 py-3 border rounded-lg hover:bg-gray-50"
              >
                <BookmarkPlus className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Filters */}
          {showFilters && (
            <JobFilters
              params={searchParams}
              onUpdateFilters={handleUpdateFilters}
              onClose={() => setShowFilters(false)}
            />
          )}

          {/* Recommended Jobs */}
          {recommendedJobs.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-500" />
                Recommended for You
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recommendedJobs.map((job) => (
                  <JobListingCard
                    key={job.id}
                    job={job}
                    onApply={() => handleApplyToJob(job)}
                    onView={() => setSelectedJob(job)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Job Listings */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                {jobListings.length} Jobs Found
              </h3>
              <select
                value={`${searchParams.sortBy}_${searchParams.sortOrder}`}
                onChange={(e) => {
                  const [sortBy, sortOrder] = e.target.value.split('_')
                  handleUpdateFilters({ 
                    sortBy: sortBy as any, 
                    sortOrder: sortOrder as any 
                  })
                }}
                className="px-3 py-2 border rounded-lg"
              >
                <option value="posting_date_DESC">Newest First</option>
                <option value="posting_date_ASC">Oldest First</option>
                <option value="match_score_DESC">Best Match</option>
                <option value="salary_max_DESC">Highest Salary</option>
                <option value="company_name_ASC">Company A-Z</option>
              </select>
            </div>

            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading jobs...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {jobListings.map((job) => (
                  <JobListingCard
                    key={job.id}
                    job={job}
                    onApply={() => handleApplyToJob(job)}
                    onView={() => setSelectedJob(job)}
                    expanded
                  />
                ))}
              </div>
            )}

            {/* Pagination */}
            {jobListings.length > 0 && (
              <div className="mt-6 flex justify-center gap-2">
                <button
                  onClick={() => handleUpdateFilters({ 
                    offset: Math.max(0, (searchParams.offset || 0) - (searchParams.limit || 20)) 
                  })}
                  disabled={!searchParams.offset || searchParams.offset === 0}
                  className="px-4 py-2 border rounded-lg disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="px-4 py-2">
                  Page {Math.floor((searchParams.offset || 0) / (searchParams.limit || 20)) + 1}
                </span>
                <button
                  onClick={() => handleUpdateFilters({ 
                    offset: (searchParams.offset || 0) + (searchParams.limit || 20) 
                  })}
                  disabled={jobListings.length < (searchParams.limit || 20)}
                  className="px-4 py-2 border rounded-lg disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Applications Tab */}
      {activeTab === 'applications' && (
        <ApplicationTracker
          applications={applications}
          onUpdateApplication={async (id, updates) => {
            try {
              const updated = await jobSearchService.updateApplication(id, updates)
              setApplications(applications.map(a => a.id === id ? updated : a))
              toast.success('Application updated')
            } catch (error) {
              toast.error('Failed to update application')
            }
          }}
        />
      )}

      {/* Saved Searches Tab */}
      {activeTab === 'saved' && (
        <div className="space-y-4">
          {savedSearches.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <Star className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">No saved searches yet</p>
              <p className="text-sm text-gray-500">
                Save your search criteria to get notified of new matching jobs
              </p>
            </div>
          ) : (
            savedSearches.map((search) => (
              <div
                key={search.id}
                className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
                onClick={() => handleLoadSavedSearch(search)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold">{search.search_name}</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      {search.criteria.q && `Keywords: ${search.criteria.q}`}
                      {search.criteria.location && ` • Location: ${search.criteria.location}`}
                      {search.criteria.experienceLevel && ` • Level: ${search.criteria.experienceLevel}`}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      Notifications: {search.notification_frequency || 'None'}
                      {search.new_results_count && search.new_results_count > 0 && (
                        <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                          {search.new_results_count} new
                        </span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation()
                      try {
                        await jobSearchService.deleteSavedSearch(search.id)
                        setSavedSearches(savedSearches.filter(s => s.id !== search.id))
                        toast.success('Search deleted')
                      } catch (error) {
                        toast.error('Failed to delete search')
                      }
                    }}
                    className="text-red-600 hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Stats Tab */}
      {activeTab === 'stats' && applicationStats && (
        <JobSearchStats stats={applicationStats} />
      )}

      {/* Preferences Link */}
      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-blue-900">Job Search Preferences</h3>
            <p className="text-sm text-blue-700 mt-1">
              Set your preferences to get better job recommendations
            </p>
          </div>
          <Link
            to="/job-preferences"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Settings className="w-4 h-4" />
            Manage Preferences
          </Link>
        </div>
      </div>
    </div>
  )
}