import React, { useState, useEffect } from 'react'
import { 
  FileText, 
  Download, 
  Target, 
  Wand2, 
  Eye, 
  Settings,
  Check,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { resumeService } from '@/services/resumeService'
import { useToast } from '@/components/ui/use-toast'
import ResumePreview from './ResumePreview'
import ATSOptimization from './ATSOptimization'
import {
  ResumeTemplate,
  ResumeGenerationOptions,
  ResumeData,
  ResumeFormat,
  ATSScore
} from '@/types/resume'

export default function ResumeBuilder() {
  const { toast } = useToast()
  const [templates, setTemplates] = useState<ResumeTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState('professional')
  const [targetRole, setTargetRole] = useState('')
  const [format, setFormat] = useState<ResumeFormat>('pdf')
  const [previewData, setPreviewData] = useState<ResumeData | null>(null)
  const [atsScore, setAtsScore] = useState<ATSScore | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [activeTab, setActiveTab] = useState('build')
  
  // Section toggles
  const [includeSections, setIncludeSections] = useState({
    skills: true,
    education: true,
    achievements: true,
    certifications: true
  })
  
  const [atsOptimized, setAtsOptimized] = useState(true)

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    try {
      const response = await resumeService.getTemplates()
      setTemplates(response.templates)
    } catch (error) {
      console.error('Failed to load templates:', error)
      toast({
        title: 'Error',
        description: 'Failed to load resume templates',
        variant: 'destructive'
      })
    }
  }

  const handlePreview = async () => {
    try {
      setIsPreviewing(true)
      const response = await resumeService.previewResume({
        templateId: selectedTemplate,
        targetRole: targetRole || undefined,
        atsOptimized
      })
      
      setPreviewData(response.preview)
      setAtsScore(response.atsScore || null)
      setActiveTab('preview')
    } catch (error) {
      console.error('Failed to preview resume:', error)
      toast({
        title: 'Error',
        description: 'Failed to generate resume preview',
        variant: 'destructive'
      })
    } finally {
      setIsPreviewing(false)
    }
  }

  const handleGenerate = async () => {
    try {
      setIsGenerating(true)
      
      const options: ResumeGenerationOptions = {
        templateId: selectedTemplate,
        targetRole: targetRole || undefined,
        includeSkills: includeSections.skills,
        includeEducation: includeSections.education,
        includeAchievements: includeSections.achievements,
        atsOptimized,
        format
      }
      
      const result = await resumeService.generateResume(options)
      
      if (format === 'pdf' || format === 'docx') {
        // Download binary file
        resumeService.downloadResume(result as Blob, format)
        toast({
          title: 'Success',
          description: `Resume downloaded as ${format.toUpperCase()}`
        })
      } else {
        // Handle JSON response
        toast({
          title: 'Success',
          description: 'Resume generated successfully'
        })
      }
    } catch (error) {
      console.error('Failed to generate resume:', error)
      toast({
        title: 'Error',
        description: 'Failed to generate resume',
        variant: 'destructive'
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const getTemplateIcon = (templateId: string) => {
    const icons: Record<string, string> = {
      professional: '💼',
      modern: '🎨',
      executive: '👔',
      technical: '💻',
      creative: '🎭'
    }
    return icons[templateId] || '📄'
  }

  const getATSScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="build">Build Resume</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="optimize">ATS Optimization</TabsTrigger>
        </TabsList>

        <TabsContent value="build" className="space-y-6">
          {/* Template Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Choose Template
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {templates.map(template => (
                  <button
                    key={template.id}
                    onClick={() => setSelectedTemplate(template.id)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      selectedTemplate === template.id
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-2xl mb-2">{getTemplateIcon(template.id)}</div>
                    <div className="font-medium text-sm">{template.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {template.description}
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Resume Options */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Resume Options
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Target Role */}
              <div className="space-y-2">
                <Label htmlFor="target-role" className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Target Role (Optional)
                </Label>
                <Input
                  id="target-role"
                  placeholder="e.g., Senior Software Engineer"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Optimize your resume for a specific role
                </p>
              </div>

              {/* Format Selection */}
              <div className="space-y-2">
                <Label htmlFor="format">Export Format</Label>
                <Select value={format} onValueChange={(value) => setFormat(value as ResumeFormat)}>
                  <SelectTrigger id="format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF (Recommended)</SelectItem>
                    <SelectItem value="docx">Word Document</SelectItem>
                    <SelectItem value="json">JSON (For developers)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Section Toggles */}
              <div className="space-y-4">
                <Label>Include Sections</Label>
                <div className="space-y-3">
                  {Object.entries(includeSections).map(([section, enabled]) => (
                    <div key={section} className="flex items-center justify-between">
                      <Label 
                        htmlFor={`include-${section}`} 
                        className="text-sm font-normal capitalize cursor-pointer"
                      >
                        {section}
                      </Label>
                      <Switch
                        id={`include-${section}`}
                        checked={enabled}
                        onCheckedChange={(checked) => 
                          setIncludeSections(prev => ({ ...prev, [section]: checked }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* ATS Optimization Toggle */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-blue-50 border border-blue-200">
                <div className="flex items-center gap-3">
                  <Wand2 className="h-5 w-5 text-blue-600" />
                  <div>
                    <Label htmlFor="ats-optimized" className="text-base cursor-pointer">
                      ATS Optimization
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Optimize formatting for applicant tracking systems
                    </p>
                  </div>
                </div>
                <Switch
                  id="ats-optimized"
                  checked={atsOptimized}
                  onCheckedChange={setAtsOptimized}
                />
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-4 justify-end">
            <Button
              variant="outline"
              onClick={handlePreview}
              disabled={isPreviewing}
            >
              {isPreviewing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Eye className="h-4 w-4 mr-2" />
              )}
              Preview Resume
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Generate Resume
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="preview">
          {previewData ? (
            <div className="space-y-4">
              {atsScore && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="flex items-center justify-between">
                    <span>ATS Compatibility Score:</span>
                    <span className={`font-bold text-lg ${getATSScoreColor(atsScore.total)}`}>
                      {atsScore.total}/100
                    </span>
                  </AlertDescription>
                </Alert>
              )}
              <ResumePreview 
                data={previewData} 
                template={selectedTemplate}
                onEdit={(section, data) => {
                  // Handle inline editing
                  console.log('Edit section:', section, data)
                }}
              />
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">
                  Click "Preview Resume" to see how your resume will look
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="optimize">
          <ATSOptimization 
            targetRole={targetRole}
            currentScore={atsScore}
            onOptimize={(suggestions) => {
              // Apply optimization suggestions
              console.log('Apply optimizations:', suggestions)
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}