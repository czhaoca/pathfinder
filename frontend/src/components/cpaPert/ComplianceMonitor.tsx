import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useCPAPert } from '@/hooks/useCPAPert';
import { ComplianceResult } from '@/types/cpaPert';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle2, 
  Info,
  RefreshCw,
  FileText,
  TrendingUp,
  Clock,
  Download,
  Target,
  Award
} from 'lucide-react';
import { format } from 'date-fns';

interface ComplianceMonitorProps {
  onComplianceUpdate?: (compliance: ComplianceResult) => void;
  onGenerateReport?: () => void;
}

export function ComplianceMonitor({ 
  onComplianceUpdate,
  onGenerateReport 
}: ComplianceMonitorProps) {
  const { checkCompliance, validateRequirements, loading } = useCPAPert();
  const [compliance, setCompliance] = useState<ComplianceResult | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadCompliance();
  }, []);

  const loadCompliance = async () => {
    try {
      const result = await checkCompliance();
      setCompliance(result);
      if (onComplianceUpdate) {
        onComplianceUpdate(result);
      }
    } catch (error) {
      console.error('Failed to load compliance:', error);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      const result = await validateRequirements();
      const complianceResult = await checkCompliance();
      setCompliance(complianceResult);
      if (onComplianceUpdate) {
        onComplianceUpdate(complianceResult);
      }
    } finally {
      setRefreshing(false);
    }
  };

  const getComplianceStatusBadge = (isCompliant: boolean) => {
    if (isCompliant) {
      return (
        <Badge variant="default" className="gap-1">
          <CheckCircle2 className="h-3 w-3" />
          EVR Ready
        </Badge>
      );
    }
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="h-3 w-3" />
        Not Ready
      </Badge>
    );
  };

  const getProgressPercentage = () => {
    if (!compliance) return 0;
    const { totalCompetencies } = compliance.summary;
    // EVR requires at least 8 competencies
    return Math.min((totalCompetencies / 8) * 100, 100);
  };

  const getLevel2Progress = () => {
    if (!compliance) return 0;
    const { level2Count } = compliance.summary;
    // EVR requires at least 2 level 2 competencies
    return Math.min((level2Count / 2) * 100, 100);
  };

  if (loading && !compliance) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading compliance status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!compliance) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Unable to load compliance status. Please try again.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const { isCompliant, summary, complianceCheck } = compliance;

  return (
    <div className="space-y-6">
      {/* Compliance Status Overview */}
      <Card className={isCompliant ? 'border-green-500' : 'border-orange-500'}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className={`h-6 w-6 ${isCompliant ? 'text-green-600' : 'text-orange-600'}`} />
              <div>
                <CardTitle>EVR Compliance Status</CardTitle>
                <CardDescription>
                  Last checked: {format(new Date(complianceCheck.created_at), 'PPp')}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getComplianceStatusBadge(isCompliant)}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing || loading}
              >
                {refreshing ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress Overview */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Total Competencies</span>
                <span className="text-sm text-muted-foreground">
                  {summary.totalCompetencies} / 8 required
                </span>
              </div>
              <Progress value={getProgressPercentage()} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Level 2 Competencies</span>
                <span className="text-sm text-muted-foreground">
                  {summary.level2Count} / 2 required
                </span>
              </div>
              <Progress value={getLevel2Progress()} className="h-2" />
            </div>
          </div>

          {/* Detailed Statistics */}
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold">{summary.totalCompetencies}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{summary.level2Count}</p>
              <p className="text-xs text-muted-foreground">Level 2</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{summary.level1OrHigherCount}</p>
              <p className="text-xs text-muted-foreground">Level 1+</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-600">
                {summary.totalCompetencies - summary.level1OrHigherCount}
              </p>
              <p className="text-xs text-muted-foreground">Level 0</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Requirements Checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            EVR Requirements Checklist
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            {summary.totalCompetencies >= 8 ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
            )}
            <div className="flex-1">
              <p className="font-medium text-sm">Minimum 8 Competency Areas</p>
              <p className="text-xs text-muted-foreground">
                Currently demonstrating {summary.totalCompetencies} competency areas
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            {summary.level2Count >= 2 ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
            )}
            <div className="flex-1">
              <p className="font-medium text-sm">Minimum 2 Level 2 Competencies</p>
              <p className="text-xs text-muted-foreground">
                Currently have {summary.level2Count} competencies at Level 2
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            {summary.level1OrHigherCount >= 8 ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
            )}
            <div className="flex-1">
              <p className="font-medium text-sm">All 8 Areas at Level 1 or Higher</p>
              <p className="text-xs text-muted-foreground">
                Currently have {summary.level1OrHigherCount} competencies at Level 1 or higher
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-sm">30-Month Experience Window</p>
              <p className="text-xs text-muted-foreground">
                Ensure all experiences fall within the required timeframe
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Issues and Recommendations */}
      {summary.missingCompetencies.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Action Required</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 space-y-1">
              {summary.missingCompetencies.map((issue, idx) => (
                <li key={idx} className="text-sm">• {issue}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Recommendations */}
      {complianceCheck.recommendations && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {JSON.parse(complianceCheck.recommendations).map((rec: string, idx: number) => (
                <li key={idx} className="flex items-start gap-2">
                  <Award className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">{rec}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end gap-2">
        {onGenerateReport && (
          <Button
            variant="outline"
            onClick={onGenerateReport}
            className="gap-2"
          >
            <FileText className="h-4 w-4" />
            Generate Report
          </Button>
        )}
        <Button
          variant="default"
          onClick={() => window.print()}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Download Summary
        </Button>
      </div>
    </div>
  );
}