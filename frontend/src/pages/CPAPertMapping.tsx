import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { CompetencyMapper } from '@/components/cpaPert/CompetencyMapper';
import { useExperiences } from '@/hooks/useExperiences';
import { useCPAPert } from '@/hooks/useCPAPert';
import { Experience } from '@/types/experience';
import { CompetencyMapping } from '@/types/cpaPert';
import { 
  BarChart3, 
  FileText, 
  ArrowRight,
  Sparkles,
  Target,
  Award,
  Clock,
  Building,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';

export default function CPAPertMapping() {
  const navigate = useNavigate();
  const { experiences, loading: experiencesLoading } = useExperiences();
  const { analyzeExperience, loading: analysisLoading } = useCPAPert();
  
  const [selectedExperienceId, setSelectedExperienceId] = useState<string>('');
  const [selectedExperience, setSelectedExperience] = useState<Experience | null>(null);
  const [mappings, setMappings] = useState<CompetencyMapping[]>([]);
  const [analyzed, setAnalyzed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter experiences that haven't been analyzed yet or have high potential
  const eligibleExperiences = experiences.filter(exp => 
    exp.status === 'active' && 
    exp.description && 
    exp.description.length > 100
  );

  useEffect(() => {
    if (selectedExperienceId && experiences.length > 0) {
      const experience = experiences.find(exp => exp.experienceId === selectedExperienceId);
      setSelectedExperience(experience || null);
      setMappings([]);
      setAnalyzed(false);
      setError(null);
    }
  }, [selectedExperienceId, experiences]);

  const handleAnalyze = async () => {
    if (!selectedExperienceId) {
      setError('Please select an experience to analyze');
      return;
    }

    try {
      setError(null);
      const result = await analyzeExperience(selectedExperienceId);
      setMappings(result);
      setAnalyzed(true);
    } catch (err) {
      setError('Failed to analyze experience. Please try again.');
      console.error('Analysis error:', err);
    }
  };

  const handleSelectMapping = (mapping: CompetencyMapping) => {
    if (selectedExperience) {
      // Navigate to PERT report writer with pre-selected experience and competency
      navigate('/cpa-pert/write', {
        state: {
          experience: selectedExperience,
          competencyMapping: mapping
        }
      });
    }
  };

  const getExperienceDuration = (exp: Experience) => {
    if (!exp.startDate) return 'Duration unknown';
    const start = new Date(exp.startDate);
    const end = exp.endDate ? new Date(exp.endDate) : new Date();
    const months = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30));
    return `${months} months`;
  };

  const getExperienceIcon = (type?: string) => {
    switch (type) {
      case 'work':
        return <Building className="h-4 w-4" />;
      case 'volunteer':
        return <Award className="h-4 w-4" />;
      case 'education':
        return <FileText className="h-4 w-4" />;
      default:
        return <Target className="h-4 w-4" />;
    }
  };

  if (experiencesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner message="Loading experiences..." />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Competency Mapping</h1>
          <p className="text-muted-foreground mt-2">
            Analyze your experiences to identify CPA competency alignments
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate('/cpa-pert')}
        >
          Back to Dashboard
        </Button>
      </div>

      {/* Experience Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Select Experience to Analyze
          </CardTitle>
          <CardDescription>
            Choose an experience to analyze for CPA competency mapping
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {eligibleExperiences.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No eligible experiences found. Please add detailed experiences (100+ characters) to analyze.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <Select
                value={selectedExperienceId}
                onValueChange={setSelectedExperienceId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an experience to analyze" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleExperiences.map((exp) => (
                    <SelectItem key={exp.experienceId} value={exp.experienceId}>
                      <div className="flex items-center gap-2">
                        {getExperienceIcon(exp.type)}
                        <span>{exp.title} at {exp.organization}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedExperience && (
                <div className="p-4 bg-muted rounded-lg space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h3 className="font-medium flex items-center gap-2">
                        {getExperienceIcon(selectedExperience.type)}
                        {selectedExperience.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {selectedExperience.organization}
                      </p>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {selectedExperience.startDate && format(new Date(selectedExperience.startDate), 'MMM yyyy')}
                        {' - '}
                        {selectedExperience.endDate ? format(new Date(selectedExperience.endDate), 'MMM yyyy') : 'Present'}
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <Clock className="h-3 w-3" />
                        {getExperienceDuration(selectedExperience)}
                      </div>
                    </div>
                  </div>
                  
                  {selectedExperience.description && (
                    <div className="pt-2 border-t">
                      <p className="text-sm line-clamp-3">
                        {selectedExperience.description}
                      </p>
                    </div>
                  )}

                  {selectedExperience.achievements && selectedExperience.achievements.length > 0 && (
                    <div className="pt-2 border-t">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Key Achievements:</p>
                      <ul className="text-sm space-y-1">
                        {selectedExperience.achievements.slice(0, 2).map((achievement, idx) => (
                          <li key={idx} className="flex items-start gap-1">
                            <span className="text-muted-foreground">•</span>
                            <span className="line-clamp-1">{achievement}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <Button
                onClick={handleAnalyze}
                disabled={!selectedExperienceId || analysisLoading}
                className="w-full gap-2"
              >
                {analysisLoading ? (
                  <>
                    <LoadingSpinner className="h-4 w-4" />
                    Analyzing Experience...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Analyze for Competencies
                  </>
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <ErrorMessage 
          message={error} 
          onRetry={handleAnalyze}
        />
      )}

      {/* Analysis Results */}
      {analyzed && mappings.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Analysis Results</h2>
            <Badge variant="outline" className="gap-1">
              <Target className="h-3 w-3" />
              {mappings.length} Competencies Identified
            </Badge>
          </div>

          {/* Competency Mapper Component */}
          <CompetencyMapper
            mappings={mappings}
            onSelectMapping={handleSelectMapping}
          />

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Next Steps</CardTitle>
              <CardDescription>
                What would you like to do with these competency mappings?
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <Button
                variant="outline"
                className="justify-start gap-2 h-auto p-4"
                onClick={() => navigate('/cpa-pert/write', {
                  state: {
                    experience: selectedExperience,
                    mappings: mappings
                  }
                })}
              >
                <FileText className="h-5 w-5" />
                <div className="text-left">
                  <p className="font-medium">Generate PERT Responses</p>
                  <p className="text-xs text-muted-foreground">Create responses for all mapped competencies</p>
                </div>
              </Button>

              <Button
                variant="outline"
                className="justify-start gap-2 h-auto p-4"
                onClick={() => {
                  setSelectedExperienceId('');
                  setMappings([]);
                  setAnalyzed(false);
                }}
              >
                <BarChart3 className="h-5 w-5" />
                <div className="text-left">
                  <p className="font-medium">Analyze Another Experience</p>
                  <p className="text-xs text-muted-foreground">Map more experiences to competencies</p>
                </div>
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {analyzed && mappings.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Competencies Identified</h3>
            <p className="text-sm text-muted-foreground mb-4">
              This experience doesn't strongly align with any CPA competencies. 
              Try selecting a different experience or adding more detail to this one.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedExperienceId('');
                setAnalyzed(false);
              }}
            >
              Try Another Experience
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}