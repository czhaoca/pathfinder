# CPA PERT Integration - GitHub Issues Plan

## Epic: Integrate CPA PERT Writer Add-on into Pathfinder

### Issue #1: CPA PERT Backend Service Integration

**Title:** Implement CPA PERT Service Layer and API Endpoints

**Description:**
Create backend services to integrate the CPA PERT Writer add-on functionality into the main Pathfinder application. This service will handle competency mapping, PERT report generation, and compliance checking for CPA candidates on the EVR route.

**Acceptance Criteria:**
- [ ] Create `CPAPertService` class in `/backend/src/services/`
- [ ] Implement competency mapping engine that maps experiences to CPA framework
- [ ] Create PERT report generation logic with 5,000 character limit enforcement
- [ ] Add compliance validation for EVR route requirements
- [ ] Implement proficiency level assessment (Level 0, 1, 2)
- [ ] Add support for 8-10 key competency focus areas
- [ ] Create service methods for:
  - `analyzeExperienceCompetencies(experienceId, userId)`
  - `generatePERTResponse(experienceId, competencyCode, proficiencyLevel)`
  - `validateEVRRequirements(userId)`
  - `assessProficiencyLevel(experienceId, competencyCode)`
  - `generateCompetencyReport(userId)`

**Technical Requirements:**
- Integrate with existing experience data model
- Use the competency framework from CPA knowledge base
- Implement character counting and validation
- Add caching for competency analysis results
- Include audit logging for all PERT operations

**Dependencies:**
- Existing experience management system
- User authentication and authorization
- Audit service

**Labels:** backend, feature, cpa-pert, high-priority

---

### Issue #2: CPA PERT API Endpoints

**Title:** Create REST API endpoints for CPA PERT functionality

**Description:**
Implement RESTful API endpoints to expose CPA PERT functionality to the frontend application.

**Acceptance Criteria:**
- [ ] Create `CPAPertController` in `/backend/src/api/controllers/`
- [ ] Implement the following endpoints:
  ```
  POST /api/cpa-pert/analyze-experience
  GET  /api/cpa-pert/competency-mapping/:experienceId
  POST /api/cpa-pert/generate-response
  GET  /api/cpa-pert/compliance-check
  POST /api/cpa-pert/validate-requirements
  GET  /api/cpa-pert/competency-framework
  GET  /api/cpa-pert/proficiency-assessment/:experienceId
  ```
- [ ] Add request validation using Joi schemas
- [ ] Implement proper error handling and status codes
- [ ] Add rate limiting for report generation endpoints
- [ ] Include API documentation

**Technical Requirements:**
- Follow existing controller patterns
- Use dependency injection for services
- Add input validation for all endpoints
- Implement proper authorization checks
- Return consistent response formats

**Dependencies:**
- Issue #1 (CPA PERT Service)
- Authentication middleware
- Rate limiting middleware

**Labels:** backend, api, cpa-pert

---

### Issue #3: CPA Competency Database Schema

**Title:** Design and implement database schema for CPA competency framework

**Description:**
Create database tables to store the CPA competency framework, user competency assessments, and PERT report history.

**Acceptance Criteria:**
- [ ] Create migration scripts for new tables:
  - `pf_cpa_competencies` - Master competency framework
  - `pf_cpa_competency_mappings` - Experience to competency mappings
  - `pf_cpa_pert_responses` - Generated PERT responses
  - `pf_cpa_proficiency_assessments` - User proficiency level tracking
  - `pf_cpa_compliance_checks` - EVR requirement validation history
- [ ] Add proper indexes for performance
- [ ] Include foreign key constraints
- [ ] Add audit columns (created_at, updated_at)
- [ ] Create seed data for CPA competency framework

**Schema Details:**
```sql
-- Example structure for competency table
CREATE TABLE pf_cpa_competencies (
  competency_id VARCHAR2(10) PRIMARY KEY,
  category VARCHAR2(50) NOT NULL, -- Technical/Enabling
  area_code VARCHAR2(5) NOT NULL, -- FR, MA, AA, TX, FN, SG
  area_name VARCHAR2(100) NOT NULL,
  sub_code VARCHAR2(10) NOT NULL, -- FR1, FR2, etc.
  sub_name VARCHAR2(200) NOT NULL,
  description CLOB,
  evr_relevance VARCHAR2(20),
  level_1_criteria CLOB,
  level_2_criteria CLOB,
  guiding_questions CLOB,
  is_active NUMBER(1) DEFAULT 1
);
```

**Dependencies:**
- Database migration framework
- Oracle database access

**Labels:** database, schema, cpa-pert

---

### Issue #4: CPA PERT Frontend Components

**Title:** Build React components for CPA PERT functionality

**Description:**
Create reusable React components for CPA PERT report writing, competency mapping visualization, and compliance tracking.

