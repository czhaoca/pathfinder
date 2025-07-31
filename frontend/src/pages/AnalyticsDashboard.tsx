import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  TrendingUp, 
  BarChart3, 
  FileText, 
  Download,
  RefreshCw,
  Target,
  Loader2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import SkillsProgressionCard from '@/components/analytics/SkillsProgressionCard'
import CareerTrajectoryChart from '@/components/analytics/CareerTrajectoryChart'
import ImpactScoreCard from '@/components/analytics/ImpactScoreCard'
import { analyticsService } from '@/services/analyticsService'
import { 
  AnalyticsSummary,
  SkillsProgressionResponse,
  CareerTrajectory,
  ExportFormat
} from '@/types/analytics'
import { useToast } from '@/components/ui/use-toast'

export default function AnalyticsDashboard() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [skillsData, setSkillsData] = useState<SkillsProgressionResponse | null>(null)
  const [trajectoryData, setTrajectoryData] = useState<CareerTrajectory | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    loadAnalytics()
  }, [])

  const loadAnalytics = async (refresh = false) => {
    try {
      setError(null)
      if (refresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      const [summaryRes, skillsRes, trajectoryRes] = await Promise.all([
        analyticsService.getAnalyticsSummary(refresh),
        analyticsService.getSkillsProgression(),
        analyticsService.getCareerTrajectory()
      ])

      setSummary(summaryRes)
      setSkillsData(skillsRes)
      setTrajectoryData(trajectoryRes)
    } catch (err) {
      console.error('Failed to load analytics:', err)
      setError('Failed to load analytics data. Please try again.')
      toast({
        title: 'Error',
        description: 'Failed to load analytics data',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleExport = async (format: ExportFormat) => {
    try {
      const blob = await analyticsService.exportAnalytics(format)
      analyticsService.downloadAnalyticsExport(blob, format)
      toast({
        title: 'Success',
        description: `Analytics exported as ${format.toUpperCase()}`
      })
    } catch (err) {
      console.error('Failed to export analytics:', err)
      toast({
        title: 'Error',
        description: 'Failed to export analytics',
        variant: 'destructive'
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={() => loadAnalytics()} className="mt-4">
          Try Again
        </Button>
      </div>
    )
  }

  const careerProgress = summary ? analyticsService.calculateCareerProgress(summary) : 0

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold">Career Analytics</h1>
            <p className="text-muted-foreground mt-1">
              Comprehensive insights into your career progression and achievements
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadAnalytics(true)}
              disabled={refreshing}
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh
            </Button>
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                className="dropdown-toggle"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <div className="dropdown-menu absolute right-0 mt-2 w-32 bg-white border rounded-md shadow-lg hidden">
                <button
                  className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                  onClick={() => handleExport('json')}
                >
                  As JSON
                </button>
                <button
                  className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                  onClick={() => handleExport('csv')}
                >
                  As CSV
                </button>
                <button
                  className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                  onClick={() => handleExport('pdf')}
                >
                  As PDF
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-primary/10 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Experience</p>
                  <p className="text-2xl font-bold">
                    {summary.totalYearsExperience} years
                  </p>
                </div>
                <BarChart3 className="h-8 w-8 text-primary" />
              </div>
            </div>
            
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Career Progress</p>
                  <p className="text-2xl font-bold">{careerProgress}%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-blue-600" />
              </div>
            </div>
            
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Top Skills</p>
                  <p className="text-2xl font-bold">{summary.topSkills.length}</p>
                </div>
                <Target className="h-8 w-8 text-green-600" />
              </div>
            </div>
            
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Recommendations</p>
                  <p className="text-2xl font-bold">{summary.recommendations.length}</p>
                </div>
                <FileText className="h-8 w-8 text-purple-600" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="skills">Skills Analysis</TabsTrigger>
          <TabsTrigger value="trajectory">Career Path</TabsTrigger>
          <TabsTrigger value="recommendations">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Skills Summary */}
            {skillsData && (
              <SkillsProgressionCard
                skills={skillsData.skills}
                summary={skillsData.summary}
              />
            )}

            {/* Overall Impact Scores */}
            {summary && (
              <ImpactScoreCard
                scores={{
                  revenue: 0.7,
                  efficiency: 0.8,
                  teamGrowth: 0.6,
                  innovation: 0.75,
                  overall: 0.71
                }}
              />
            )}
          </div>

          {/* Career Trajectory Preview */}
          {trajectoryData && (
            <CareerTrajectoryChart trajectory={trajectoryData} />
          )}
        </TabsContent>

        <TabsContent value="skills" className="space-y-6">
          {skillsData && (
            <>
              <SkillsProgressionCard
                skills={skillsData.skills}
                summary={skillsData.summary}
              />
              
              {/* Additional skills visualizations can be added here */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Skill Category Distribution */}
                <div className="bg-white rounded-lg border p-6">
                  <h3 className="font-semibold mb-4">Skill Distribution</h3>
                  {/* Add pie chart or bar chart here */}
                </div>
                
                {/* Skill Growth Timeline */}
                <div className="bg-white rounded-lg border p-6">
                  <h3 className="font-semibold mb-4">Skill Acquisition Timeline</h3>
                  {/* Add timeline visualization here */}
                </div>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="trajectory" className="space-y-6">
          {trajectoryData && (
            <CareerTrajectoryChart trajectory={trajectoryData} />
          )}
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-6">
          {summary && (
            <div className="space-y-6">
              {/* Recommendations */}
              <div className="bg-white rounded-lg border p-6">
                <h3 className="font-semibold mb-4">Personalized Recommendations</h3>
                <div className="space-y-3">
                  {summary.recommendations.map((rec, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border ${
                        analyticsService.getRecommendationColor(rec.priority)
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{rec.recommendation}</p>
                          <p className="text-sm mt-1">{rec.action}</p>
                        </div>
                        <span className="text-xs font-medium uppercase">
                          {rec.priority}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Skill Gaps */}
              {summary.skillGaps.length > 0 && (
                <div className="bg-white rounded-lg border p-6">
                  <h3 className="font-semibold mb-4">Skill Development Opportunities</h3>
                  <div className="space-y-2">
                    {summary.skillGaps.map((gap, index) => (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                        <div>
                          <p className="font-medium">{gap.skill}</p>
                          <p className="text-sm text-muted-foreground">{gap.reason}</p>
                        </div>
                        <span className={`text-xs font-medium uppercase ${
                          gap.importance === 'high' ? 'text-red-600' :
                          gap.importance === 'medium' ? 'text-yellow-600' :
                          'text-green-600'
                        }`}>
                          {gap.importance}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}