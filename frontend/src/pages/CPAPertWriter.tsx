import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { PertResponseEditor } from '@/components/cpaPert/PertResponseEditor';
import { CompetencyMapper } from '@/components/cpaPert/CompetencyMapper';
import { useExperiences } from '@/hooks/useExperiences';
import { useCPAPert } from '@/hooks/useCPAPert';
import { Experience } from '@/types/experience';
import { CompetencyMapping, PertResponse } from '@/types/cpaPert';
import { 
  FileText, 
  Save,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Target,
  Copy,
  Download,
  History,
  Award
} from 'lucide-react';
import { toast } from 'sonner';

interface LocationState {
  experience?: Experience;
  competencyMapping?: CompetencyMapping;
  mappings?: CompetencyMapping[];
}

export default function CPAPertWriter() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState;
  
  const { experiences, loading: experiencesLoading } = useExperiences();
  const { 
    getPERTResponses, 
    generatePERTResponse,
    batchGeneratePERTResponses,
    loading 
  } = useCPAPert();

  const [selectedExperience, setSelectedExperience] = useState<Experience | null>(
    state?.experience || null
  );
  const [selectedMapping, setSelectedMapping] = useState<CompetencyMapping | null>(
    state?.competencyMapping || null
  );
  const [mappings, setMappings] = useState<CompetencyMapping[]>(
    state?.mappings || []
  );
  const [existingResponses, setExistingResponses] = useState<PertResponse[]>([]);
  const [currentResponse, setCurrentResponse] = useState<PertResponse | null>(null);
  const [activeTab, setActiveTab] = useState('editor');
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);

  useEffect(() => {
    if (!selectedExperience && experiences.length > 0) {
      // If no experience selected, redirect to mapping page
      navigate('/cpa-pert/mapping');
    }
  }, [selectedExperience, experiences, navigate]);

  useEffect(() => {
    if (selectedExperience) {
      loadExistingResponses();
    }
  }, [selectedExperience]);

  const loadExistingResponses = async () => {
    if (!selectedExperience?.experienceId) return;
    
    try {
      const responses = await getPERTResponses(100, selectedExperience.experienceId);
      setExistingResponses(responses || []);
      
      // If we have a selected mapping, check if there's an existing response
      if (selectedMapping) {
        const existing = responses?.find(r => 
          r.competency_id === selectedMapping.competency_id &&
          r.is_current === 1
        );
        setCurrentResponse(existing || null);
      }
    } catch (error) {
      console.error('Failed to load existing responses:', error);
    }
  };

  const handleBatchGenerate = async () => {
    if (!selectedExperience?.experienceId || mappings.length === 0) {
      toast.error('No experience or mappings selected');
      return;
    }

    setBatchGenerating(true);
    setGenerationProgress(0);

    try {
      const competencyIds = mappings.map(m => m.competency_id);
      const responses = await batchGeneratePERTResponses(
        selectedExperience.experienceId,
        competencyIds
      );

      toast.success(`Generated ${responses.length} PERT responses`);
      await loadExistingResponses();
      setActiveTab('history');
    } catch (error) {
      toast.error('Failed to generate batch responses');
      console.error('Batch generation error:', error);
    } finally {
      setBatchGenerating(false);
      setGenerationProgress(0);
    }
  };

  const handleResponseSaved = async (response: PertResponse) => {
    setCurrentResponse(response);
    await loadExistingResponses();
    toast.success('PERT response saved successfully');
  };

  const handleSelectMapping = (mapping: CompetencyMapping) => {
    setSelectedMapping(mapping);
    
    // Check if we already have a response for this competency
    const existing = existingResponses.find(r => 
      r.competency_id === mapping.competency_id &&
      r.is_current === 1
    );
    setCurrentResponse(existing || null);
    setActiveTab('editor');
  };

  const handleSelectResponse = (response: PertResponse) => {
    setCurrentResponse(response);
    
    // Find the corresponding mapping
    const mapping = mappings.find(m => m.competency_id === response.competency_id);
    if (mapping) {
      setSelectedMapping(mapping);
    }
    setActiveTab('editor');
  };

  const downloadAllResponses = () => {
    if (existingResponses.length === 0) {
      toast.error('No responses to download');
      return;
    }

    const content = existingResponses
      .filter(r => r.is_current === 1)
      .map(r => `${r.sub_code} - ${r.sub_name} (Level ${r.proficiency_level})\n\n${r.response_text}\n\n${'-'.repeat(80)}\n`)
      .join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PERT_Responses_${selectedExperience?.title?.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Downloaded all responses');
  };

  if (experiencesLoading || !selectedExperience) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner message="Loading experience data..." />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">PERT Report Writer</h1>
          <p className="text-muted-foreground mt-2">
            Generate and edit PERT responses for your experiences
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => navigate('/cpa-pert/mapping')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Mapping
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/cpa-pert')}
          >
            Dashboard
          </Button>
        </div>
      </div>

      {/* Experience Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{selectedExperience.title}</CardTitle>
              <CardDescription>{selectedExperience.organization}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {existingResponses.filter(r => r.is_current === 1).length} / {mappings.length} Responses
              </Badge>
              {mappings.length > 0 && existingResponses.filter(r => r.is_current === 1).length === mappings.length && (
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Complete
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="competencies">Competencies</TabsTrigger>
          <TabsTrigger value="editor">PERT Editor</TabsTrigger>
          <TabsTrigger value="history">Response History</TabsTrigger>
        </TabsList>

        <TabsContent value="competencies" className="space-y-4">
          {mappings.length > 0 ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Mapped Competencies</h2>
                <Button
                  onClick={handleBatchGenerate}
                  disabled={batchGenerating || loading}
                  className="gap-2"
                >
                  {batchGenerating ? (
                    <>
                      <LoadingSpinner className="h-4 w-4" />
                      Generating ({generationProgress}/{mappings.length})...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Generate All Responses
                    </>
                  )}
                </Button>
              </div>
              <CompetencyMapper
                mappings={mappings}
                onSelectMapping={handleSelectMapping}
                existingResponses={existingResponses}
              />
            </>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Competencies Mapped</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  This experience hasn't been analyzed for competency mapping yet.
                </p>
                <Button onClick={() => navigate('/cpa-pert/mapping')}>
                  Go to Competency Mapping
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="editor">
          {selectedMapping ? (
            <PertResponseEditor
              experience={selectedExperience}
              competencyMapping={selectedMapping}
              existingResponse={currentResponse || undefined}
              onResponseSaved={handleResponseSaved}
            />
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Select a Competency</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Choose a competency from the Competencies tab to generate or edit a PERT response.
                </p>
                <Button
                  variant="outline"
                  onClick={() => setActiveTab('competencies')}
                >
                  View Competencies
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Response History</h2>
            {existingResponses.filter(r => r.is_current === 1).length > 0 && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadAllResponses}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const content = existingResponses
                      .filter(r => r.is_current === 1)
                      .map(r => r.response_text)
                      .join('\n\n');
                    navigator.clipboard.writeText(content);
                    toast.success('Copied all responses to clipboard');
                  }}
                  className="gap-2"
                >
                  <Copy className="h-4 w-4" />
                  Copy All
                </Button>
              </div>
            )}
          </div>

          {existingResponses.length > 0 ? (
            <div className="grid gap-3">
              {existingResponses
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .map((response) => (
                  <Card 
                    key={response.response_id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleSelectResponse(response)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Award className={`h-4 w-4 ${
                            response.proficiency_level === 2 ? 'text-green-600' :
                            response.proficiency_level === 1 ? 'text-blue-600' :
                            'text-gray-600'
                          }`} />
                          <span className="font-medium">
                            {response.sub_code} - {response.sub_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={response.is_current === 1 ? 'default' : 'secondary'}>
                            {response.is_current === 1 ? 'Current' : 'Historical'}
                          </Badge>
                          <Badge variant="outline">
                            Level {response.proficiency_level}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {response.response_text}
                      </p>
                      <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                        <span>{response.character_count} characters</span>
                        <span>
                          {new Date(response.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Responses Yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Generate PERT responses to see them here.
                </p>
                <Button
                  variant="outline"
                  onClick={() => setActiveTab('competencies')}
                >
                  Start Generating
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}