**Acceptance Criteria:**
- [ ] Create component structure:
  ```
  /frontend/src/components/cpa-pert/
  ├── CompetencyMapper.tsx
  ├── PERTResponseEditor.tsx
  ├── ComplianceChecker.tsx
  ├── ProficiencyLevelSelector.tsx
  ├── CompetencyFrameworkViewer.tsx
  └── CharacterCounter.tsx
  ```
- [ ] Implement CompetencyMapper with visual mapping interface
- [ ] Create PERTResponseEditor with:
  - 5,000 character limit enforcement
  - Guiding questions display
  - Auto-save functionality
  - Example response templates
- [ ] Build ComplianceChecker showing EVR requirements status
- [ ] Add ProficiencyLevelSelector for Level 0/1/2 selection
- [ ] Include real-time character counting
- [ ] Add progress indicators for competency completion

**Technical Requirements:**
- Use TypeScript for type safety
- Implement with existing UI component library
- Add proper error boundaries
- Include loading and error states
- Make components responsive

**Dependencies:**
- UI component library
- CPA PERT types definition
- API service integration

**Labels:** frontend, components, cpa-pert

---

### Issue #5: CPA PERT Service Integration

**Title:** Create frontend service layer for CPA PERT API integration

**Description:**
Implement TypeScript services and hooks for interacting with CPA PERT backend APIs.

**Acceptance Criteria:**
- [ ] Create `cpaPertService.ts` in `/frontend/src/services/`
- [ ] Implement service methods matching backend endpoints
- [ ] Create custom hooks:
  - `useCPACompetencyMapping(experienceId)`
  - `usePERTResponseGenerator()`
  - `useCPACompliance(userId)`
  - `useProficiencyAssessment()`
- [ ] Add TypeScript interfaces for:
  - CPA competencies
  - PERT responses
  - Compliance results
  - Proficiency assessments
- [ ] Implement proper error handling
- [ ] Add response caching where appropriate

**Dependencies:**
- API client setup
- TypeScript type definitions
- Backend API endpoints

**Labels:** frontend, services, cpa-pert

---

### Issue #6: CPA PERT Knowledge Base Integration

**Title:** Integrate CPA knowledge base resources into MCP server

**Description:**
Modify the MCP server to include CPA PERT knowledge base for contextual AI assistance.

**Acceptance Criteria:**
- [ ] Add CPA-specific MCP tools:
  ```javascript
  analyze_cpa_competencies
  generate_pert_narrative  
  validate_pert_requirements
  suggest_competency_examples
  assess_proficiency_level
  ```
- [ ] Load CPA knowledge base from addon resources
- [ ] Implement competency-aware context retrieval
- [ ] Add EVR route filtering to responses
- [ ] Include BC-specific requirement prioritization
- [ ] Integrate with existing user context

**Technical Requirements:**
- Extend existing MCP server implementation
- Load knowledge base JSON files
- Implement competency classification logic
- Add proficiency level assessment
- Maintain existing MCP authentication

**Dependencies:**
- MCP server infrastructure
- CPA knowledge base files
- User authentication

**Labels:** backend, mcp, cpa-pert

---

### Issue #7: CPA PERT User Interface Pages

**Title:** Create dedicated UI pages for CPA PERT functionality

**Description:**
Build complete user interface pages for CPA PERT report management.

**Acceptance Criteria:**
- [ ] Create page structure:
  ```
  /frontend/src/pages/cpa-pert/
  ├── CPAPertDashboard.tsx
  ├── CompetencyMapping.tsx
  ├── PERTReportWriter.tsx
  ├── ComplianceTracker.tsx
  └── PERTReportHistory.tsx
  ```
- [ ] Implement CPAPertDashboard showing:
  - Overall progress toward EVR requirements
  - Competency coverage summary
  - Next steps and recommendations
- [ ] Create CompetencyMapping page for:
  - Visual competency framework
  - Experience to competency linking
  - Proficiency level tracking
- [ ] Build PERTReportWriter with:
  - Competency selection
  - Response editor
  - Example viewer
  - Submission workflow
- [ ] Add ComplianceTracker showing:
  - 30-month timeline progress
  - 12-month rule status
  - Missing competencies

**Dependencies:**
- CPA PERT components
- Routing configuration
- Navigation updates

**Labels:** frontend, pages, cpa-pert

---

### Issue #8: CPA PERT Testing Suite

**Title:** Implement comprehensive testing for CPA PERT functionality

**Description:**
Create unit, integration, and E2E tests for all CPA PERT features.

**Acceptance Criteria:**
- [ ] Backend unit tests:
  - Competency mapping logic
  - PERT response generation
  - Compliance validation
  - Proficiency assessment
