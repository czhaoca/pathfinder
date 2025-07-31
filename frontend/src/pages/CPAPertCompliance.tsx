import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ComplianceMonitor } from '@/components/cpaPert/ComplianceMonitor';
import { useCPAPert } from '@/hooks/useCPAPert';
import { useExperiences } from '@/hooks/useExperiences';
import { ComplianceResult, PertResponse } from '@/types/cpaPert';
import { Experience } from '@/types/experience';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle2,
  FileText,
  Target,
  TrendingUp,
  Calendar,
  Clock,
  Award,
  BarChart3,
  Download,
  ArrowRight,
  Info,
  Sparkles
} from 'lucide-react';
import { format, differenceInMonths, addMonths } from 'date-fns';
import { toast } from 'sonner';

export default function CPAPertCompliance() {
  const navigate = useNavigate();
  const { 
    checkCompliance, 
    validateRequirements, 
    getPERTResponses,
    getCompetencyReport,
    loading 
  } = useCPAPert();
  const { experiences } = useExperiences();
  
  const [compliance, setCompliance] = useState<ComplianceResult | null>(null);
  const [responses, setResponses] = useState<PertResponse[]>([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [refreshing, setRefreshing] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);

  useEffect(() => {
    loadComplianceData();
  }, []);

  const loadComplianceData = async () => {
    try {
      const [complianceResult, pertResponses] = await Promise.all([
        checkCompliance(),
        getPERTResponses(100)
      ]);
      
      setCompliance(complianceResult);
      setResponses(pertResponses || []);
    } catch (error) {
      console.error('Failed to load compliance data:', error);
      toast.error('Failed to load compliance data');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await validateRequirements();
      await loadComplianceData();
      toast.success('Compliance status refreshed');
    } catch (error) {
      toast.error('Failed to refresh compliance status');
    } finally {
      setRefreshing(false);
    }
  };

  const handleDownloadReport = async () => {
    setDownloadingReport(true);
    try {
      const report = await getCompetencyReport();
      
      // Create a formatted report
      const content = `CPA PERT Compliance Report
Generated: ${format(new Date(), 'PPP')}

COMPLIANCE STATUS: ${report.compliance.isCompliant ? 'EVR READY' : 'NOT EVR READY'}

SUMMARY
=======
Total Competencies Demonstrated: ${report.summary.totalCompetencies}/8
Level 2 Competencies: ${report.summary.level2Achieved}/2 required
Level 1 or Higher: ${report.summary.level1Achieved}
Total PERT Responses: ${report.summary.totalPERTResponses}

COMPETENCY DETAILS
==================
${report.competencyDetails.map(comp => `
${comp.competency_code} - ${comp.competency_name}
Current Level: ${comp.current_level}
Evidence Count: ${comp.evidence_count}
Category: ${comp.category}
`).join('\n')}

MISSING COMPETENCIES
====================
${report.compliance.summary.missingCompetencies.length > 0 
  ? report.compliance.summary.missingCompetencies.join('\n')
  : 'None - All requirements met'}

DEVELOPMENT PLAN
================
Immediate Actions:
${report.developmentPlan.immediate.map(action => `- ${action.action} (Target: ${action.target})`).join('\n')}

Short Term Goals:
${report.developmentPlan.shortTerm.map(action => `- ${action.action} (Target: ${action.target})`).join('\n')}

Long Term Development:
${report.developmentPlan.longTerm.map(action => `- ${action.action} (Target: ${action.target})`).join('\n')}
`;

      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CPA_PERT_Compliance_Report_${format(new Date(), 'yyyy-MM-dd')}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Compliance report downloaded');
    } catch (error) {
      toast.error('Failed to generate report');
    } finally {
      setDownloadingReport(false);
    }
  };

  // Calculate experience timeline
  const getExperienceTimeline = () => {
    if (!experiences || experiences.length === 0) return null;
    
    const activeExperiences = experiences.filter(exp => exp.status === 'active');
    if (activeExperiences.length === 0) return null;
    
    const sortedExperiences = activeExperiences
      .filter(exp => exp.startDate)
      .sort((a, b) => new Date(a.startDate!).getTime() - new Date(b.startDate!).getTime());
    
    if (sortedExperiences.length === 0) return null;
    
    const firstExperience = sortedExperiences[0];
    const lastExperience = sortedExperiences[sortedExperiences.length - 1];
    
    const startDate = new Date(firstExperience.startDate!);
    const endDate = lastExperience.endDate 
      ? new Date(lastExperience.endDate) 
      : new Date();
    
    const monthsCovered = differenceInMonths(endDate, startDate);
    const deadline = addMonths(startDate, 30);
    const monthsRemaining = differenceInMonths(deadline, new Date());
    
    return {
      startDate,
      endDate,
      deadline,
      monthsCovered,
      monthsRemaining,
      isWithinWindow: monthsCovered <= 30
    };
  };

  const timeline = getExperienceTimeline();

  if (loading && !compliance) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner message="Loading compliance data..." />
      </div>
    );
  }

  const isCompliant = compliance?.isCompliant || false;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">EVR Compliance Tracker</h1>
          <p className="text-muted-foreground mt-2">
            Monitor your progress towards CPA Experience Verification Route requirements
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
            className="gap-2"
          >
            {refreshing ? (
              <LoadingSpinner className="h-4 w-4" />
            ) : (
              <Shield className="h-4 w-4" />
            )}
            Refresh Status
          </Button>
          <Button
            onClick={() => navigate('/cpa-pert')}
            variant="outline"
          >
            Back to Dashboard
          </Button>
        </div>
      </div>

      {/* Compliance Status Card */}
      <Card className={isCompliant ? 'border-green-500' : 'border-orange-500'}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {isCompliant ? (
                <CheckCircle2 className="h-12 w-12 text-green-600" />
              ) : (
                <AlertTriangle className="h-12 w-12 text-orange-600" />
              )}
              <div>
                <h2 className="text-2xl font-bold">
                  {isCompliant ? 'EVR Ready' : 'Not EVR Ready'}
                </h2>
                <p className="text-muted-foreground">
                  {isCompliant 
                    ? 'You meet all EVR requirements' 
                    : 'Additional work needed to meet EVR requirements'}
                </p>
              </div>
            </div>
            <Button
              onClick={handleDownloadReport}
              disabled={downloadingReport}
              className="gap-2"
            >
              {downloadingReport ? (
                <LoadingSpinner className="h-4 w-4" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Download Report
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="details">Detailed Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <ComplianceMonitor
            onComplianceUpdate={setCompliance}
            onGenerateReport={handleDownloadReport}
          />
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4">
          {/* Experience Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Experience Timeline
              </CardTitle>
              <CardDescription>
                EVR requires all experiences to fall within a 30-month window
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {timeline ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Experience Window</span>
                        <Badge variant={timeline.isWithinWindow ? 'default' : 'destructive'}>
                          {timeline.monthsCovered} months
                        </Badge>
                      </div>
                      <Progress 
                        value={Math.min((timeline.monthsCovered / 30) * 100, 100)} 
                        className={timeline.isWithinWindow ? '' : 'bg-red-100'}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Time Remaining</span>
                        <Badge variant={timeline.monthsRemaining > 6 ? 'secondary' : 'destructive'}>
                          {timeline.monthsRemaining > 0 ? `${timeline.monthsRemaining} months` : 'Expired'}
                        </Badge>
                      </div>
                      <Progress 
                        value={Math.max((timeline.monthsRemaining / 30) * 100, 0)} 
                        className={timeline.monthsRemaining > 6 ? '' : 'bg-orange-100'}
                      />
                    </div>
                  </div>

                  <div className="flex items-start gap-2 p-3 bg-muted rounded-lg">
                    <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="text-sm">
                      <p>
                        <strong>First Experience:</strong> {format(timeline.startDate, 'PPP')}
                      </p>
                      <p>
                        <strong>Latest Experience:</strong> {format(timeline.endDate, 'PPP')}
                      </p>
                      <p className="font-medium mt-1">
                        <strong>EVR Deadline:</strong> {format(timeline.deadline, 'PPP')}
                      </p>
                    </div>
                  </div>

                  {!timeline.isWithinWindow && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Timeline Issue</AlertTitle>
                      <AlertDescription>
                        Your experiences span more than 30 months. Consider focusing on experiences within a 30-month window.
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              ) : (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    No experiences found. Add experiences to track your EVR timeline.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Experience Coverage */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Experience Coverage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {experiences
                  .filter(exp => exp.status === 'active')
                  .map((exp) => {
                    const expResponses = responses.filter(r => 
                      r.experience_id === exp.experienceId && r.is_current === 1
                    );
                    const coverage = expResponses.length;
                    
                    return (
                      <div key={exp.experienceId} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">{exp.title}</p>
                            <p className="text-xs text-muted-foreground">{exp.organization}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={coverage > 0 ? 'default' : 'secondary'}>
                              {coverage} competencies
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate('/cpa-pert/write', {
                                state: { experience: exp }
                              })}
                            >
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <Progress value={(coverage / 8) * 100} className="h-2" />
                      </div>
                    );
                  })}
              </div>
              
              {experiences.filter(exp => exp.status === 'active').length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-2" />
                  <p>No active experiences found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details" className="space-y-4">
          {/* Competency Gap Analysis */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Competency Gap Analysis
              </CardTitle>
              <CardDescription>
                Identify which competencies need attention to meet EVR requirements
              </CardDescription>
            </CardHeader>
            <CardContent>
              {compliance && compliance.summary.missingCompetencies.length > 0 ? (
                <div className="space-y-3">
                  {compliance.summary.missingCompetencies.map((gap, idx) => (
                    <Alert key={idx} variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>{gap}</AlertDescription>
                    </Alert>
                  ))}
                  
                  <div className="pt-4">
                    <h4 className="font-medium mb-3">Recommended Actions:</h4>
                    <div className="space-y-2">
                      <Button
                        variant="outline"
                        className="w-full justify-start gap-2"
                        onClick={() => navigate('/cpa-pert/mapping')}
                      >
                        <Sparkles className="h-4 w-4" />
                        Analyze more experiences for missing competencies
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full justify-start gap-2"
                        onClick={() => navigate('/experiences')}
                      >
                        <FileText className="h-4 w-4" />
                        Add new experiences to cover gaps
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-3" />
                  <p className="text-lg font-medium">All Competencies Covered!</p>
                  <p className="text-sm text-muted-foreground">
                    You have demonstrated all required competencies at appropriate levels.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Proficiency Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Proficiency Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[2, 1, 0].map((level) => {
                  const count = responses.filter(r => 
                    r.proficiency_level === level && r.is_current === 1
                  ).length;
                  const percentage = responses.filter(r => r.is_current === 1).length > 0
                    ? (count / responses.filter(r => r.is_current === 1).length) * 100
                    : 0;
                  
                  return (
                    <div key={level} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Award className={`h-4 w-4 ${
                            level === 2 ? 'text-green-600' :
                            level === 1 ? 'text-blue-600' :
                            'text-gray-600'
                          }`} />
                          <span className="font-medium">Level {level}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {count} competencies ({percentage.toFixed(0)}%)
                        </span>
                      </div>
                      <Progress 
                        value={percentage} 
                        className={
                          level === 2 ? 'bg-green-100' :
                          level === 1 ? 'bg-blue-100' :
                          'bg-gray-100'
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}