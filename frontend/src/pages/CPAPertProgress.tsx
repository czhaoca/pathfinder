import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { ProgressTracker } from '@/components/cpaPert/ProgressTracker';
import { ComplianceMonitor } from '@/components/cpaPert/ComplianceMonitor';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cpaPertService } from '@/services/cpaPertService';
import { ArrowLeft, FileText, Download } from 'lucide-react';
import { toast } from 'sonner';

export default function CPAPertProgress() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [competencyProgress, setCompetencyProgress] = useState<any[]>([]);
  const [complianceCheck, setComplianceCheck] = useState<any>(null);
  const [competencyReport, setCompetencyReport] = useState<any>(null);

  useEffect(() => {
    fetchProgressData();
  }, []);

  const fetchProgressData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [compliance, report] = await Promise.all([
        cpaPertService.getComplianceCheck(),
        cpaPertService.getCompetencyReport()
      ]);

      setComplianceCheck(compliance);
      setCompetencyReport(report);

      // Transform competency coverage to progress format
      const progress = report.competencyCoverage?.map((comp: any) => ({
        competencyId: comp.competencyId,
        competencyCode: comp.competencyId, // This would be mapped from the actual data
        competencyName: comp.competencyName,
        currentLevel: parseInt(comp.averageProficiency) || 0,
        targetLevel: 2,
        experienceCount: comp.experienceCount,
        pertResponseCount: comp.experienceCount, // This would come from actual PERT response count
        lastUpdated: comp.lastDemonstrated || new Date().toISOString(),
        nextSteps: report.recommendations || []
      })) || [];

      setCompetencyProgress(progress);
    } catch (err: any) {
      setError(err.message || 'Failed to load progress data');
    } finally {
      setLoading(false);
    }
  };

  const refreshComplianceCheck = async () => {
    try {
      const result = await cpaPertService.validateRequirements({});
      setComplianceCheck(result);
      toast.success('Compliance check updated');
    } catch (err: any) {
      toast.error('Failed to refresh compliance check');
    }
  };

  const generateComplianceReport = async () => {
    try {
      // In a real implementation, this would generate a PDF report
      toast.success('Generating compliance report...');
      
      // For now, we'll just download the JSON data
      const reportData = {
        generatedAt: new Date().toISOString(),
        complianceStatus: complianceCheck,
        competencyProgress: competencyProgress,
        summary: competencyReport?.summary
      };

      const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CPA_PERT_Compliance_Report_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error('Failed to generate report');
    }
  };

  const viewCompetencyDetails = (competencyId: string) => {
    // Navigate to a detailed view of the competency
    navigate(`/cpa-pert/competency/${competencyId}`);
  };

  if (loading) return <LoadingSpinner message="Loading progress data..." />;
  if (error) return <ErrorMessage message={error} onRetry={fetchProgressData} />;

  const isEvrCompliant = complianceCheck?.status === 'compliant' || false;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/cpa-pert')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div>
            <h1 className="text-2xl font-bold">CPA PERT Progress & Compliance</h1>
            <p className="text-muted-foreground">
              Track your journey to EVR certification
            </p>
          </div>
        </div>
        <Button
          onClick={generateComplianceReport}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Export Report
        </Button>
      </div>

      {/* Tabs for Progress and Compliance */}
      <Tabs defaultValue="progress" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="progress">Progress Tracking</TabsTrigger>
          <TabsTrigger value="compliance">Compliance Monitoring</TabsTrigger>
        </TabsList>

        <TabsContent value="progress" className="mt-6">
          <ProgressTracker
            competencies={competencyProgress}
            evrCompliant={isEvrCompliant}
            totalRequired={8}
            level2Required={2}
            onViewDetails={viewCompetencyDetails}
          />
        </TabsContent>

        <TabsContent value="compliance" className="mt-6">
          <ComplianceMonitor
            complianceCheck={complianceCheck}
            onRefreshCheck={refreshComplianceCheck}
            onGenerateReport={generateComplianceReport}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}