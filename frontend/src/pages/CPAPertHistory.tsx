import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { PertResponseEditor } from '@/components/cpaPert/PertResponseEditor';
import { useCPAPert } from '@/hooks/useCPAPert';
import { useExperiences } from '@/hooks/useExperiences';
import { PertResponse } from '@/types/cpaPert';
import { 
  History, 
  Search, 
  Filter,
  Download,
  Copy,
  Eye,
  FileText,
  Calendar,
  Award,
  Building,
  CheckCircle2,
  Clock,
  BarChart3,
  Archive,
  Trash2,
  RotateCcw,
  AlertCircle
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';

interface GroupedResponses {
  [key: string]: PertResponse[];
}

export default function CPAPertHistory() {
  const navigate = useNavigate();
  const { 
    getPERTResponses, 
    archivePERTResponse,
    activatePERTResponse,
    deletePERTResponse,
    loading 
  } = useCPAPert();
  const { experiences } = useExperiences();
  
  const [responses, setResponses] = useState<PertResponse[]>([]);
  const [filteredResponses, setFilteredResponses] = useState<PertResponse[]>([]);
  const [selectedResponse, setSelectedResponse] = useState<PertResponse | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterExperience, setFilterExperience] = useState('all');
  const [filterCompetency, setFilterCompetency] = useState('all');
  const [filterLevel, setFilterLevel] = useState('all');
  const [filterStatus, setFilterStatus] = useState('current');
  const [groupBy, setGroupBy] = useState<'experience' | 'competency' | 'date'>('experience');
  const [activeTab, setActiveTab] = useState('list');

  useEffect(() => {
    loadResponses();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [responses, searchTerm, filterExperience, filterCompetency, filterLevel, filterStatus]);

  const loadResponses = async () => {
    try {
      const allResponses = await getPERTResponses(1000); // Get all responses
      setResponses(allResponses || []);
    } catch (error) {
      console.error('Failed to load responses:', error);
      toast.error('Failed to load response history');
    }
  };

  const applyFilters = () => {
    let filtered = [...responses];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(r => 
        r.response_text.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.sub_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.sub_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply experience filter
    if (filterExperience !== 'all') {
      filtered = filtered.filter(r => r.experience_id === filterExperience);
    }

    // Apply competency filter
    if (filterCompetency !== 'all') {
      filtered = filtered.filter(r => r.competency_id === filterCompetency);
    }

    // Apply level filter
    if (filterLevel !== 'all') {
      filtered = filtered.filter(r => r.proficiency_level === parseInt(filterLevel));
    }

    // Apply status filter
    if (filterStatus === 'current') {
      filtered = filtered.filter(r => r.is_current === 1);
    } else if (filterStatus === 'archived') {
      filtered = filtered.filter(r => r.is_current === 0);
    }

    setFilteredResponses(filtered);
  };

  const groupResponses = (): GroupedResponses => {
    const grouped: GroupedResponses = {};

    filteredResponses.forEach(response => {
      let key: string;
      
      switch (groupBy) {
        case 'experience':
          const exp = experiences.find(e => e.experienceId === response.experience_id);
          key = exp ? `${exp.title} at ${exp.organization}` : 'Unknown Experience';
          break;
        case 'competency':
          key = `${response.sub_code} - ${response.sub_name || 'Unknown'}`;
          break;
        case 'date':
          key = format(parseISO(response.created_at), 'MMMM yyyy');
          break;
        default:
          key = 'Other';
      }

      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(response);
    });

    return grouped;
  };

  const handleArchive = async (responseId: string) => {
    try {
      await archivePERTResponse(responseId);
      await loadResponses();
      toast.success('Response archived');
    } catch (error) {
      toast.error('Failed to archive response');
    }
  };

  const handleActivate = async (responseId: string) => {
    try {
      await activatePERTResponse(responseId);
      await loadResponses();
      toast.success('Response activated');
    } catch (error) {
      toast.error('Failed to activate response');
    }
  };

  const handleDelete = async (responseId: string) => {
    if (!confirm('Are you sure you want to delete this response? This action cannot be undone.')) {
      return;
    }

    try {
      await deletePERTResponse(responseId);
      await loadResponses();
      toast.success('Response deleted');
      setSelectedResponse(null);
    } catch (error) {
      toast.error('Failed to delete response');
    }
  };

  const downloadResponse = (response: PertResponse) => {
    const content = `${response.sub_code} - ${response.sub_name} (Level ${response.proficiency_level})
Experience: ${experiences.find(e => e.experienceId === response.experience_id)?.title || 'Unknown'}
Created: ${format(parseISO(response.created_at), 'PPP')}
Character Count: ${response.character_count}

${response.response_text}`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PERT_${response.sub_code}_Level${response.proficiency_level}_${format(parseISO(response.created_at), 'yyyy-MM-dd')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportAllResponses = () => {
    const content = filteredResponses
      .map(r => `${r.sub_code} - ${r.sub_name} (Level ${r.proficiency_level})
Experience: ${experiences.find(e => e.experienceId === r.experience_id)?.title || 'Unknown'}
Status: ${r.is_current === 1 ? 'Current' : 'Archived'}
Created: ${format(parseISO(r.created_at), 'PPP')}

${r.response_text}

${'-'.repeat(80)}
`)
      .join('\n\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PERT_Response_History_${format(new Date(), 'yyyy-MM-dd')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Exported all responses');
  };

  const getCompetencyStats = () => {
    const stats = {
      total: filteredResponses.length,
      current: filteredResponses.filter(r => r.is_current === 1).length,
      archived: filteredResponses.filter(r => r.is_current === 0).length,
      level2: filteredResponses.filter(r => r.proficiency_level === 2 && r.is_current === 1).length,
      level1: filteredResponses.filter(r => r.proficiency_level === 1 && r.is_current === 1).length,
      level0: filteredResponses.filter(r => r.proficiency_level === 0 && r.is_current === 1).length,
      uniqueCompetencies: new Set(filteredResponses.filter(r => r.is_current === 1).map(r => r.competency_id)).size
    };
    return stats;
  };

  const stats = getCompetencyStats();
  const groupedResponses = groupResponses();

  if (loading && responses.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner message="Loading response history..." />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">PERT Response History</h1>
          <p className="text-muted-foreground mt-2">
            View and manage all your PERT responses
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={exportAllResponses}
            disabled={filteredResponses.length === 0}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Export All
          </Button>
          <Button
            onClick={() => navigate('/cpa-pert')}
            variant="outline"
          >
            Back to Dashboard
          </Button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Responses</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {stats.current} current, {stats.archived} archived
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Competencies</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.uniqueCompetencies}/8</div>
            <p className="text-xs text-muted-foreground">
              Competency areas covered
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Proficiency Levels</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge variant="default" className="text-xs">L2: {stats.level2}</Badge>
              <Badge variant="secondary" className="text-xs">L1: {stats.level1}</Badge>
              <Badge variant="outline" className="text-xs">L0: {stats.level0}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Experience Count</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(filteredResponses.map(r => r.experience_id)).size}
            </div>
            <p className="text-xs text-muted-foreground">
              Experiences with responses
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search responses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <Select value={groupBy} onValueChange={(v) => setGroupBy(v as any)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="experience">Group by Experience</SelectItem>
                <SelectItem value="competency">Group by Competency</SelectItem>
                <SelectItem value="date">Group by Date</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2 md:grid-cols-4">
            <Select value={filterExperience} onValueChange={setFilterExperience}>
              <SelectTrigger>
                <SelectValue placeholder="All Experiences" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Experiences</SelectItem>
                {experiences.map(exp => (
                  <SelectItem key={exp.experienceId} value={exp.experienceId}>
                    {exp.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterCompetency} onValueChange={setFilterCompetency}>
              <SelectTrigger>
                <SelectValue placeholder="All Competencies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Competencies</SelectItem>
                {Array.from(new Set(responses.map(r => r.competency_id))).map(id => {
                  const response = responses.find(r => r.competency_id === id);
                  return (
                    <SelectItem key={id} value={id}>
                      {response?.sub_code} - {response?.sub_name}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            <Select value={filterLevel} onValueChange={setFilterLevel}>
              <SelectTrigger>
                <SelectValue placeholder="All Levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="2">Level 2</SelectItem>
                <SelectItem value="1">Level 1</SelectItem>
                <SelectItem value="0">Level 0</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="current">Current Only</SelectItem>
                <SelectItem value="archived">Archived Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="list">Response List</TabsTrigger>
          <TabsTrigger value="viewer">Response Viewer</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          {filteredResponses.length > 0 ? (
            <ScrollArea className="h-[600px]">
              <div className="space-y-6">
                {Object.entries(groupedResponses).map(([group, groupResponses]) => (
                  <div key={group} className="space-y-3">
                    <h3 className="font-semibold flex items-center gap-2">
                      {groupBy === 'experience' && <Building className="h-4 w-4" />}
                      {groupBy === 'competency' && <Target className="h-4 w-4" />}
                      {groupBy === 'date' && <Calendar className="h-4 w-4" />}
                      {group}
                      <Badge variant="outline" className="ml-2">
                        {groupResponses.length}
                      </Badge>
                    </h3>
                    
                    <div className="grid gap-3">
                      {groupResponses
                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                        .map((response) => (
                          <Card 
                            key={response.response_id}
                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => {
                              setSelectedResponse(response);
                              setActiveTab('viewer');
                            }}
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
                                  {response.is_current === 1 ? (
                                    <Badge variant="default" className="gap-1">
                                      <CheckCircle2 className="h-3 w-3" />
                                      Current
                                    </Badge>
                                  ) : (
                                    <Badge variant="secondary" className="gap-1">
                                      <Archive className="h-3 w-3" />
                                      Archived
                                    </Badge>
                                  )}
                                  <Badge variant="outline">
                                    Level {response.proficiency_level}
                                  </Badge>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="pb-3">
                              <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                                {response.response_text}
                              </p>
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <div className="flex items-center gap-3">
                                  <span className="flex items-center gap-1">
                                    <FileText className="h-3 w-3" />
                                    {response.character_count} chars
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {format(parseISO(response.created_at), 'MMM d, yyyy')}
                                  </span>
                                </div>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigator.clipboard.writeText(response.response_text);
                                      toast.success('Copied to clipboard');
                                    }}
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      downloadResponse(response);
                                    }}
                                  >
                                    <Download className="h-3 w-3" />
                                  </Button>
                                  {response.is_current === 1 ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleArchive(response.response_id);
                                      }}
                                    >
                                      <Archive className="h-3 w-3" />
                                    </Button>
                                  ) : (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleActivate(response.response_id);
                                      }}
                                    >
                                      <RotateCcw className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Responses Found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {searchTerm || filterExperience !== 'all' || filterCompetency !== 'all' || filterLevel !== 'all' || filterStatus !== 'all'
                    ? 'Try adjusting your filters or search term'
                    : 'Generate some PERT responses to see them here'}
                </p>
                {responses.length === 0 && (
                  <Button onClick={() => navigate('/cpa-pert/mapping')}>
                    Start Generating Responses
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="viewer">
          {selectedResponse ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Response Details</h2>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(selectedResponse.response_text);
                      toast.success('Copied to clipboard');
                    }}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadResponse(selectedResponse)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(selectedResponse.response_id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </div>

              <PertResponseEditor
                experience={experiences.find(e => e.experienceId === selectedResponse.experience_id) || {} as any}
                existingResponse={selectedResponse}
                readOnly={true}
              />
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Eye className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Select a Response</h3>
                <p className="text-sm text-muted-foreground">
                  Choose a response from the list to view details
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}