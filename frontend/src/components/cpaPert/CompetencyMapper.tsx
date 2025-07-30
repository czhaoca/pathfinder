import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { useCPAPert } from '@/hooks/useCPAPert';
import { Experience } from '@/types/experience';
import { CompetencyMapping } from '@/types/cpaPert';
import { 
  Target, 
  CheckCircle2, 
  AlertCircle,
  Sparkles,
  ChevronRight,
  Brain,
  BookOpen
} from 'lucide-react';

interface CompetencyMapperProps {
  experience: Experience;
  onMappingComplete?: (mappings: CompetencyMapping[]) => void;
  onGeneratePERT?: (competencyId: string) => void;
}

export function CompetencyMapper({ experience, onMappingComplete, onGeneratePERT }: CompetencyMapperProps) {
  const { 
    analyzeExperience, 
    getCompetencyMapping,
    loading,
    error 
  } = useCPAPert();
  
  const [mappings, setMappings] = useState<CompetencyMapping[]>([]);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  useEffect(() => {
    if (experience.experienceId) {
      fetchExistingMapping();
    }
  }, [experience.experienceId]);

  const fetchExistingMapping = async () => {
    if (!experience.experienceId) return;
    
    try {
      const existingMappings = await getCompetencyMapping(experience.experienceId);
      if (existingMappings && existingMappings.length > 0) {
        setMappings(existingMappings);
        setHasAnalyzed(true);
      }
    } catch (err) {
      // No existing mapping is fine
      console.log('No existing mappings found');
    }
  };

  const handleAnalyze = async () => {
    if (!experience.experienceId) return;
    
    try {
      const result = await analyzeExperience(experience.experienceId);
      setMappings(result.mappings);
      setHasAnalyzed(true);
      
      if (onMappingComplete) {
        onMappingComplete(result.mappings);
      }
    } catch (err) {
      console.error('Analysis failed:', err);
    }
  };

  const getRelevanceColor = (score: number) => {
    if (score >= 0.9) return 'text-green-600';
    if (score >= 0.8) return 'text-blue-600';
    if (score >= 0.7) return 'text-orange-600';
    return 'text-gray-600';
  };

  const getRelevanceBadgeVariant = (score: number): 'default' | 'secondary' | 'outline' => {
    if (score >= 0.9) return 'default';
    if (score >= 0.8) return 'secondary';
    return 'outline';
  };

  if (loading && !hasAnalyzed) {
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
          <Button 
            onClick={handleAnalyze} 
            disabled={loading}
            variant={hasAnalyzed ? 'outline' : 'default'}
            className="gap-2"
          >
            {loading ? (
              <>
                <LoadingSpinner className="h-4 w-4" />
                Analyzing...
              </>
            ) : (
              <>
                <Brain className="h-4 w-4" />
                {hasAnalyzed ? 'Re-analyze' : 'Analyze'}
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <ErrorMessage message={error} onRetry={handleAnalyze} />
        )}

        {!hasAnalyzed && !error && (
          <div className="text-center py-8">
            <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">
              Click "Analyze" to discover which CPA competencies this experience demonstrates
            </p>
          </div>
        )}

        {hasAnalyzed && mappings.length > 0 && (
          <div className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-muted rounded-lg">
                <p className="text-2xl font-bold">{mappings.length}</p>
                <p className="text-xs text-muted-foreground">Competencies</p>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <p className="text-2xl font-bold">
                  {mappings.filter(m => m.relevance_score >= 0.9).length}
                </p>
                <p className="text-xs text-muted-foreground">Strong Matches</p>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <p className="text-2xl font-bold">
                  {Math.round(mappings.reduce((sum, m) => sum + m.relevance_score, 0) / mappings.length * 100)}%
                </p>
                <p className="text-xs text-muted-foreground">Avg. Relevance</p>
              </div>
            </div>

            {/* Mapped Competencies */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Mapped Competencies
              </h4>
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {mappings
                    .sort((a, b) => b.relevance_score - a.relevance_score)
                    .map((mapping) => (
                      <div 
                        key={mapping.mapping_id} 
                        className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="mt-0.5">
                          {mapping.relevance_score >= 0.9 ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          ) : mapping.relevance_score >= 0.8 ? (
                            <AlertCircle className="h-5 w-5 text-blue-600" />
                          ) : (
                            <AlertCircle className="h-5 w-5 text-orange-600" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-sm">
                              {mapping.sub_code} - {mapping.sub_name}
                            </p>
                            <Badge variant={getRelevanceBadgeVariant(mapping.relevance_score)}>
                              {Math.round(mapping.relevance_score * 100)}% match
                            </Badge>
                            {mapping.category && (
                              <Badge variant="outline" className="text-xs">
                                {mapping.category}
                              </Badge>
                            )}
                          </div>
                          {mapping.evidence_extracted && (
                            <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                              {mapping.evidence_extracted}
                            </p>
                          )}
                          <div className="flex items-center gap-2">
                            <span className={`text-xs ${getRelevanceColor(mapping.relevance_score)}`}>
                              {mapping.mapping_method === 'AI_ASSISTED' ? 'AI Analysis' : 'Manual'}
                            </span>
                            {mapping.is_validated === 1 && (
                              <Badge variant="outline" className="text-xs">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Validated
                              </Badge>
                            )}
                          </div>
                        </div>
                        {onGeneratePERT && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => onGeneratePERT(mapping.competency_id)}
                            className="mt-0.5"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                </div>
              </ScrollArea>
            </div>

            {/* Analysis Tips */}
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Analysis Tips
              </h4>
              <ul className="text-xs space-y-1">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-400">•</span>
                  <span>Strong matches (90%+) are excellent candidates for PERT responses</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-400">•</span>
                  <span>Consider adding more detail to strengthen moderate matches (70-89%)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-400">•</span>
                  <span>Focus on technical competencies for EVR compliance</span>
                </li>
              </ul>
            </div>
          </div>
        )}

        {hasAnalyzed && mappings.length === 0 && (
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">
              No competency mappings found for this experience.
            </p>
            <p className="text-xs text-muted-foreground">
              Try adding more detail about your responsibilities and achievements.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}