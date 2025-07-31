import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { ComplianceMonitor } from '@/components/cpaPert/ComplianceMonitor';
import { ProgressTracker } from '@/components/cpaPert/ProgressTracker';
import { useCPAPert } from '@/hooks/useCPAPert';
import { useExperiences } from '@/hooks/useExperiences';
import { ComplianceResult, PertResponse } from '@/types/cpaPert';
import { 
  FileText, 
  BarChart3, 
  Target,
  TrendingUp,
  BookOpen,
  Award,
  Plus,
  ArrowRight,
  Sparkles,
  Shield
} from 'lucide-react';

export default function CPAPert() {
  const navigate = useNavigate();
  const { 
    checkCompliance, 
    getCompetencyReport, 
    getPERTResponses,
    loading,
    error 
  } = useCPAPert();
  const { experiences } = useExperiences();
  
  const [compliance, setCompliance] = useState<ComplianceResult | null>(null);
  const [recentResponses, setRecentResponses] = useState<PertResponse[]>([]);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [complianceData, responses] = await Promise.all([
        checkCompliance(),
        getPERTResponses(5)
      ]);
      
      setCompliance(complianceData);
      setRecentResponses(responses || []);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    }
  };

  const handleComplianceUpdate = (newCompliance: ComplianceResult) => {
    setCompliance(newCompliance);
  };

  const handleGenerateReport = async () => {
    try {
      const report = await getCompetencyReport();
      // TODO: Implement report download/display
      console.log('Generated report:', report);
    } catch (err) {
      console.error('Failed to generate report:', err);
    }
  };

  const navigateToExperience = (experienceId?: string) => {
    if (experienceId) {
      navigate(`/cpa-pert/experience/${experienceId}`);
    } else {
      navigate('/experiences');
    }
  };

  const navigateToResponse = (responseId: string) => {
    navigate(`/cpa-pert/response/${responseId}`);
  };

  if (loading && !compliance) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner message="Loading CPA PERT dashboard..." />
      </div>
    );
  }

  if (error && !compliance) {
    return (
      <div className="container mx-auto p-6">
        <ErrorMessage message={error} onRetry={loadDashboardData} />
      </div>
    );
  }

  const isCompliant = compliance?.isCompliant || false;
  const summary = compliance?.summary || {
    totalCompetencies: 0,
    level2Count: 0,
    level1OrHigherCount: 0,
    missingCompetencies: []
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">CPA PERT Management</h1>
          <p className="text-muted-foreground mt-2">
            Track your progress towards CPA certification through the EVR route
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={() => navigate('/cpa-pert/framework')}
            className="gap-2"
          >
            <BookOpen className="h-4 w-4" />
            Framework
          </Button>
          <Button 
            onClick={() => navigate('/cpa-pert/new')}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            New Response
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Competencies</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalCompetencies}/8</div>
            <p className="text-xs text-muted-foreground">
              {8 - summary.totalCompetencies} more needed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Level 2 Achieved</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.level2Count}/2</div>
            <p className="text-xs text-muted-foreground">
              {Math.max(0, 2 - summary.level2Count)} more needed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">PERT Responses</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recentResponses.length}</div>
            <p className="text-xs text-muted-foreground">
              Recent responses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">EVR Status</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold">
                {isCompliant ? 'Ready' : 'Not Ready'}
              </div>
              {isCompliant ? (
                <Award className="h-5 w-5 text-green-600" />
              ) : (
                <Sparkles className="h-5 w-5 text-orange-600" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              For submission
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Recent PERT Responses */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent PERT Responses</CardTitle>
                  <CardDescription>
                    Your latest generated PERT responses
                  </CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate('/cpa-pert/responses')}
                >
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {recentResponses.length > 0 ? (
                <div className="space-y-3">
                  {recentResponses.map((response) => (
                    <div 
                      key={response.response_id} 
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => navigateToResponse(response.response_id)}
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {response.sub_code} - {response.sub_name || 'Competency'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {response.character_count} characters • Level {response.proficiency_level}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={response.is_current === 1 ? 'default' : 'secondary'}>
                          {response.is_current === 1 ? 'Current' : 'Historical'}
                        </Badge>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-4">
                    No PERT responses generated yet
                  </p>
                  <Button onClick={() => navigateToExperience()}>
                    Analyze Experiences
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>
                Common tasks and workflows
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Button 
                variant="outline" 
                className="justify-start gap-2 h-auto p-4"
                onClick={() => navigateToExperience()}
              >
                <BarChart3 className="h-5 w-5" />
                <div className="text-left">
                  <p className="font-medium">Analyze Experience</p>
                  <p className="text-xs text-muted-foreground">Map experiences to competencies</p>
                </div>
              </Button>
              
              <Button 
                variant="outline" 
                className="justify-start gap-2 h-auto p-4"
                onClick={() => navigate('/cpa-pert/new')}
              >
                <FileText className="h-5 w-5" />
                <div className="text-left">
                  <p className="font-medium">Generate PERT Response</p>
                  <p className="text-xs text-muted-foreground">Create new PERT narrative</p>
                </div>
              </Button>
              
              <Button 
                variant="outline" 
                className="justify-start gap-2 h-auto p-4"
                onClick={() => setActiveTab('compliance')}
              >
                <Shield className="h-5 w-5" />
                <div className="text-left">
                  <p className="font-medium">Check Compliance</p>
                  <p className="text-xs text-muted-foreground">Review EVR requirements</p>
                </div>
              </Button>
              
              <Button 
                variant="outline" 
                className="justify-start gap-2 h-auto p-4"
                onClick={handleGenerateReport}
              >
                <Award className="h-5 w-5" />
                <div className="text-left">
                  <p className="font-medium">Generate Report</p>
                  <p className="text-xs text-muted-foreground">Download progress summary</p>
                </div>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance">
          <ComplianceMonitor 
            onComplianceUpdate={handleComplianceUpdate}
            onGenerateReport={handleGenerateReport}
          />
        </TabsContent>

        <TabsContent value="progress">
          <ProgressTracker 
            onSelectCompetency={(competencyId) => navigate(`/cpa-pert/competency/${competencyId}`)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}