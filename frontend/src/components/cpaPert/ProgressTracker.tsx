import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCPAPert } from '@/hooks/useCPAPert';
import { CompetencyReport } from '@/types/cpaPert';
import { 
  TrendingUp, 
  Award, 
  Target,
  BookOpen,
  BarChart3,
  CheckCircle2,
  Circle,
  AlertCircle
} from 'lucide-react';

interface ProgressTrackerProps {
  onSelectCompetency?: (competencyId: string) => void;
}

export function ProgressTracker({ onSelectCompetency }: ProgressTrackerProps) {
  const { getCompetencyReport, competencyFramework, loading } = useCPAPert();
  const [report, setReport] = useState<CompetencyReport | null>(null);

  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    try {
      const competencyReport = await getCompetencyReport();
      setReport(competencyReport);
    } catch (error) {
      console.error('Failed to load competency report:', error);
    }
  };

  const getCategoryIcon = (category: string) => {
    return category === 'Technical' ? <BookOpen className="h-4 w-4" /> : <Target className="h-4 w-4" />;
  };

  const getLevelBadge = (level: number) => {
    const variants: Record<number, { variant: 'default' | 'secondary' | 'outline'; label: string }> = {
      2: { variant: 'default', label: 'Level 2' },
      1: { variant: 'secondary', label: 'Level 1' },
      0: { variant: 'outline', label: 'Level 0' }
    };
    
    const config = variants[level] || variants[0];
    return <Badge variant={config.variant} className="text-xs">{config.label}</Badge>;
  };

  const getProgressIcon = (level: number) => {
    if (level === 2) return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    if (level === 1) return <AlertCircle className="h-4 w-4 text-blue-600" />;
    return <Circle className="h-4 w-4 text-gray-400" />;
  };

  if (loading && !report) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            Loading progress data...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!report) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            No progress data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const { summary, competencyDetails, developmentPlan } = report;

  // Group competencies by category
  const groupedCompetencies = competencyDetails.reduce((acc, comp) => {
    const category = comp.category || 'Other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(comp);
    return acc;
  }, {} as Record<string, typeof competencyDetails>);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Competency Progress Tracker
            </CardTitle>
            <CardDescription>
              Track your progress across all CPA competency areas
            </CardDescription>
          </div>
          <Badge variant="outline" className="gap-1">
            <BarChart3 className="h-3 w-3" />
            {summary.totalCompetencies} Competencies
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
            <p className="text-2xl font-bold text-green-600">{summary.level2Achieved}</p>
            <p className="text-xs text-muted-foreground">Level 2</p>
          </div>
          <div className="text-center p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <p className="text-2xl font-bold text-blue-600">{summary.level1Achieved}</p>
            <p className="text-xs text-muted-foreground">Level 1</p>
          </div>
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-950 rounded-lg">
            <p className="text-2xl font-bold text-gray-600">{summary.level0Only}</p>
            <p className="text-xs text-muted-foreground">Level 0</p>
          </div>
          <div className="text-center p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
            <p className="text-2xl font-bold text-purple-600">{summary.totalPERTResponses}</p>
            <p className="text-xs text-muted-foreground">Responses</p>
          </div>
        </div>

        {/* Progress Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="byCategory">By Category</TabsTrigger>
            <TabsTrigger value="development">Development Plan</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-3">
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-2">
                {competencyDetails
                  .sort((a, b) => b.current_level - a.current_level)
                  .map((comp) => (
                    <div 
                      key={comp.assessment_id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => onSelectCompetency?.(comp.competency_id)}
                    >
                      <div className="flex items-center gap-3">
                        {getProgressIcon(comp.current_level)}
                        <div>
                          <p className="font-medium text-sm">
                            {comp.competency_code} - {comp.competency_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {comp.category} • {comp.evidence_count} evidence{comp.evidence_count !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getLevelBadge(comp.current_level)}
                        {comp.current_level < comp.target_level && (
                          <span className="text-xs text-muted-foreground">
                            → Level {comp.target_level}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="byCategory" className="space-y-4">
            {Object.entries(groupedCompetencies).map(([category, competencies]) => (
              <div key={category} className="space-y-2">
                <div className="flex items-center gap-2 font-medium">
                  {getCategoryIcon(category)}
                  <span>{category} Competencies</span>
                  <Badge variant="outline" className="ml-auto">
                    {competencies.length}
                  </Badge>
                </div>
                <div className="grid gap-2">
                  {competencies.map((comp) => (
                    <div 
                      key={comp.assessment_id}
                      className="flex items-center justify-between p-2 pl-6 border rounded hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => onSelectCompetency?.(comp.competency_id)}
                    >
                      <span className="text-sm">
                        {comp.competency_code} - {comp.competency_name}
                      </span>
                      {getLevelBadge(comp.current_level)}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="development" className="space-y-4">
            {/* Immediate Actions */}
            {developmentPlan.immediate.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-red-600">Immediate Priority</h4>
                {developmentPlan.immediate.map((action, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-2 bg-red-50 dark:bg-red-950 rounded">
                    <Award className="h-4 w-4 text-red-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm">{action.action}</p>
                      <p className="text-xs text-muted-foreground">Target: {action.target}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Short Term Actions */}
            {developmentPlan.shortTerm.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-orange-600">Short Term Goals</h4>
                {developmentPlan.shortTerm.map((action, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-2 bg-orange-50 dark:bg-orange-950 rounded">
                    <Target className="h-4 w-4 text-orange-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm">{action.action}</p>
                      <p className="text-xs text-muted-foreground">Target: {action.target}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Long Term Actions */}
            {developmentPlan.longTerm.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-blue-600">Long Term Development</h4>
                {developmentPlan.longTerm.map((action, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-2 bg-blue-50 dark:bg-blue-950 rounded">
                    <TrendingUp className="h-4 w-4 text-blue-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm">{action.action}</p>
                      <p className="text-xs text-muted-foreground">Target: {action.target}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {developmentPlan.immediate.length === 0 && 
             developmentPlan.shortTerm.length === 0 && 
             developmentPlan.longTerm.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-600" />
                <p>Excellent progress! Keep maintaining your competency levels.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}