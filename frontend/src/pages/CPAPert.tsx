import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { cpaPertService } from '@/services/cpaPertService';
import { 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  BarChart3, 
  Target,
  TrendingUp,
  BookOpen,
  Award
} from 'lucide-react';

export default function CPAPert() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [complianceData, setComplianceData] = useState<any>(null);
  const [competencyReport, setCompetencyReport] = useState<any>(null);
  const [recentResponses, setRecentResponses] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [compliance, report, responses] = await Promise.all([
        cpaPertService.getComplianceCheck(),
        cpaPertService.getCompetencyReport(),
        cpaPertService.getResponses({ limit: 5 })
      ]);

      setComplianceData(compliance);
      setCompetencyReport(report);
      setRecentResponses(responses.responses || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load CPA PERT dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading CPA PERT dashboard..." />;
  if (error) return <ErrorMessage message={error} onRetry={fetchDashboardData} />;

  const isCompliant = complianceData?.status === 'compliant';
  const summary = competencyReport?.summary || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">CPA PERT Management</h1>
        <p className="text-muted-foreground mt-2">
          Track your progress towards CPA certification through the EVR route
        </p>
      </div>

      {/* Compliance Status Card */}
      <Card className={isCompliant ? 'border-green-500' : 'border-orange-500'}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {isCompliant ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-orange-600" />
              )}
              EVR Compliance Status
            </CardTitle>
            <Badge variant={isCompliant ? 'default' : 'secondary'}>
              {isCompliant ? 'Compliant' : 'In Progress'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {complianceData?.issues && complianceData.issues.length > 0 ? (
            <div className="space-y-2">
              {complianceData.issues.map((issue: any, index: number) => (
                <div key={index} className="flex items-start gap-2">
                  <AlertCircle className={`h-4 w-4 mt-0.5 ${
                    issue.severity === 'high' ? 'text-red-600' : 
                    issue.severity === 'medium' ? 'text-orange-600' : 
                    'text-yellow-600'
                  }`} />
                  <div>
                    <p className="text-sm font-medium">{issue.description}</p>
                    <p className="text-sm text-muted-foreground">{issue.recommendation}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-green-600">
              All EVR requirements are currently met. Keep up the great work!
            </p>
          )}
        </CardContent>
      </Card>

      {/* Progress Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Competencies</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalCompetencies || 0}/8</div>
            <p className="text-xs text-muted-foreground">
              Minimum 8 required
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Level 2 Achieved</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.level2Achieved || 0}/2</div>
            <p className="text-xs text-muted-foreground">
              Minimum 2 required
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">PERT Responses</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalPERTResponses || 0}</div>
            <p className="text-xs text-muted-foreground">
              Total generated
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">EVR Status</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.evrCompliant ? 'Ready' : 'Not Ready'}
            </div>
            <p className="text-xs text-muted-foreground">
              For submission
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Competency Coverage */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Competency Coverage
          </CardTitle>
          <CardDescription>
            Your progress across CPA competency areas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {competencyReport?.competencyCoverage && competencyReport.competencyCoverage.length > 0 ? (
            <div className="space-y-3">
              {competencyReport.competencyCoverage.map((comp: any) => (
                <div key={comp.competencyId} className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{comp.competencyName}</p>
                    <p className="text-xs text-muted-foreground">
                      {comp.experienceCount} experience{comp.experienceCount !== 1 ? 's' : ''} • 
                      Level {comp.averageProficiency}
                    </p>
                  </div>
                  <Badge variant={
                    comp.averageProficiency === '2' ? 'default' :
                    comp.averageProficiency === '1' ? 'secondary' :
                    'outline'
                  }>
                    Level {comp.averageProficiency}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                No competency assessments yet. Start by analyzing your experiences.
              </p>
              <Button className="mt-4" onClick={() => window.location.href = '/experiences'}>
                Go to Experiences
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

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
            <Button variant="outline" size="sm">
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {recentResponses.length > 0 ? (
            <div className="space-y-3">
              {recentResponses.map((response: any) => (
                <div key={response.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="text-sm font-medium">
                      {response.competencies?.[0] || 'Competency'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {response.wordCount} characters • Level {response.proficiencyLevel || '1'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={response.status === 'final' ? 'default' : 'secondary'}>
                      {response.status}
                    </Badge>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => window.location.href = `/cpa-pert/response/${response.id}`}
                    >
                      Edit
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No PERT responses generated yet
            </p>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <Button onClick={() => window.location.href = '/experiences'}>
          Analyze New Experience
        </Button>
        <Button variant="outline" onClick={() => window.location.href = '/cpa-pert/progress'}>
          View Progress & Compliance
        </Button>
        <Button variant="outline">
          View Competency Framework
        </Button>
      </div>
    </div>
  );
}