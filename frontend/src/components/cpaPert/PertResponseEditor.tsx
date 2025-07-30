import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { PertResponse, CompetencyMapping } from '@/types/cpaPert';
import { Experience } from '@/types/experience';
import { useCPAPert } from '@/hooks/useCPAPert';
import { 
  Save, 
  Copy, 
  Download, 
  AlertCircle, 
  CheckCircle2,
  FileText,
  Target,
  Sparkles,
  RotateCcw,
  Award
} from 'lucide-react';
import { toast } from 'sonner';

interface PertResponseEditorProps {
  experience: Experience;
  competencyMapping?: CompetencyMapping;
  existingResponse?: PertResponse;
  onResponseSaved?: (response: PertResponse) => void;
  readOnly?: boolean;
}

export function PertResponseEditor({ 
  experience,
  competencyMapping,
  existingResponse, 
  onResponseSaved,
  readOnly = false 
}: PertResponseEditorProps) {
  const { generatePERTResponse, updatePERTResponse, loading } = useCPAPert();
  
  const [selectedCompetency, setSelectedCompetency] = useState<string>(
    competencyMapping?.competency_id || ''
  );
  const [proficiencyLevel, setProficiencyLevel] = useState<0 | 1 | 2>(
    existingResponse?.proficiency_level || 1
  );
  
  const [sections, setSections] = useState({
    situation: existingResponse?.situation_text || '',
    task: existingResponse?.task_text || '',
    action: existingResponse?.action_text || '',
    result: existingResponse?.result_text || ''
  });
  
  const [fullResponse, setFullResponse] = useState(existingResponse?.response_text || '');
  const [quantifiedImpact, setQuantifiedImpact] = useState(existingResponse?.quantified_impact || '');
  const [characterCount, setCharacterCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [viewMode, setViewMode] = useState<'structured' | 'full'>('structured');

  const MAX_CHARACTERS = 5000;
  const SECTION_LIMITS = {
    situation: 800,
    task: 600,
    action: 2000,
    result: 1000
  };

  useEffect(() => {
    if (existingResponse) {
      setSections({
        situation: existingResponse.situation_text || '',
        task: existingResponse.task_text || '',
        action: existingResponse.action_text || '',
        result: existingResponse.result_text || ''
      });
      setFullResponse(existingResponse.response_text || '');
      setQuantifiedImpact(existingResponse.quantified_impact || '');
      setCharacterCount(existingResponse.character_count || 0);
      setSelectedCompetency(existingResponse.competency_id);
      setProficiencyLevel(existingResponse.proficiency_level);
    }
  }, [existingResponse]);

  const updateSection = (section: keyof typeof sections, value: string) => {
    const newSections = { ...sections, [section]: value };
    setSections(newSections);
    
    // Rebuild full content
    const newFullResponse = `SITUATION:\n${newSections.situation}\n\nTASK:\n${newSections.task}\n\nACTION:\n${newSections.action}\n\nRESULT:\n${newSections.result}`;
    setFullResponse(newFullResponse);
    setCharacterCount(newFullResponse.length);
    setIsDirty(true);
  };

  const updateFullResponse = (value: string) => {
    setFullResponse(value);
    setCharacterCount(value.length);
    setIsDirty(true);
    
    // Try to parse sections from full text
    const situationMatch = value.match(/SITUATION:\s*([\s\S]*?)(?=TASK:|$)/i);
    const taskMatch = value.match(/TASK:\s*([\s\S]*?)(?=ACTION:|$)/i);
    const actionMatch = value.match(/ACTION:\s*([\s\S]*?)(?=RESULT:|$)/i);
    const resultMatch = value.match(/RESULT:\s*([\s\S]*?)$/i);
    
    setSections({
      situation: situationMatch?.[1]?.trim() || '',
      task: taskMatch?.[1]?.trim() || '',
      action: actionMatch?.[1]?.trim() || '',
      result: resultMatch?.[1]?.trim() || ''
    });
  };

  const handleGenerate = async () => {
    if (!experience.experienceId || !selectedCompetency) {
      toast.error('Please select a competency');
      return;
    }

    try {
      const response = await generatePERTResponse(
        experience.experienceId,
        selectedCompetency,
        proficiencyLevel
      );
      
      setSections({
        situation: response.situation_text || '',
        task: response.task_text || '',
        action: response.action_text || '',
        result: response.result_text || ''
      });
      setFullResponse(response.response_text);
      setQuantifiedImpact(response.quantified_impact || '');
      setCharacterCount(response.character_count);
      setIsDirty(false);
      
      if (onResponseSaved) {
        onResponseSaved(response);
      }
    } catch (error) {
      console.error('Failed to generate PERT response:', error);
    }
  };

  const handleSave = async () => {
    if (!existingResponse?.response_id) {
      toast.error('No response to update');
      return;
    }
    
    if (characterCount > MAX_CHARACTERS) {
      toast.error(`Response exceeds ${MAX_CHARACTERS} character limit`);
      return;
    }

    try {
      setSaving(true);
      const updatedResponse = await updatePERTResponse(existingResponse.response_id, {
        responseText: fullResponse,
        situationText: sections.situation,
        taskText: sections.task,
        actionText: sections.action,
        resultText: sections.result,
        quantifiedImpact: quantifiedImpact
      });
      
      setIsDirty(false);
      if (onResponseSaved) {
        onResponseSaved(updatedResponse);
      }
    } catch (error) {
      console.error('Failed to save PERT response:', error);
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(fullResponse);
    toast.success('Copied to clipboard');
  };

  const downloadAsText = () => {
    const competencyCode = competencyMapping?.sub_code || selectedCompetency;
    const blob = new Blob([fullResponse], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PERT_Response_${competencyCode}_Level${proficiencyLevel}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Downloaded successfully');
  };

  const getCharacterCountColor = () => {
    if (characterCount > MAX_CHARACTERS) return 'text-red-600';
    if (characterCount > MAX_CHARACTERS * 0.9) return 'text-orange-600';
    return 'text-green-600';
  };

  const getSectionCharacterCountColor = (section: keyof typeof sections) => {
    const count = sections[section].length;
    const limit = SECTION_LIMITS[section];
    if (count > limit) return 'text-red-600';
    if (count > limit * 0.9) return 'text-orange-600';
    return 'text-muted-foreground';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              PERT Response Editor
            </CardTitle>
            <CardDescription>
              Generate and edit your PERT response using the STAR method
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {competencyMapping && (
              <Badge variant="outline">
                {competencyMapping.sub_code} - {competencyMapping.sub_name}
              </Badge>
            )}
            <Badge variant="secondary">
              Level {proficiencyLevel}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Generation Controls */}
        {!existingResponse && (
          <div className="flex items-end gap-4 p-4 bg-muted rounded-lg">
            <div className="flex-1">
              <Label htmlFor="competency">Competency</Label>
              <Input
                id="competency"
                value={selectedCompetency}
                onChange={(e) => setSelectedCompetency(e.target.value)}
                placeholder="Enter competency code (e.g., FR1)"
                disabled={!!competencyMapping}
              />
            </div>
            <div className="w-32">
              <Label htmlFor="level">Proficiency Level</Label>
              <Select
                value={proficiencyLevel.toString()}
                onValueChange={(value) => setProficiencyLevel(parseInt(value) as 0 | 1 | 2)}
              >
                <SelectTrigger id="level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Level 0</SelectItem>
                  <SelectItem value="1">Level 1</SelectItem>
                  <SelectItem value="2">Level 2</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={handleGenerate}
              disabled={loading || !selectedCompetency}
              className="gap-2"
            >
              {loading ? (
                <>
                  <LoadingSpinner className="h-4 w-4" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate
                </>
              )}
            </Button>
          </div>
        )}

        {/* Character Count Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Total Character Count</Label>
            <span className={`text-sm font-medium ${getCharacterCountColor()}`}>
              {characterCount} / {MAX_CHARACTERS}
            </span>
          </div>
          <Progress 
            value={(characterCount / MAX_CHARACTERS) * 100} 
            className={characterCount > MAX_CHARACTERS ? 'bg-red-100' : ''}
          />
          {characterCount > MAX_CHARACTERS && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Response exceeds the {MAX_CHARACTERS} character limit by {characterCount - MAX_CHARACTERS} characters
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Editor Tabs */}
        {(fullResponse || existingResponse) && (
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'structured' | 'full')} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="structured">Structured Editor</TabsTrigger>
              <TabsTrigger value="full">Full Text</TabsTrigger>
            </TabsList>

            <TabsContent value="structured" className="space-y-4">
              {/* Situation Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="situation">
                    Situation <span className="text-xs text-muted-foreground">(Context & Challenges)</span>
                  </Label>
                  <span className={`text-xs ${getSectionCharacterCountColor('situation')}`}>
                    {sections.situation.length} / {SECTION_LIMITS.situation}
                  </span>
                </div>
                <Textarea
                  id="situation"
                  value={sections.situation}
                  onChange={(e) => updateSection('situation', e.target.value)}
                  placeholder="Describe the business context, environment, and specific challenges..."
                  className="min-h-[120px]"
                  disabled={readOnly}
                />
              </div>

              {/* Task Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="task">
                    Task <span className="text-xs text-muted-foreground">(Responsibilities & Objectives)</span>
                  </Label>
                  <span className={`text-xs ${getSectionCharacterCountColor('task')}`}>
                    {sections.task.length} / {SECTION_LIMITS.task}
                  </span>
                </div>
                <Textarea
                  id="task"
                  value={sections.task}
                  onChange={(e) => updateSection('task', e.target.value)}
                  placeholder="Explain your specific responsibilities and what needed to be accomplished..."
                  className="min-h-[100px]"
                  disabled={readOnly}
                />
              </div>

              {/* Action Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="action">
                    Action <span className="text-xs text-muted-foreground">(Your Specific Actions)</span>
                  </Label>
                  <span className={`text-xs ${getSectionCharacterCountColor('action')}`}>
                    {sections.action.length} / {SECTION_LIMITS.action}
                  </span>
                </div>
                <Textarea
                  id="action"
                  value={sections.action}
                  onChange={(e) => updateSection('action', e.target.value)}
                  placeholder="Detail the specific actions YOU took to demonstrate this competency..."
                  className="min-h-[200px]"
                  disabled={readOnly}
                />
              </div>

              {/* Result Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="result">
                    Result <span className="text-xs text-muted-foreground">(Quantified Outcomes)</span>
                  </Label>
                  <span className={`text-xs ${getSectionCharacterCountColor('result')}`}>
                    {sections.result.length} / {SECTION_LIMITS.result}
                  </span>
                </div>
                <Textarea
                  id="result"
                  value={sections.result}
                  onChange={(e) => updateSection('result', e.target.value)}
                  placeholder="Quantify the outcomes and business impact of your actions..."
                  className="min-h-[120px]"
                  disabled={readOnly}
                />
              </div>

              {/* Quantified Impact */}
              <div className="space-y-2">
                <Label htmlFor="impact">
                  Quantified Impact <span className="text-xs text-muted-foreground">(Key Metrics)</span>
                </Label>
                <Textarea
                  id="impact"
                  value={quantifiedImpact}
                  onChange={(e) => {
                    setQuantifiedImpact(e.target.value);
                    setIsDirty(true);
                  }}
                  placeholder="List 2-3 specific quantified achievements (e.g., Reduced costs by 25%, Saved 120 hours monthly)"
                  className="min-h-[60px]"
                  disabled={readOnly}
                />
              </div>
            </TabsContent>

            <TabsContent value="full">
              <Textarea
                value={fullResponse}
                onChange={(e) => updateFullResponse(e.target.value)}
                placeholder="Edit the full PERT response..."
                className="min-h-[500px] font-mono text-sm"
                disabled={readOnly}
              />
            </TabsContent>
          </Tabs>
        )}

        {/* Proficiency Level Guide */}
        <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950">
          <Award className="h-4 w-4" />
          <AlertDescription>
            <strong>Level {proficiencyLevel} Expectations:</strong>{' '}
            {proficiencyLevel === 0 && 'Basic understanding and application under supervision'}
            {proficiencyLevel === 1 && 'Independent application with moderate complexity'}
            {proficiencyLevel === 2 && 'Advanced application with leadership and strategic impact'}
          </AlertDescription>
        </Alert>

        {/* Action Buttons */}
        {(fullResponse || existingResponse) && (
          <div className="flex items-center justify-between pt-4">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={copyToClipboard}
                disabled={!fullResponse}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadAsText}
                disabled={!fullResponse}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              {existingResponse && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerate}
                  disabled={loading}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Regenerate
                </Button>
              )}
            </div>
            
            {!readOnly && existingResponse && (
              <div className="flex gap-2">
                {isDirty && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSections({
                        situation: existingResponse.situation_text || '',
                        task: existingResponse.task_text || '',
                        action: existingResponse.action_text || '',
                        result: existingResponse.result_text || ''
                      });
                      setFullResponse(existingResponse.response_text || '');
                      setQuantifiedImpact(existingResponse.quantified_impact || '');
                      setCharacterCount(existingResponse.character_count || 0);
                      setIsDirty(false);
                    }}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={handleSave}
                  disabled={saving || !isDirty || loading}
                >
                  {saving ? (
                    <LoadingSpinner className="h-4 w-4 mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Changes
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Add missing Input import
import { Input } from '@/components/ui/input';