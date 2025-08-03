import React, { useState, useEffect } from 'react'
import {
  Wand2,
  AlertTriangle,
  Check,
  X,
  Target,
  FileText,
  Hash,
  Layout,
  Clock,
  Loader2,
  ChevronRight,
  Info
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { resumeService } from '@/services/resumeService'
import { useToast } from '@/components/ui/use-toast'
import {
  ATSScore,
  ATSOptimizationSuggestion,
  ATSOptimizationResponse
} from '@/types/resume'

interface ATSOptimizationProps {
  targetRole: string
  currentScore?: ATSScore | null
  onOptimize?: (suggestions: ATSOptimizationSuggestion[]) => void
}

export default function ATSOptimization({ targetRole, currentScore, onOptimize }: ATSOptimizationProps) {
  const { toast } = useToast()
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [optimizationData, setOptimizationData] = useState<ATSOptimizationResponse | null>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [targetRoleInput, setTargetRoleInput] = useState(targetRole)

  useEffect(() => {
    setTargetRoleInput(targetRole)
  }, [targetRole])

  const analyzeResume = async () => {
    if (!targetRoleInput) {
      toast({
        title: 'Target role required',
        description: 'Please enter a target role to optimize for',
        variant: 'destructive'
      })
      return
    }

    try {
      setIsAnalyzing(true)
      const response = await resumeService.getATSOptimization(targetRoleInput)
      setOptimizationData(response)
      setActiveTab('suggestions')
    } catch (error) {
      console.error('Failed to analyze resume:', error)
      toast({
        title: 'Error',
        description: 'Failed to analyze resume for ATS optimization',
        variant: 'destructive'
      })
    } finally {
      setIsAnalyzing(false)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-100'
    if (score >= 60) return 'bg-yellow-100'
    return 'bg-red-100'
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive'
      case 'medium': return 'default'
      case 'low': return 'secondary'
      default: return 'outline'
    }
  }

  const formatScore = (score: number) => {
    return Math.round(score)
  }

  const renderScoreCard = (title: string, score: number, icon: React.ReactNode) => (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {icon}
            <div>
              <p className="text-sm font-medium">{title}</p>
              <p className="text-2xl font-bold">{formatScore(score)}</p>
            </div>
          </div>
          <Progress value={score} className="w-20" />
        </div>
      </CardContent>
    </Card>
  )

  const atsScore = optimizationData?.atsScore || currentScore

  return (
    <div className="space-y-6">
      {/* Target Role Input */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Target Role Optimization
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="target-role-opt">Target Role</Label>
            <div className="flex gap-2">
              <Input
                id="target-role-opt"
                placeholder="e.g., Senior Software Engineer"
                value={targetRoleInput}
                onChange={(e) => setTargetRoleInput(e.target.value)}
                className="flex-1"
              />
              <Button 
                onClick={analyzeResume}
                disabled={isAnalyzing || !targetRoleInput}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4 mr-2" />
                    Analyze
                  </>
                )}
              </Button>
            </div>
          </div>

          {atsScore && (
            <Alert className={getScoreBgColor(atsScore.total)}>
              <AlertTitle className="flex items-center justify-between">
                ATS Compatibility Score
                <span className={`text-2xl font-bold ${getScoreColor(atsScore.total)}`}>
                  {formatScore(atsScore.total)}/100
                </span>
              </AlertTitle>
              <AlertDescription className="mt-2">
                {atsScore.total >= 80 && "Excellent! Your resume is highly optimized for ATS systems."}
                {atsScore.total >= 60 && atsScore.total < 80 && "Good score, but there's room for improvement."}
                {atsScore.total < 60 && "Your resume needs optimization to pass ATS screening."}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Optimization Results */}
      {(atsScore || optimizationData) && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Score Overview</TabsTrigger>
            <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
            <TabsTrigger value="tips">Best Practices</TabsTrigger>
          </TabsList>

          {/* Score Overview */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {atsScore && (
                <>
                  {renderScoreCard(
                    'Keywords',
                    atsScore.factors.keywords,
                    <Hash className="h-5 w-5 text-blue-600" />
                  )}
                  {renderScoreCard(
                    'Formatting',
                    atsScore.factors.formatting,
                    <Layout className="h-5 w-5 text-green-600" />
                  )}
                  {renderScoreCard(
                    'Length',
                    atsScore.factors.length,
                    <FileText className="h-5 w-5 text-purple-600" />
                  )}
                  {renderScoreCard(
                    'Sections',
                    atsScore.factors.sections,
                    <FileText className="h-5 w-5 text-orange-600" />
                  )}
                </>
              )}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Score Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Keywords Match</span>
                    <span className="text-sm font-medium">
                      {atsScore?.factors.keywords || 0}%
                    </span>
                  </div>
                  <Progress value={atsScore?.factors.keywords || 0} />
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm">ATS-Friendly Formatting</span>
                    <span className="text-sm font-medium">
                      {atsScore?.factors.formatting || 0}%
                    </span>
                  </div>
                  <Progress value={atsScore?.factors.formatting || 0} />
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Optimal Length</span>
                    <span className="text-sm font-medium">
                      {atsScore?.factors.length || 0}%
                    </span>
                  </div>
                  <Progress value={atsScore?.factors.length || 0} />
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Required Sections</span>
                    <span className="text-sm font-medium">
                      {atsScore?.factors.sections || 0}%
                    </span>
                  </div>
                  <Progress value={atsScore?.factors.sections || 0} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Suggestions */}
          <TabsContent value="suggestions" className="space-y-4">
            {optimizationData?.suggestions && optimizationData.suggestions.length > 0 ? (
              <>
                <div className="flex gap-2 mb-4">
                  <Badge variant="destructive">
                    {optimizationData.suggestions.filter(s => s.priority === 'high').length} High Priority
                  </Badge>
                  <Badge variant="default">
                    {optimizationData.suggestions.filter(s => s.priority === 'medium').length} Medium Priority
                  </Badge>
                  <Badge variant="secondary">
                    {optimizationData.suggestions.filter(s => s.priority === 'low').length} Low Priority
                  </Badge>
                </div>

                <Accordion type="single" collapsible className="w-full">
                  {optimizationData.suggestions.map((suggestion, index) => (
                    <AccordionItem key={index} value={`item-${index}`}>
                      <AccordionTrigger>
                        <div className="flex items-center gap-2 text-left">
                          <Badge variant={getPriorityColor(suggestion.priority)}>
                            {suggestion.priority}
                          </Badge>
                          <span className="font-medium">{suggestion.category}</span>
                          <ChevronRight className="h-4 w-4" />
                          <span className="text-sm text-muted-foreground">
                            {suggestion.suggestion}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3 pt-2">
                          <p className="text-sm">{suggestion.suggestion}</p>
                          {suggestion.improvement && (
                            <div className="p-3 bg-muted rounded-lg">
                              <p className="text-sm font-medium mb-1">Suggested Improvement:</p>
                              <p className="text-sm">{suggestion.improvement}</p>
                            </div>
                          )}
                          {onOptimize && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onOptimize([suggestion])}
                            >
                              Apply This Suggestion
                            </Button>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>

                {onOptimize && (
                  <Button
                    className="w-full"
                    onClick={() => onOptimize(optimizationData.suggestions)}
                  >
                    <Wand2 className="h-4 w-4 mr-2" />
                    Apply All Suggestions
                  </Button>
                )}
              </>
            ) : (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>No suggestions yet</AlertTitle>
                <AlertDescription>
                  Click "Analyze" to get personalized ATS optimization suggestions for your target role.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          {/* Best Practices */}
          <TabsContent value="tips" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>ATS Best Practices</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {resumeService.getATSFormattingTips().map((tip, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <p className="text-sm">{tip}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Common ATS Mistakes to Avoid</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <X className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm">Using tables or columns for layout</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <X className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm">Including images, logos, or graphics</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <X className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm">Using creative fonts or special characters</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <X className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm">Placing contact info in headers/footers</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <X className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm">Using non-standard section headings</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}