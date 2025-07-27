import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle2, 
  Circle, 
  AlertCircle,
  TrendingUp,
  Target,
  Award,
  BarChart3,
  Calendar,
  Clock
} from 'lucide-react';

interface CompetencyProgress {
  competencyId: string;
  competencyCode: string;
  competencyName: string;
  currentLevel: number;
  targetLevel: number;
  experienceCount: number;
  pertResponseCount: number;
  lastUpdated: string;
  nextSteps: string[];
}

interface ProgressTrackerProps {
  competencies: CompetencyProgress[];
  evrCompliant: boolean;
  totalRequired: number;
  level2Required: number;
  onViewDetails?: (competencyId: string) => void;
}

export function ProgressTracker({ 
  competencies, 
  evrCompliant, 
  totalRequired = 8,
  level2Required = 2,
  onViewDetails 
}: ProgressTrackerProps) {
  const completedCount = competencies.filter(c => c.currentLevel >= 1).length;
  const level2Count = competencies.filter(c => c.currentLevel === 2).length;
  const overallProgress = (completedCount / totalRequired) * 100;

  const getProgressColor = (current: number, target: number) => {
    const progress = (current / target) * 100;
    if (progress >= 100) return 'text-green-600';
    if (progress >= 75) return 'text-blue-600';
    if (progress >= 50) return 'text-orange-600';
    return 'text-gray-600';
  };

  const getLevelBadge = (level: number) => {
    const variants = {
      0: { variant: 'outline' as const, label: 'Not Started' },
      1: { variant: 'secondary' as const, label: 'Level 1' },
      2: { variant: 'default' as const, label: 'Level 2' }
    };
    const config = variants[level as keyof typeof variants] || variants[0];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getMilestoneStatus = (achieved: boolean) => {
    return achieved ? (
      <CheckCircle2 className="h-5 w-5 text-green-600" />
    ) : (
      <Circle className="h-5 w-5 text-gray-400" />
    );
  };

  return (
    <div className="space-y-6">
      {/* Overall Progress Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Overall Progress
              </CardTitle>
              <CardDescription>
                Your journey to EVR compliance
              </CardDescription>
            </div>
            <Badge variant={evrCompliant ? 'default' : 'secondary'} className="text-lg px-3 py-1">
              {evrCompliant ? 'EVR Ready' : 'In Progress'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Overall Completion</span>
              <span className="text-sm font-medium">{Math.round(overallProgress)}%</span>
            </div>
            <Progress value={overallProgress} className="h-3" />
            <p className="text-xs text-muted-foreground">
              {completedCount} of {totalRequired} competencies demonstrated
            </p>
          </div>

          {/* Key Milestones */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Key Milestones</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  {getMilestoneStatus(completedCount >= totalRequired)}
                  <div>
                    <p className="text-sm font-medium">Demonstrate {totalRequired} Competencies</p>
                    <p className="text-xs text-muted-foreground">
                      {completedCount} / {totalRequired} completed
                    </p>
                  </div>
                </div>
                <span className={`text-sm font-medium ${getProgressColor(completedCount, totalRequired)}`}>
                  {Math.round((completedCount / totalRequired) * 100)}%
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  {getMilestoneStatus(level2Count >= level2Required)}
                  <div>
                    <p className="text-sm font-medium">Achieve Level 2 in {level2Required} Areas</p>
                    <p className="text-xs text-muted-foreground">
                      {level2Count} / {level2Required} achieved
                    </p>
                  </div>
                </div>
                <span className={`text-sm font-medium ${getProgressColor(level2Count, level2Required)}`}>
                  {Math.round((level2Count / level2Required) * 100)}%
                </span>
              </div>
            </div>
          </div>

          {/* Time Estimate */}
          <div className="flex items-center gap-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <Clock className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-sm font-medium">Estimated Time to Completion</p>
              <p className="text-xs text-muted-foreground">
                {evrCompliant ? 'Congratulations! You\'re EVR ready!' : 
                 `Approximately ${(totalRequired - completedCount) * 2} weeks at current pace`}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Competency Progress Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Competency Progress Details
          </CardTitle>
          <CardDescription>
            Track your progress for each competency area
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {competencies.map((competency) => (
              <div 
                key={competency.competencyId}
                className="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => onViewDetails?.(competency.competencyId)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium">{competency.competencyCode}</p>
                      {getLevelBadge(competency.currentLevel)}
                    </div>
                    <p className="text-sm text-muted-foreground">{competency.competencyName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{competency.pertResponseCount} PERT Response{competency.pertResponseCount !== 1 ? 's' : ''}</p>
                    <p className="text-xs text-muted-foreground">
                      From {competency.experienceCount} experience{competency.experienceCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>

                {/* Progress to Next Level */}
                {competency.currentLevel < 2 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span>Progress to Level {competency.currentLevel + 1}</span>
                      <span>{competency.currentLevel === 0 ? '0%' : '50%'}</span>
                    </div>
                    <Progress 
                      value={competency.currentLevel === 0 ? 0 : 50} 
                      className="h-2"
                    />
                  </div>
                )}

                {/* Last Updated */}
                <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>Last updated {new Date(competency.lastUpdated).toLocaleDateString()}</span>
                </div>

                {/* Next Steps (collapsed by default) */}
                {competency.nextSteps && competency.nextSteps.length > 0 && (
                  <div className="mt-3 text-xs">
                    <p className="font-medium mb-1">Next Step:</p>
                    <p className="text-muted-foreground">{competency.nextSteps[0]}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {competencies.length === 0 && (
            <div className="text-center py-8">
              <Target className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                No competency progress tracked yet. Start by analyzing your experiences.
              </p>
              <Button className="mt-4" variant="outline">
                Analyze Experiences
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Achievement Badges */}
      {(level2Count > 0 || completedCount >= 4) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Achievements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3">
              {completedCount >= 4 && (
                <div className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                    <Target className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Halfway There</p>
                    <p className="text-xs text-muted-foreground">4+ competencies</p>
                  </div>
                </div>
              )}
              {level2Count >= 1 && (
                <div className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Advanced Proficiency</p>
                    <p className="text-xs text-muted-foreground">Level 2 achieved</p>
                  </div>
                </div>
              )}
              {evrCompliant && (
                <div className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                    <Award className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">EVR Ready</p>
                    <p className="text-xs text-muted-foreground">All requirements met</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}