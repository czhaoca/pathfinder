# CPA Data Collection and LLM Fine-tuning - GitHub Issues

## Epic: CPA BC and CPA Canada PERT Data Collection and LLM Enhancement

This epic covers the systematic collection of CPA PERT data from official sources and the enhancement of LLM capabilities through fine-tuning with domain-specific prompts and knowledge.

---

### Issue #12: Automated CPA BC PERT Data Collection Pipeline

**Title:** Implement automated data collection pipeline for CPA BC PERT resources

**Description:**
Create an automated system to collect, validate, and maintain up-to-date CPA BC PERT resources with focus on EVR (Experience Verification Route) requirements. This pipeline will ensure all data is live-fetched from official sources with proper versioning and validation.

**Acceptance Criteria:**
- [ ] Create data collection service in `/backend/src/services/cpa-data-collector/`
- [ ] Implement headless browser automation for CPA BC website crawling
- [ ] Add PDF download capability with SHA-256 checksum generation
- [ ] Create metadata extraction for all collected documents
- [ ] Implement version tracking with change detection
- [ ] Add scheduled job for weekly resource updates
- [ ] Create validation pipeline for data integrity
- [ ] Generate collection reports with statistics

**Technical Requirements:**
```javascript
// Data Collection Service Structure
class CPADataCollector {
  // Core methods
  async collectCPABCResources() {
    // 1. Fetch current candidates experience page
    // 2. Extract all PERT-related PDF links
    // 3. Download PDFs with proper headers
    // 4. Generate SHA-256 checksums
    // 5. Extract metadata and classify content
    // 6. Update knowledge base
  }
  
  async validateResourceIntegrity() {
    // Verify checksums, URLs, and content relevance
  }
  
  async generateCollectionReport() {
    // Statistics on collected resources
  }
}
```

**Data Sources to Collect:**
1. **PERT User Guides**
   - EVR-specific guidance documents
   - Pre-assessment checklists
   - Competency mapping guides

2. **Forms and Templates**
   - PERT response templates
   - Experience verification forms
   - Competency assessment tools

3. **Policy Documents**
   - EVR route requirements
   - Experience duration policies
   - Progression requirements

**Implementation Steps:**
1. Set up Puppeteer/Playwright for headless browsing
2. Implement authentication bypass for public resources
3. Create PDF parsing and metadata extraction
4. Build knowledge graph of competency relationships
5. Implement incremental update mechanism

**Dependencies:**
- Puppeteer or Playwright for web automation
- pdf-parse for PDF text extraction
- crypto for SHA-256 generation
- node-schedule for automated runs

**Labels:** backend, feature, data-collection, cpa-bc, high-priority

---

### Issue #13: CPA Canada National Framework Data Integration

**Title:** Integrate CPA Canada national competency framework data with firewall bypass

**Description:**
Implement robust data collection from CPA Canada resources despite Cloudflare protection. Focus on national competency framework, guiding questions, and rubric documents essential for PERT compliance.

**Acceptance Criteria:**
- [ ] Implement Cloudflare bypass strategies
- [ ] Create fallback mechanisms for restricted resources
- [ ] Download and process national framework PDFs
- [ ] Extract competency hierarchy and relationships
- [ ] Map national standards to BC-specific requirements
- [ ] Create comprehensive competency database
- [ ] Document access limitations and workarounds

**Technical Approach:**
```javascript
// Cloudflare Bypass Strategy
class CPACanadaCollector {
  async collectWithBypass() {
    const strategies = [
      this.tryWgetWithHeaders,
      this.tryPuppeteerStealth,
      this.tryAPIEndpoints,
      this.documentForManualCollection
    ];
    
    for (const strategy of strategies) {
      const result = await strategy();
      if (result.success) return result;
    }
  }
  
  async tryWgetWithHeaders() {
    // Use wget with browser headers
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5'
    };
  }
}
```

**Priority Resources:**
1. **Guiding Questions and Practical Experience Rubric** (April 2023)
2. **CPA Practical Experience Requirements**
3. **Harmonized Practical Experience Policies**
4. **Technical Competency Framework**
5. **Enabling Competency Standards**

**Fallback Documentation:**
- Create manual collection checklist
- Document URLs for manual verification
- Establish contact with CPA Canada for direct access
- Consider partnership for API access

**Labels:** backend, feature, data-collection, cpa-canada, cloudflare-bypass

---

### Issue #14: Competency Knowledge Graph Construction

**Title:** Build comprehensive CPA competency knowledge graph from collected data

