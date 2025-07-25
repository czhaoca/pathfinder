/**
 * Resource metadata types and utilities
 */

export interface ResourceMetadata {
  id: string;
  url: string;
  filename: string;
  title: string;
  context: string;
  sha256: string;
  timestamp: string;
  fileSize: number;
  source: 'CPABC' | 'CPACanada';
  documentType: DocumentType;
  competencyClassification: CompetencyClassification;
  routeRelevance: RouteType;
  validationStatus: ValidationStatus;
  contentExtracted?: boolean;
  extractedData?: any;
}

export type DocumentType = 
  | 'guidance'
  | 'form'
  | 'checklist'
  | 'handbook'
  | 'policy'
  | 'official'
  | 'example';

export type CompetencyClassification = 
  | 'technical'
  | 'enabling'
  | 'mixed'
  | 'general';

export type RouteType = 
  | 'EVR'
  | 'PPR'
  | 'Both';

export type ValidationStatus = 
  | 'verified'
  | 'unverified'
  | 'failed'
  | 'manual_required';

export interface ExtractedCompetency {
  code?: string;
  keyword?: string;
  description?: string;
  type: 'technical' | 'enabling';
  context?: string;
}

export interface ExtractedContent {
  text: string;
  pages: number;
  info: any;
  metadata: ResourceMetadata;
  extracted: {
    competencies: ExtractedCompetency[];
    guidingQuestions: string[];
    proficiencyLevels: Record<string, any>;
    examples: string[];
    requirements: string[];
  };
}

export interface CollectionReport {
  timestamp: string;
  resourcesCollected: number;
  successfulDownloads: number;
  failedDownloads: number;
  extractedDocuments: number;
  totalSize: number;
  sources: {
    CPABC: number;
    CPACanada: number;
  };
  documentTypes: Record<DocumentType, number>;
  validationStatus: Record<ValidationStatus, number>;
}