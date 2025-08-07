import { useState, useEffect } from 'react'
import { 
  BookOpen, 
  Award, 
  Target, 
  TrendingUp, 
  Clock,
  Star,
  CheckCircle,
  Plus,
  Filter,
  Search,
  ChevronRight,
  GraduationCap,
  Trophy,
  Brain
} from 'lucide-react'
import { toast } from 'sonner'
import learningService from '@/services/learningService'
import type { 
  Course, 
  CourseEnrollment, 
  Certification,
  UserCertification,
  LearningPath,
  UserLearningPath,
  LearningGoal,
  LearningAnalytics
} from '@/services/learningService'
import { authStore } from '@/stores/authStore'
import CourseCard from '@/components/learning/CourseCard'
import CertificationCard from '@/components/learning/CertificationCard'
import LearningPathCard from '@/components/learning/LearningPathCard'
import LearningGoals from '@/components/learning/LearningGoals'
import LearningStats from '@/components/learning/LearningStats'

export default function Learning() {
  const { user } = authStore()
  const [activeTab, setActiveTab] = useState<'courses' | 'certifications' | 'paths' | 'goals' | 'analytics'>('courses')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterDifficulty, setFilterDifficulty] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)
  
  // Courses State
  const [courses, setCourses] = useState<Course[]>([])
  const [enrolledCourses, setEnrolledCourses] = useState<CourseEnrollment[]>([])
  const [recommendedCourses, setRecommendedCourses] = useState<Course[]>([])
  
  // Certifications State
  const [certifications, setCertifications] = useState<Certification[]>([])
  const [userCertifications, setUserCertifications] = useState<UserCertification[]>([])
  const [recommendedCerts, setRecommendedCerts] = useState<Certification[]>([])
  
  // Learning Paths State
  const [learningPaths, setLearningPaths] = useState<LearningPath[]>([])
  const [userPaths, setUserPaths] = useState<UserLearningPath[]>([])
  const [recommendedPaths, setRecommendedPaths] = useState<LearningPath[]>([])
  
  // Goals & Analytics State
  const [learningGoals, setLearningGoals] = useState<LearningGoal[]>([])
  const [analytics, setAnalytics] = useState<LearningAnalytics | null>(null)
  
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadInitialData()
  }, [])

  useEffect(() => {
    if (activeTab === 'courses') {
      loadCourses()
    } else if (activeTab === 'certifications') {
      loadCertifications()
    } else if (activeTab === 'paths') {
      loadLearningPaths()
    } else if (activeTab === 'goals') {
      loadLearningGoals()
    } else if (activeTab === 'analytics') {
      loadAnalytics()
    }
  }, [activeTab])

  const loadInitialData = async () => {
    setLoading(true)
    try {
      // Load enrolled courses
      const enrolled = await learningService.getEnrolledCourses()
      setEnrolledCourses(enrolled)
      
      // Load recommended courses
      const recommended = await learningService.getRecommendedCourses(5)
      setRecommendedCourses(recommended)
      
      // Load initial course search
      await loadCourses()
    } catch (error) {
      console.error('Error loading initial data:', error)
      toast.error('Failed to load learning data')
    } finally {
      setLoading(false)
    }
  }

  const loadCourses = async () => {
    setLoading(true)
    try {
      const results = await learningService.searchCourses({
        q: searchQuery,
        difficulty: filterDifficulty as any,
        limit: 20
      })
      setCourses(results)
    } catch (error) {
      console.error('Error loading courses:', error)
      toast.error('Failed to load courses')
    } finally {
      setLoading(false)
    }
  }

  const loadCertifications = async () => {
    setLoading(true)
    try {
      const [certs, userCerts, recommended] = await Promise.all([
        learningService.browseCertifications({ q: searchQuery, limit: 20 }),
        learningService.getUserCertifications(true),
        learningService.getRecommendedCertifications(5)
      ])
      setCertifications(certs)
      setUserCertifications(userCerts)
      setRecommendedCerts(recommended)
    } catch (error) {
      console.error('Error loading certifications:', error)
      toast.error('Failed to load certifications')
    } finally {
      setLoading(false)
    }
  }

  const loadLearningPaths = async () => {
    setLoading(true)
    try {
      const [paths, userPaths, recommended] = await Promise.all([
        learningService.browseLearningPaths({ q: searchQuery, limit: 20 }),
        learningService.getUserLearningPaths(),
        learningService.getRecommendedPaths(5)
      ])
      setLearningPaths(paths)
      setUserPaths(userPaths)
      setRecommendedPaths(recommended)
    } catch (error) {
      console.error('Error loading learning paths:', error)
      toast.error('Failed to load learning paths')
    } finally {
      setLoading(false)
    }
  }

  const loadLearningGoals = async () => {
    setLoading(true)
    try {
      const goals = await learningService.getLearningGoals(false)
      setLearningGoals(goals)
    } catch (error) {
      console.error('Error loading goals:', error)
      toast.error('Failed to load learning goals')
    } finally {
      setLoading(false)
    }
  }

  const loadAnalytics = async () => {
    setLoading(true)
    try {
      const data = await learningService.getLearningAnalytics()
      setAnalytics(data)
    } catch (error) {
      console.error('Error loading analytics:', error)
      toast.error('Failed to load learning analytics')
    } finally {
      setLoading(false)
    }
  }

  const handleEnrollCourse = async (course: Course) => {
    try {
      const enrollment = await learningService.enrollInCourse({
        courseId: course.id
      })
      setEnrolledCourses([...enrolledCourses, enrollment])
      toast.success(`Enrolled in ${course.course_name}`)
    } catch (error) {
      console.error('Error enrolling in course:', error)
      toast.error('Failed to enroll in course')
    }
  }

  const handleEnrollPath = async (path: LearningPath) => {
    try {
      const enrollment = await learningService.enrollInPath(path.id)
      setUserPaths([...userPaths, enrollment])
      toast.success(`Enrolled in ${path.path_name}`)
    } catch (error) {
      console.error('Error enrolling in path:', error)
      toast.error('Failed to enroll in learning path')
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Learning & Development</h1>
        <p className="text-gray-600">Develop your skills and advance your career</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Courses Enrolled</p>
              <p className="text-2xl font-bold">{enrolledCourses.length}</p>
            </div>
            <BookOpen className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Certifications</p>
              <p className="text-2xl font-bold">{userCertifications.filter(c => c.status === 'active').length}</p>
            </div>
            <Award className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Paths</p>
              <p className="text-2xl font-bold">{userPaths.filter(p => p.status === 'in_progress').length}</p>
            </div>
            <Target className="w-8 h-8 text-purple-600" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Goals</p>
              <p className="text-2xl font-bold">{learningGoals.filter(g => g.status === 'active').length}</p>
            </div>
            <Trophy className="w-8 h-8 text-yellow-600" />
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 mb-6 border-b overflow-x-auto">
        <button
          onClick={() => setActiveTab('courses')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'courses'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >
          <BookOpen className="inline-block w-4 h-4 mr-2" />
          Courses
        </button>
        <button
          onClick={() => setActiveTab('certifications')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'certifications'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >
          <Award className="inline-block w-4 h-4 mr-2" />
          Certifications
        </button>
        <button
          onClick={() => setActiveTab('paths')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'paths'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >
          <Target className="inline-block w-4 h-4 mr-2" />
          Learning Paths
        </button>
        <button
          onClick={() => setActiveTab('goals')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'goals'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >
          <Trophy className="inline-block w-4 h-4 mr-2" />
          Goals
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'analytics'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >
          <TrendingUp className="inline-block w-4 h-4 mr-2" />
          Analytics
        </button>
      </div>

      {/* Search Bar (for courses, certifications, paths) */}
      {['courses', 'certifications', 'paths'].includes(activeTab) && (
        <div className="mb-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder={`Search ${activeTab}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      if (activeTab === 'courses') loadCourses()
                      else if (activeTab === 'certifications') loadCertifications()
                      else if (activeTab === 'paths') loadLearningPaths()
                    }
                  }}
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
              onClick={() => {
                if (activeTab === 'courses') loadCourses()
                else if (activeTab === 'certifications') loadCertifications()
                else if (activeTab === 'paths') loadLearningPaths()
              }}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Search
            </button>
          </div>
        </div>
      )}

      {/* Courses Tab */}
      {activeTab === 'courses' && (
        <div>
          {/* Enrolled Courses */}
          {enrolledCourses.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4">My Courses</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {enrolledCourses.slice(0, 3).map((enrollment) => (
                  <div key={enrollment.id} className="border rounded-lg p-4">
                    <h4 className="font-semibold mb-2">{enrollment.course_name}</h4>
                    <p className="text-sm text-gray-600 mb-3">{enrollment.provider}</p>
                    <div className="mb-3">
                      <div className="flex justify-between text-sm mb-1">
                        <span>Progress</span>
                        <span>{enrollment.progress_percentage}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ width: `${enrollment.progress_percentage}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        enrollment.status === 'completed' ? 'bg-green-100 text-green-700' :
                        enrollment.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {enrollment.status.replace('_', ' ')}
                      </span>
                      <button className="text-blue-600 hover:text-blue-700 text-sm">
                        Continue →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommended Courses */}
          {recommendedCourses.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-500" />
                Recommended for You
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recommendedCourses.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    onEnroll={() => handleEnrollCourse(course)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* All Courses */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Browse Courses</h3>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading courses...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {courses.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    onEnroll={() => handleEnrollCourse(course)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Certifications Tab */}
      {activeTab === 'certifications' && (
        <div>
          {/* My Certifications */}
          {userCertifications.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4">My Certifications</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {userCertifications.map((cert) => (
                  <CertificationCard
                    key={cert.id}
                    certification={cert}
                    isUserCert
                  />
                ))}
              </div>
            </div>
          )}

          {/* Recommended Certifications */}
          {recommendedCerts.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-500" />
                Recommended Certifications
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recommendedCerts.map((cert) => (
                  <CertificationCard
                    key={cert.id}
                    certification={cert}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Browse Certifications */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Browse Certifications</h3>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading certifications...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {certifications.map((cert) => (
                  <CertificationCard
                    key={cert.id}
                    certification={cert}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Learning Paths Tab */}
      {activeTab === 'paths' && (
        <div>
          {/* My Learning Paths */}
          {userPaths.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4">My Learning Paths</h3>
              <div className="space-y-4">
                {userPaths.map((path) => (
                  <LearningPathCard
                    key={path.id}
                    path={path}
                    isUserPath
                  />
                ))}
              </div>
            </div>
          )}

          {/* Recommended Paths */}
          {recommendedPaths.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-500" />
                Recommended Learning Paths
              </h3>
              <div className="space-y-4">
                {recommendedPaths.map((path) => (
                  <LearningPathCard
                    key={path.id}
                    path={path}
                    onEnroll={() => handleEnrollPath(path)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Browse Learning Paths */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Browse Learning Paths</h3>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading learning paths...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {learningPaths.map((path) => (
                  <LearningPathCard
                    key={path.id}
                    path={path}
                    onEnroll={() => handleEnrollPath(path)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Goals Tab */}
      {activeTab === 'goals' && (
        <LearningGoals
          goals={learningGoals}
          onUpdateGoal={async (goalId, updates) => {
            try {
              const updated = await learningService.updateLearningGoal(goalId, updates)
              setLearningGoals(learningGoals.map(g => g.id === goalId ? updated : g))
              toast.success('Goal updated')
            } catch (error) {
              toast.error('Failed to update goal')
            }
          }}
          onCreateGoal={async (data) => {
            try {
              const newGoal = await learningService.createLearningGoal(data)
              setLearningGoals([...learningGoals, newGoal])
              toast.success('Goal created')
            } catch (error) {
              toast.error('Failed to create goal')
            }
          }}
        />
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && analytics && (
        <LearningStats analytics={analytics} />
      )}
    </div>
  )
}