**Description:**
Transform collected CPA data into a structured knowledge graph that maps competencies, proficiency levels, guiding questions, and EVR-specific requirements. This graph will power intelligent PERT response generation.

**Acceptance Criteria:**
- [ ] Parse all collected PDFs for competency information
- [ ] Extract technical competency hierarchy (6 areas, 24 sub-competencies)
- [ ] Map enabling competencies and relationships
- [ ] Extract guiding questions for each competency/level
- [ ] Build proficiency level criteria (0, 1, 2)
- [ ] Create EVR-specific requirement mappings
- [ ] Generate JSON knowledge base files
- [ ] Implement graph query capabilities

**Knowledge Graph Structure:**
```json
{
  "competencies": {
    "technical": {
      "FR": {
        "name": "Financial Reporting",
        "sub_competencies": {
          "FR1": {
            "name": "Financial reporting needs and systems",
            "levels": {
              "1": {
                "description": "Routine analysis of reporting needs",
                "guiding_questions": [...],
                "evr_examples": [...],
                "complexity_factors": [...]
              },
              "2": {
                "description": "Complex framework application",
                "requirements": "3+ complex examples across multiple frameworks"
              }
            }
          }
        }
      }
    },
    "enabling": {...},
    "proficiency_levels": {...},
    "evr_requirements": {...}
  }
}
```

**Processing Pipeline:**
1. PDF text extraction with layout preservation
2. Natural Language Processing for structure identification
3. Competency classification and hierarchy building
4. Guiding question extraction and mapping
5. Example mining from guidance documents
6. Validation against official frameworks

**Labels:** backend, feature, knowledge-graph, nlp, high-priority

---

### Issue #15: LLM Fine-tuning Dataset Generation

**Title:** Generate high-quality dataset for LLM fine-tuning on PERT responses

**Description:**
Create a comprehensive training dataset from collected CPA resources to fine-tune language models for generating compliant PERT responses. Focus on EVR route requirements and BC-specific guidelines.

**Acceptance Criteria:**
- [ ] Extract example responses from official documents
- [ ] Create prompt-response pairs for each competency/level
- [ ] Generate variations for different industries
- [ ] Include character limit compliance (5,000 chars)
- [ ] Add guiding question coverage validation
- [ ] Create quality scoring mechanisms
- [ ] Build dataset in multiple formats (JSONL, Parquet)
- [ ] Include metadata for filtering and analysis

**Dataset Structure:**
```jsonl
{
  "prompt": "Generate a PERT response for FR2 Level 2 demonstrating complex IFRS application in manufacturing industry",
  "context": {
    "competency": "FR2",
    "level": 2,
    "industry": "manufacturing",
    "guiding_questions": [...],
    "character_limit": 5000
  },
  "response": "Throughout my role as Senior Financial Analyst...",
  "metadata": {
    "source": "cpabc_example_guide_v2023",
    "quality_score": 0.95,
    "covers_all_questions": true,
    "character_count": 4875
  }
}
```

**Training Data Categories:**
1. **Competency-Level Combinations** (24 × 3 = 72 base variations)
2. **Industry Contexts** (10+ industries)
3. **Experience Progression** (Early, Mid, Senior roles)
4. **Complexity Demonstrations**
5. **Guiding Question Responses**

**Quality Criteria:**
- Addresses all guiding questions
- Within character limits
- Shows appropriate complexity
- Demonstrates progression
- Industry-relevant examples

**Labels:** ml, dataset, fine-tuning, high-priority

---

### Issue #16: Custom LLM Prompt Engineering Framework

**Title:** Develop specialized prompt engineering framework for PERT responses

**Description:**
Create a sophisticated prompt engineering system that generates contextually appropriate PERT responses based on candidate profiles, experience data, and CPA requirements. Implement prompt templates, validation, and optimization.

**Acceptance Criteria:**
- [ ] Design modular prompt template system
- [ ] Create competency-specific prompt builders
- [ ] Implement context injection mechanisms
- [ ] Add response validation pipeline
- [ ] Create prompt optimization algorithms
- [ ] Build A/B testing framework
- [ ] Implement quality scoring system
- [ ] Add feedback loop for improvement