- [ ] API integration tests:
  - All endpoints with various scenarios
  - Error handling
  - Authorization checks
- [ ] Frontend component tests:
  - Component rendering
  - User interactions
  - Character limit enforcement
- [ ] E2E tests:
  - Complete PERT report workflow
  - Competency mapping flow
  - Compliance checking

**Testing Scenarios:**
- Map experience to multiple competencies
- Generate PERT response within character limit
- Validate EVR requirements met/not met
- Test proficiency level progression
- Handle edge cases and errors

**Dependencies:**
- All implementation issues
- Test framework setup

**Labels:** testing, cpa-pert

---

### Issue #9: CPA PERT Documentation

**Title:** Create comprehensive documentation for CPA PERT features

**Description:**
Document the CPA PERT integration for developers, users, and administrators.

**Acceptance Criteria:**
- [ ] Developer documentation:
  - API reference
  - Service architecture
  - Database schema
  - Integration guide
- [ ] User documentation:
  - Getting started guide
  - Competency mapping tutorial
  - PERT writing best practices
  - FAQ section
- [ ] Administrator guide:
  - Configuration options
  - Knowledge base updates
  - Compliance monitoring
- [ ] Update main README with CPA PERT section

**Documentation Structure:**
```
/docs/cpa-pert/
├── developer/
│   ├── api-reference.md
│   ├── architecture.md
│   └── integration-guide.md
├── user/
│   ├── getting-started.md
│   ├── competency-guide.md
│   └── writing-tips.md
└── admin/
    ├── configuration.md
    └── maintenance.md
```

**Dependencies:**
- All implementation complete
- Screenshots and examples

**Labels:** documentation, cpa-pert

---

### Issue #10: CPA PERT Security and Compliance

**Title:** Implement security measures for CPA PERT data

**Description:**
Ensure CPA PERT functionality meets security and privacy requirements for sensitive career data.

**Acceptance Criteria:**
- [ ] Implement field-level encryption for:
  - PERT responses
  - Competency assessments
  - Compliance status
- [ ] Add audit logging for:
  - Report generation
  - Competency mapping changes
  - Compliance checks
- [ ] Implement access controls:
  - User can only access own PERT data
  - Admin view for support purposes
  - Mentor access functionality (future)
- [ ] Add data retention policies:
  - PERT response history
  - Competency progression tracking
- [ ] Include privacy controls:
  - Data export functionality
  - Deletion options

**Security Considerations:**
- Encrypt sensitive PERT responses
- Audit all data access
- Implement row-level security
- Add rate limiting for report generation
- Include GDPR compliance features

**Dependencies:**
- Security infrastructure
- Encryption service
- Audit logging system

**Labels:** security, compliance, cpa-pert

---

### Issue #11: CPA PERT Performance Optimization

**Title:** Optimize CPA PERT functionality for performance

**Description:**
Ensure CPA PERT features perform well at scale with multiple users.

**Acceptance Criteria:**
- [ ] Optimize database queries:
  - Add appropriate indexes
  - Implement query result caching
  - Use database views for complex joins
- [ ] Frontend optimizations:
  - Lazy load competency framework
  - Implement virtual scrolling for large lists
  - Add debouncing for character counting
- [ ] Backend optimizations:
  - Cache competency mappings
  - Batch process compliance checks
  - Optimize report generation
- [ ] Add performance monitoring:
  - Query execution times
  - API response times
  - Frontend rendering metrics

**Performance Targets:**
- Competency mapping: < 100ms
- PERT response generation: < 500ms
- Compliance check: < 200ms
- Page load time: < 2 seconds

**Dependencies:**
- Core implementation complete
- Performance monitoring tools

**Labels:** performance, optimization, cpa-pert

---

## Implementation Priority Order

1. **Phase 1 - Foundation** (Issues #3, #1, #2)
   - Database schema
   - Backend services
   - API endpoints

2. **Phase 2 - Core Features** (Issues #4, #5, #7)
   - Frontend components
   - Service integration
   - User interface pages

3. **Phase 3 - AI Integration** (Issue #6)
   - MCP server enhancement
   - Knowledge base integration

4. **Phase 4 - Quality & Polish** (Issues #8, #9, #10, #11)
   - Testing suite
   - Documentation
   - Security hardening
   - Performance optimization

## Technical Considerations

### Integration Points:
- Experience management system
- User authentication
- MCP server for AI assistance
- Audit logging system
- Encryption service

### Key Challenges:
- Maintaining 5,000 character limit
- Complex competency mapping logic
- EVR route specific filtering
- BC vs. national requirement handling
- Real-time compliance validation

### Success Metrics:
- User can map experiences to competencies
- PERT responses meet character limits
- Compliance status accurately tracked
- Proficiency levels properly assessed
- Knowledge base provides relevant guidance