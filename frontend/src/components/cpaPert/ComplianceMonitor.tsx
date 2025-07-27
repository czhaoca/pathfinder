import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle2, 
  Info,
  RefreshCw,
  FileText,
  TrendingUp,
  Clock,
  Download
} from 'lucide-react';
import { ComplianceCheck } from '@/types/cpaPert';
import { format } from 'date-fns';

interface ComplianceMonitorProps {
  complianceCheck: ComplianceCheck;
  onRefreshCheck: () => Promise<void>;
  onGenerateReport?: () => void;
}

export function ComplianceMonitor({ 
  complianceCheck, 
  onRefreshCheck,
  onGenerateReport 
}: ComplianceMonitorProps) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await onRefreshCheck();
    } finally {
      setRefreshing(false);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'medium':
        return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      case 'low':
        return <Info className="h-4 w-4 text-yellow-600" />;
      default:
        return <Info className="h-4 w-4 text-blue-600" />;
    }
  };

  const getComplianceStatusBadge = (status: string) => {
    switch (status) {
      case 'compliant':
        return <Badge variant="default" className="gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Compliant
        </Badge>;
      case 'non-compliant':
        return <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          Non-Compliant
        </Badge>;
      case 'partial':
        return <Badge variant="secondary" className="gap-1">
          <Info className="h-3 w-3" />
          Partially Compliant
        </Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const isCompliant = complianceCheck.status === 'compliant';

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
                  Last checked: {format(new Date(complianceCheck.lastChecked), 'PPp')}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getComplianceStatusBadge(complianceCheck.status)}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
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
        <CardContent>
          {isCompliant ? (
            <Alert className="border-green-500">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle>Congratulations!</AlertTitle>
              <AlertDescription>
                You have met all EVR requirements and are ready to submit your application.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                The following requirements need to be addressed before you can submit your EVR application:
              </p>
              
              {/* Issues List */}
              <div className="space-y-3">
                {complianceCheck.issues.map((issue, index) => (
                  <div 
                    key={index}
                    className="flex items-start gap-3 p-3 border rounded-lg"
                  >
                    {getSeverityIcon(issue.severity)}
                    <div className="flex-1">
                      <p className="text-sm font-medium">{issue.type}</p>
                      <p className="text-sm text-muted-foreground">{issue.description}</p>
                      <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                        <strong>Recommendation:</strong> {issue.recommendation}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Compliance Requirements Checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            EVR Requirements Checklist
          </CardTitle>
          <CardDescription>
            Track your progress against all EVR requirements
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <RequirementItem
              met={true}
              title="CPA PEP Core Modules"
              description="Complete all required CPA PEP core modules"
            />
            <RequirementItem
              met={true}
              title="30 Months Experience"
              description="Accumulate 30 months of relevant professional experience"
            />
            <RequirementItem
              met={complianceCheck.issues.filter(i => i.type === 'COMPETENCY_COUNT').length === 0}
              title="8 Competency Areas"
              description="Demonstrate proficiency in at least 8 different competency areas"
            />
            <RequirementItem
              met={complianceCheck.issues.filter(i => i.type === 'LEVEL_2_COUNT').length === 0}
              title="2 Level 2 Competencies"
              description="Achieve Level 2 proficiency in at least 2 competency areas"
            />
            <RequirementItem
              met={complianceCheck.issues.filter(i => i.type === 'PERT_RESPONSES').length === 0}
              title="PERT Documentation"
              description="Complete PERT responses for all demonstrated competencies"
            />
            <RequirementItem
              met={true}
              title="Mentor Approval"
              description="Obtain approval from your designated CPA mentor"
            />
          </div>
        </CardContent>
      </Card>

      {/* Compliance Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Compliance Timeline
          </CardTitle>
          <CardDescription>
            Important dates and deadlines for your EVR application
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <TimelineItem
              date="Experience Start Date"
              value="January 2023"
              status="completed"
            />
            <TimelineItem
              date="30 Months Completion"
              value="July 2025"
              status="in-progress"
            />
            <TimelineItem
              date="Target EVR Submission"
              value="September 2025"
              status="upcoming"
            />
            <TimelineItem
              date="Expected CFE Eligibility"
              value="November 2025"
              status="upcoming"
            />
          </div>

          {/* Progress Bar */}
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Experience Progress</span>
              <span className="text-sm font-medium">24 / 30 months</span>
            </div>
            <Progress value={80} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              6 months remaining to meet experience requirement
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button 
          onClick={onGenerateReport}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Generate Compliance Report
        </Button>
        <Button variant="outline" className="gap-2">
          <TrendingUp className="h-4 w-4" />
          View Recommendations
        </Button>
      </div>
    </div>
  );
}

interface RequirementItemProps {
  met: boolean;
  title: string;
  description: string;
}

function RequirementItem({ met, title, description }: RequirementItemProps) {
  return (
    <div className="flex items-start gap-3">
      {met ? (
        <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
      ) : (
        <div className="h-5 w-5 rounded-full border-2 border-gray-300 mt-0.5" />
      )}
      <div className="flex-1">
        <p className={`text-sm font-medium ${met ? 'text-green-600' : ''}`}>
          {title}
        </p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

interface TimelineItemProps {
  date: string;
  value: string;
  status: 'completed' | 'in-progress' | 'upcoming';
}

function TimelineItem({ date, value, status }: TimelineItemProps) {
  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'in-progress':
        return <Clock className="h-5 w-5 text-blue-600" />;
      case 'upcoming':
        return <div className="h-5 w-5 rounded-full border-2 border-gray-300" />;
    }
  };

  return (
    <div className="flex items-center gap-3">
      {getStatusIcon()}
      <div className="flex-1 flex items-center justify-between">
        <span className="text-sm">{date}</span>
        <span className="text-sm font-medium">{value}</span>
      </div>
    </div>
  );
}

// Note: We need to import Progress from the UI components
function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div className={`h-2 w-full bg-gray-200 rounded-full overflow-hidden ${className}`}>
      <div 
        className="h-full bg-primary transition-all"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}