**Prompt Template Architecture:**
```typescript
interface PERTPromptTemplate {
  base: string;
  competencyContext: CompetencyContext;
  experienceContext: ExperienceContext;
  constraints: ResponseConstraints;
  
  buildPrompt(): string {
    return `
      Role: You are a CPA candidate writing a PERT response.
      
      Competency: ${this.competencyContext.code} - ${this.competencyContext.name}
      Target Level: ${this.competencyContext.level}
      
      Experience Context:
      ${this.experienceContext.summary}
      
      Guiding Questions to Address:
      ${this.competencyContext.guidingQuestions.join('\n')}
      
      Constraints:
      - Maximum ${this.constraints.characterLimit} characters
      - Focus on ${this.constraints.complexityLevel} complexity examples
      - Demonstrate ${this.constraints.autonomyLevel} autonomy
      
      Generate a PERT response that...
    `;
  }
}
```

**Prompt Components:**
1. **Base Templates** - Core structure for different competency areas
2. **Context Injectors** - Dynamic experience and role information
3. **Constraint Validators** - Character limits, coverage checks
4. **Quality Enhancers** - Complexity demonstrations, specific examples
5. **Industry Adapters** - Sector-specific terminology and scenarios

**Optimization Strategies:**
- Response quality scoring
- Guiding question coverage analysis
- Complexity level validation
- Character efficiency metrics
- A/B testing with variations

**Labels:** ml, prompt-engineering, optimization, high-priority

---

### Issue #17: LLM Fine-tuning Implementation

**Title:** Fine-tune LLM models for CPA PERT response generation

**Description:**
Implement the actual fine-tuning process using collected datasets and optimized prompts. Create multiple specialized models for different competency areas and complexity levels.

**Acceptance Criteria:**
- [ ] Set up fine-tuning infrastructure
- [ ] Prepare training/validation/test splits
- [ ] Implement fine-tuning for base model
- [ ] Create competency-specific model variants
- [ ] Add evaluation metrics and benchmarks
- [ ] Implement model versioning system
- [ ] Create inference optimization
- [ ] Build model selection logic

**Fine-tuning Strategy:**
```python
# Fine-tuning Configuration
config = {
  "base_model": "gpt-3.5-turbo",
  "training_data": "cpa_pert_dataset_v1",
  "hyperparameters": {
    "learning_rate": 1e-5,
    "epochs": 3,
    "batch_size": 4,
    "warmup_steps": 100
  },
  "validation_metrics": [
    "guiding_question_coverage",
    "character_limit_compliance",
    "complexity_score",
    "profession_terminology_accuracy"
  ]
}
```

**Model Variants:**
1. **General PERT Model** - All competencies baseline
2. **Technical Competency Models** - Specialized for FR, MA, TX, etc.
3. **Complexity Level Models** - Optimized for Level 1 vs Level 2
4. **Industry-Specific Models** - Manufacturing, Finance, Tech, etc.

**Evaluation Framework:**
- Automated scoring against rubric
- Human expert validation
- A/B testing with candidates
- Compliance rate tracking
- Character efficiency analysis

**Labels:** ml, fine-tuning, model-training, high-priority

---

### Issue #18: Continuous Learning and Update System

**Title:** Implement continuous learning system for PERT knowledge updates

**Description:**
Create an automated system that continuously monitors CPA resources for updates, incorporates new guidelines, and refines LLM responses based on user feedback and official changes.

**Acceptance Criteria:**
- [ ] Implement change detection for CPA websites
- [ ] Create automated retraining pipeline
- [ ] Build feedback collection system
- [ ] Add quality monitoring dashboard
- [ ] Implement A/B testing framework
- [ ] Create rollback mechanisms
- [ ] Add performance tracking
- [ ] Build notification system for major updates

**Continuous Learning Pipeline:**
```javascript
class ContinuousLearningSystem {
  async monitorAndUpdate() {
    // 1. Check for resource updates
    const changes = await this.detectResourceChanges();
    
    // 2. Validate significance
    if (changes.requiresUpdate) {
      // 3. Collect new data
      await this.collectUpdatedResources(changes);
      
      // 4. Update knowledge base
      await this.updateKnowledgeGraph(changes);
      
      // 5. Retrain if needed
      if (changes.requiresRetraining) {
        await this.triggerModelRetraining();
      }
      
      // 6. Notify stakeholders
      await this.notifyUpdates(changes);
    }
  }
}
```

**Monitoring Components:**
1. **Resource Change Detection** - SHA-256 comparison, content diff
2. **Feedback Analysis** - User success rates, quality scores
3. **Performance Metrics** - Response quality, compliance rates
4. **Update Scheduling** - Weekly checks, quarterly reviews
5. **Version Control** - Model and dataset versioning

**Quality Assurance:**
- Automated testing of new models
- Gradual rollout with monitoring
- Rollback capabilities
- Performance benchmarking
- User satisfaction tracking

**Labels:** ml, continuous-learning, automation, monitoring

