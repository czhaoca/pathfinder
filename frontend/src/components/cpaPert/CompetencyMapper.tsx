import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { cpaPertService } from '@/services/cpaPertService';
import { Experience } from '@/types/experience';
import { CompetencyMapping } from '@/types/cpaPert';
import { 
  Target, 
  CheckCircle2, 
  AlertCircle,
  Sparkles,
  ChevronRight,
  Brain
} from 'lucide-react';

interface CompetencyMapperProps {
  experience: Experience;
  onMappingComplete?: (mapping: CompetencyMapping) => void;
}

export function CompetencyMapper({ experience, onMappingComplete }: CompetencyMapperProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapping, setMapping] = useState<CompetencyMapping | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    fetchExistingMapping();
  }, [experience.experienceId]);

  const fetchExistingMapping = async () => {
    try {
      setLoading(true);
      const existingMapping = await cpaPertService.getCompetencyMapping(experience.experienceId!);
      setMapping(existingMapping);
    } catch (err) {
      // No existing mapping is fine
      setMapping(null);
    } finally {
      setLoading(false);
    }
  };

  const analyzeExperience = async () => {
    try {
      setAnalyzing(true);
      setError(null);
      
      const result = await cpaPertService.analyzeExperience({
        experienceId: experience.experienceId!,
        title: experience.title,
        organization: experience.organization,
        description: experience.description,
        skills: experience.extractedSkills,
        achievements: experience.keyHighlights
      });
      
      setMapping(result);
      if (onMappingComplete) {
        onMappingComplete(result);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to analyze experience');
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading competency analysis..." />;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Competency Analysis
            </CardTitle>
            <CardDescription>
              AI-powered mapping to CPA competency framework
            </CardDescription>
          </div>
          {!mapping && (
            <Button 
              onClick={analyzeExperience} 
              disabled={analyzing}
              className="gap-2"
            >
              {analyzing ? (
                <>
                  <LoadingSpinner className="h-4 w-4" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4" />
                  Analyze
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <ErrorMessage message={error} onRetry={analyzeExperience} />
        )}

        {!mapping && !error && (
          <div className="text-center py-8">
            <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">
              Click "Analyze" to discover which CPA competencies this experience demonstrates
            </p>
          </div>
        )}

        {mapping && (
          <div className="space-y-4">
            {/* Overall Match Score */}
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="text-sm font-medium">Overall Match Score</p>
                <p className="text-xs text-muted-foreground">
                  Based on {mapping.competencies.length} competencies identified
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Progress value={mapping.overallMatch * 100} className="w-24" />
                <span className="text-lg font-bold">{Math.round(mapping.overallMatch * 100)}%</span>
              </div>
            </div>

            {/* Mapped Competencies */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Mapped Competencies</h4>
              {mapping.competencies.map((comp) => (
                <div 
                  key={comp.id} 
                  className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="mt-0.5">
                    {comp.relevance >= 0.8 ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-orange-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm">{comp.name}</p>
                      <Badge variant={comp.relevance >= 0.8 ? 'default' : 'secondary'}>
                        {Math.round(comp.relevance * 100)}% match
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      {comp.description}
                    </p>
                    {comp.matchedSkills && comp.matchedSkills.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {comp.matchedSkills.map((skill, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="mt-0.5"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Suggestions */}
            {mapping.suggestions && mapping.suggestions.length > 0 && (
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <h4 className="text-sm font-medium mb-2">Suggestions</h4>
                <ul className="text-xs space-y-1">
                  {mapping.suggestions.map((suggestion, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-blue-600 dark:text-blue-400">•</span>
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Re-analyze Button */}
            <div className="flex justify-end mt-4">
              <Button 
                variant="outline" 
                size="sm"
                onClick={analyzeExperience}
                disabled={analyzing}
              >
                Re-analyze
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}