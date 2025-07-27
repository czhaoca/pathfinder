import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { PertResponse } from '@/types/cpaPert';
import { 
  Save, 
  Copy, 
  Download, 
  AlertCircle, 
  CheckCircle2,
  FileText,
  Target,
  Sparkles,
  RotateCcw
} from 'lucide-react';
import { toast } from 'sonner';

interface PertResponseEditorProps {
  response: PertResponse;
  onSave: (updates: Partial<PertResponse>) => Promise<void>;
  onGenerate?: () => void;
  readOnly?: boolean;
}

export function PertResponseEditor({ 
  response, 
  onSave, 
  onGenerate,
  readOnly = false 
}: PertResponseEditorProps) {
  const [editedContent, setEditedContent] = useState(response.content);
  const [sections, setSections] = useState({
    situation: '',
    task: '',
    action: '',
    result: ''
  });
  const [characterCount, setCharacterCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const MAX_CHARACTERS = 5000;
  const SECTION_LIMITS = {
    situation: 800,
    task: 600,
    action: 2000,
    result: 1000
  };

  useEffect(() => {
    // Parse sections from response content
    const parseSections = () => {
      const content = response.content || '';
      const situationMatch = content.match(/SITUATION:\s*([\s\S]*?)(?=TASK:|$)/i);
      const taskMatch = content.match(/TASK:\s*([\s\S]*?)(?=ACTION:|$)/i);
      const actionMatch = content.match(/ACTION:\s*([\s\S]*?)(?=RESULT:|$)/i);
      const resultMatch = content.match(/RESULT:\s*([\s\S]*?)$/i);

      setSections({
        situation: situationMatch?.[1]?.trim() || '',
        task: taskMatch?.[1]?.trim() || '',
        action: actionMatch?.[1]?.trim() || '',
        result: resultMatch?.[1]?.trim() || ''
      });
    };

    parseSections();
    setEditedContent(response.content);
    setCharacterCount(response.content.length);
  }, [response]);

  const updateSection = (section: keyof typeof sections, value: string) => {
    const newSections = { ...sections, [section]: value };
    setSections(newSections);
    
    // Rebuild full content
    const fullContent = `SITUATION:\n${newSections.situation}\n\nTASK:\n${newSections.task}\n\nACTION:\n${newSections.action}\n\nRESULT:\n${newSections.result}`;
    setEditedContent(fullContent);
    setCharacterCount(fullContent.length);
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (characterCount > MAX_CHARACTERS) {
      toast.error(`Response exceeds ${MAX_CHARACTERS} character limit`);
      return;
    }

    try {
      setSaving(true);
      await onSave({
        content: editedContent,
        wordCount: characterCount,
        situation: sections.situation,
        task: sections.task,
        action: sections.action,
        result: sections.result,
        status: 'draft'
      });
      setIsDirty(false);
      toast.success('PERT response saved successfully');
    } catch (error) {
      toast.error('Failed to save PERT response');
    } finally {
      setSaving(false);
    }
  };

  const handleFinalize = async () => {
    if (characterCount > MAX_CHARACTERS) {
      toast.error(`Response exceeds ${MAX_CHARACTERS} character limit`);
      return;
    }

    try {
      setSaving(true);
      await onSave({
        content: editedContent,
        wordCount: characterCount,
        situation: sections.situation,
        task: sections.task,
        action: sections.action,
        result: sections.result,
        status: 'final'
      });
      setIsDirty(false);
      toast.success('PERT response finalized successfully');
    } catch (error) {
      toast.error('Failed to finalize PERT response');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(editedContent);
    toast.success('Copied to clipboard');
  };

  const downloadAsText = () => {
    const blob = new Blob([editedContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PERT_Response_${response.id || 'draft'}.txt`;
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
              Edit and refine your PERT response using the STAR method
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={response.status === 'final' ? 'default' : 'secondary'}>
              {response.status || 'draft'}
            </Badge>
            {response.competencies && response.competencies.length > 0 && (
              <Badge variant="outline">
                {response.competencies[0]}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
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
        <Tabs defaultValue="structured" className="w-full">
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
          </TabsContent>

          <TabsContent value="full">
            <Textarea
              value={editedContent}
              onChange={(e) => {
                setEditedContent(e.target.value);
                setCharacterCount(e.target.value.length);
                setIsDirty(true);
              }}
              placeholder="Edit the full PERT response..."
              className="min-h-[500px] font-mono text-sm"
              disabled={readOnly}
            />
          </TabsContent>
        </Tabs>

        {/* Quantified Impact */}
        {response.quantifiedImpact && (
          <Alert>
            <Target className="h-4 w-4" />
            <AlertDescription>
              <strong>Quantified Impact:</strong> {response.quantifiedImpact}
            </AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={copyToClipboard}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadAsText}
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            {onGenerate && (
              <Button
                variant="outline"
                size="sm"
                onClick={onGenerate}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Regenerate
              </Button>
            )}
          </div>
          
          {!readOnly && (
            <div className="flex gap-2">
              {isDirty && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditedContent(response.content);
                    setCharacterCount(response.content.length);
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
                disabled={saving || !isDirty}
              >
                {saving ? (
                  <LoadingSpinner className="h-4 w-4 mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Draft
              </Button>
              <Button
                onClick={handleFinalize}
                disabled={saving || characterCount > MAX_CHARACTERS}
              >
                {saving ? (
                  <LoadingSpinner className="h-4 w-4 mr-2" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Finalize
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}