---

### Issue #19: PERT Response Quality Assurance System

**Title:** Build comprehensive quality assurance system for generated PERT responses

**Description:**
Develop an automated QA system that validates generated PERT responses against official CPA requirements, ensuring compliance, completeness, and quality before user submission.

**Acceptance Criteria:**
- [ ] Implement rubric-based scoring system
- [ ] Create guiding question coverage analyzer
- [ ] Add character count validation
- [ ] Build complexity level assessor
- [ ] Implement terminology validator
- [ ] Create feedback generation system
- [ ] Add revision suggestion engine
- [ ] Build compliance reporting

**QA Pipeline Components:**
```typescript
interface QualityAssuranceSystem {
  validateResponse(response: PERTResponse): QAResult {
    return {
      rubricScore: this.scoreAgainstRubric(response),
      questionCoverage: this.analyzeQuestionCoverage(response),
      characterCompliance: this.validateCharacterLimit(response),
      complexityAssessment: this.assessComplexity(response),
      terminologyCheck: this.validateTerminology(response),
      suggestions: this.generateImprovements(response),
      overallScore: this.calculateOverallScore(response)
    };
  }
}
```

**Validation Criteria:**
1. **Rubric Compliance** - Official CPA scoring criteria
2. **Question Coverage** - All guiding questions addressed
3. **Character Limits** - Within 5,000 character boundary
4. **Complexity Demonstration** - Appropriate level examples
5. **Professional Terminology** - Industry-standard language
6. **Progression Evidence** - Shows growth and development
7. **Transferability** - Skills beyond current role

**Feedback Generation:**
- Specific improvement suggestions
- Missing element identification
- Complexity enhancement tips
- Character optimization advice
- Example recommendations

**Labels:** qa, validation, automation, high-priority

---

### Issue #20: Integration Testing and Deployment

**Title:** Comprehensive integration testing and deployment of CPA data collection and LLM system

**Description:**
Implement end-to-end testing of the entire CPA data collection, knowledge processing, and LLM response generation pipeline. Ensure production readiness with proper monitoring and deployment procedures.

**Acceptance Criteria:**
- [ ] Create integration test suite
- [ ] Implement load testing for data collection
- [ ] Add LLM response generation tests
- [ ] Build monitoring and alerting system
- [ ] Create deployment automation
- [ ] Add rollback procedures
- [ ] Implement security scanning
- [ ] Create operational documentation

**Testing Strategy:**
```javascript
describe('CPA PERT System Integration', () => {
  it('should collect and process CPA BC resources', async () => {
    const collector = new CPADataCollector();
    const resources = await collector.collectCPABCResources();
    expect(resources).toHaveValidChecksums();
    expect(resources).toContainEVRContent();
  });
  
  it('should generate compliant PERT responses', async () => {
    const generator = new PERTResponseGenerator();
    const response = await generator.generate({
      competency: 'FR2',
      level: 2,
      experience: mockExperience
    });
    
    const qa = new QualityAssuranceSystem();
    const result = await qa.validateResponse(response);
    expect(result.overallScore).toBeGreaterThan(0.9);
  });
});
```

**Deployment Checklist:**
- [ ] Environment configuration
- [ ] Database migrations
- [ ] Model deployment
- [ ] API endpoint configuration
- [ ] Monitoring setup
- [ ] Backup procedures
- [ ] Security hardening
- [ ] Performance optimization

**Labels:** testing, deployment, integration, high-priority

---

## Implementation Timeline

### Phase 1: Data Collection (Weeks 1-2)
- Issues #12, #13: Automated collection pipelines
- Issue #14: Knowledge graph construction

### Phase 2: Dataset Preparation (Weeks 3-4)
- Issue #15: Training dataset generation
- Issue #16: Prompt engineering framework

### Phase 3: Model Development (Weeks 5-6)
- Issue #17: LLM fine-tuning
- Issue #19: Quality assurance system

### Phase 4: Integration & Deployment (Weeks 7-8)
- Issue #18: Continuous learning system
- Issue #20: Integration testing and deployment

## Success Metrics

1. **Data Collection Coverage**: 95%+ of available PERT resources
2. **Response Quality Score**: Average 90%+ on rubric evaluation
3. **Character Compliance**: 100% within 5,000 character limit
4. **Guiding Question Coverage**: 100% addressed in responses
5. **User Satisfaction**: 85%+ approval rating
6. **Processing Time**: < 30 seconds per response generation
7. **Update Frequency**: Weekly automated updates
8. **Model Accuracy**: 95%+ on validation dataset