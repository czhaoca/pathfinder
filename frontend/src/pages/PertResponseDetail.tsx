import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { PertResponseEditor } from '@/components/cpaPert/PertResponseEditor';
import { cpaPertService } from '@/services/cpaPertService';
import { PertResponse } from '@/types/cpaPert';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

export default function PertResponseDetail() {
  const { responseId } = useParams<{ responseId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<PertResponse | null>(null);

  useEffect(() => {
    if (responseId) {
      fetchResponse();
    }
  }, [responseId]);

  const fetchResponse = async () => {
    try {
      setLoading(true);
      setError(null);
      // For now, we'll need to fetch all responses and find the one
      // In a real implementation, we'd have a specific endpoint
      const { responses } = await cpaPertService.getResponses();
      const found = responses.find(r => r.id === responseId);
      if (found) {
        setResponse(found);
      } else {
        setError('PERT response not found');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load PERT response');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (updates: Partial<PertResponse>) => {
    if (!response) return;
    
    try {
      const updated = await cpaPertService.updateResponse(response.id, updates);
      setResponse(updated);
      toast.success('PERT response updated successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update PERT response');
      throw error;
    }
  };

  const handleRegenerate = async () => {
    if (!response || !response.experienceId || !response.competencies?.[0]) return;
    
    try {
      setLoading(true);
      const newResponse = await cpaPertService.generateResponse({
        experienceId: response.experienceId,
        competencies: response.competencies,
        template: 'regenerate'
      });
      setResponse(newResponse);
      toast.success('PERT response regenerated successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to regenerate PERT response');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading PERT response..." />;
  if (error) return <ErrorMessage message={error} onRetry={fetchResponse} />;
  if (!response) return <ErrorMessage message="PERT response not found" />;

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
            <h1 className="text-2xl font-bold">Edit PERT Response</h1>
            <p className="text-muted-foreground">
              Response ID: {response.id}
            </p>
          </div>
        </div>
      </div>

      {/* Response Details Card */}
      <Card>
        <CardHeader>
          <CardTitle>Response Details</CardTitle>
          <CardDescription>
            Generated on {new Date(response.createdAt).toLocaleDateString()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium">Competency</p>
              <p className="text-sm text-muted-foreground">
                {response.competencies?.[0] || 'Not specified'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Proficiency Level</p>
              <p className="text-sm text-muted-foreground">
                Level {response.proficiencyLevel || 'Not specified'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Status</p>
              <p className="text-sm text-muted-foreground capitalize">
                {response.status}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Character Count</p>
              <p className="text-sm text-muted-foreground">
                {response.wordCount} / 5000
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Editor */}
      <PertResponseEditor
        response={response}
        onSave={handleSave}
        onGenerate={handleRegenerate}
        readOnly={response.status === 'submitted'}
      />

      {/* Help Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Tips for a Strong PERT Response
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="font-medium text-sm">Situation (500-800 characters)</p>
            <p className="text-sm text-muted-foreground">
              Provide context about the organization, your role, and the specific challenges or opportunities you faced.
            </p>
          </div>
          <div>
            <p className="font-medium text-sm">Task (400-600 characters)</p>
            <p className="text-sm text-muted-foreground">
              Clearly state your responsibilities and what needed to be accomplished. Be specific about your role vs team contributions.
            </p>
          </div>
          <div>
            <p className="font-medium text-sm">Action (1500-2000 characters)</p>
            <p className="text-sm text-muted-foreground">
              Detail the specific actions YOU took. Include technical skills, analysis methods, tools used, and decision-making process.
            </p>
          </div>
          <div>
            <p className="font-medium text-sm">Result (800-1000 characters)</p>
            <p className="text-sm text-muted-foreground">
              Quantify the impact with specific metrics. Include percentages, dollar amounts, time savings, or other measurable improvements.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}