# CPA PERT Module Documentation

## Overview

The CPA PERT (Practical Experience Reporting Tool) module is a comprehensive system for Canadian CPA candidates to manage their practical experience requirements through the Experience Verification Route (EVR). This module leverages AI to analyze work experiences, map them to CPA competencies, and generate professional PERT responses.

## Key Features

### 1. Competency Mapping
- AI-powered analysis of work experiences
- Automatic mapping to CPA Canada's competency framework
- Relevance scoring and evidence extraction
- Proficiency level recommendations

### 2. PERT Response Generation
- AI-assisted PERT response creation using STAR method
- Character limit compliance (5000 characters)
- Structured editing with section limits
- Version history and management

### 3. EVR Compliance Tracking
- Real-time compliance status monitoring
- 30-month experience window validation
- Competency coverage analysis
- Development plan recommendations

### 4. Reporting & Analytics
- Comprehensive competency reports
- Progress visualization
- Export capabilities
- Historical tracking

## User Guide

### Getting Started

1. **Navigate to CPA PERT Module**
   - Click "CPA PERT" in the main navigation menu
   - View your dashboard with current progress

2. **Analyze Your Experiences**
   - Go to "Competency Mapping"
   - Select an experience to analyze
   - Click "Analyze for Competencies"
   - Review the AI-generated competency mappings

3. **Generate PERT Responses**
   - From competency mappings, click on a competency
   - Or go to "PERT Report Writer"
   - Select experience and competency
   - Choose proficiency level (0, 1, or 2)
   - Click "Generate" for AI-assisted response
   - Edit and refine the response
   - Save when satisfied

4. **Track Compliance**
   - Visit "Compliance Tracker"
   - Review EVR requirements status
   - Check experience timeline
   - Identify gaps in competency coverage

5. **Manage Responses**
   - Go to "Response History"
   - Filter and search responses
   - Edit, archive, or delete as needed
   - Export for external use

### Best Practices

#### Writing Effective PERT Responses

1. **Use the STAR Method**
   - **Situation**: Provide business context and challenges
   - **Task**: Clearly state your responsibilities
   - **Action**: Detail specific actions YOU took
   - **Result**: Quantify outcomes and impact

2. **Character Limits**
   - Total response: 5000 characters maximum
   - Situation: ~800 characters recommended
   - Task: ~600 characters recommended
   - Action: ~2000 characters recommended
   - Result: ~1000 characters recommended

3. **Proficiency Levels**
   - **Level 0**: Basic understanding, work under supervision
   - **Level 1**: Independent work, moderate complexity
   - **Level 2**: Advanced application, leadership, strategic impact

#### Maximizing AI Assistance

1. **Detailed Experience Descriptions**
   - Provide comprehensive experience descriptions
   - Include specific projects and achievements
   - List quantifiable results

2. **Review AI Suggestions**
   - AI provides starting points
   - Always personalize and verify accuracy
   - Ensure responses reflect YOUR actual work

3. **Iterative Refinement**
   - Generate initial response
   - Edit for accuracy and personalization
   - Use regenerate feature if needed

## Technical Architecture

### Backend Components

```
/backend/src/
├── services/
│   └── cpaPertService.js       # Core business logic
├── database/
│   └── migrations/
│       └── create-cpa-pert-tables.js  # Database schema
└── api/
    └── cpa-pert/               # API endpoints
```

### Frontend Components

```
/frontend/src/
├── pages/
│   ├── CPAPert.tsx             # Dashboard
│   ├── CPAPertMapping.tsx      # Competency mapping
│   ├── CPAPertWriter.tsx       # PERT writer
│   ├── CPAPertCompliance.tsx   # Compliance tracker
│   └── CPAPertHistory.tsx      # Response history
├── components/cpaPert/
│   ├── CompetencyMapper.tsx    # Mapping display
│   ├── PertResponseEditor.tsx  # Response editor
│   ├── ComplianceMonitor.tsx   # Compliance status
│   └── ProgressTracker.tsx     # Progress visualization
├── hooks/
│   └── useCPAPert.ts          # React hook
└── services/
    └── cpaPertService.ts      # API client
```

### Database Schema

```sql
-- Core Tables
cn_cpa_competencies              # CPA competency framework
cn_cpa_competency_mappings       # Experience-competency mappings
cn_cpa_pert_responses           # PERT responses
cn_cpa_proficiency_assessments  # User proficiency tracking
cn_cpa_compliance_checks        # EVR compliance history
cn_cpa_pert_templates          # Response templates
```

## API Reference

### Endpoints

#### GET /api/cpa-pert/competencies
Retrieve CPA competency framework

#### POST /api/cpa-pert/analyze
Analyze experience for competency mappings
```json
{
  "experienceId": "exp123"
}
```

#### POST /api/cpa-pert/generate
Generate PERT response
```json
{
  "experienceId": "exp123",
  "competencyId": "1",
  "proficiencyLevel": 2
}
```

#### GET /api/cpa-pert/compliance
Check EVR compliance status

#### PUT /api/cpa-pert/response/:responseId
Update existing PERT response
```json
{
  "responseText": "Updated response",
  "situationText": "Updated situation",
  "taskText": "Updated task",
  "actionText": "Updated action",
  "resultText": "Updated result"
}
```

#### GET /api/cpa-pert/responses
Retrieve PERT responses with pagination
```
?limit=20&offset=0&experienceId=exp123
```

#### GET /api/cpa-pert/report
Generate comprehensive competency report

## Security & Privacy

### Data Protection
- All PERT responses are encrypted using AES-256-GCM
- User-specific encryption keys
- Complete data isolation between users
- Audit logging for all operations

### Access Control
- JWT authentication required
- User can only access their own data
- Session-based security
- Rate limiting on AI operations

### Compliance
- HIPAA-level security standards
- GDPR compliance ready
- Data retention policies supported
- Right to deletion implemented

## Performance Considerations

### Optimization Strategies
1. **Caching**: Competency framework cached for performance
2. **Pagination**: Large datasets paginated
3. **Batch Operations**: Process multiple experiences efficiently
4. **Lazy Loading**: Components load data as needed

### Best Practices
- Analyze experiences in batches when possible
- Use filters to reduce data loaded
- Export large datasets for offline work

## Troubleshooting

### Common Issues

1. **"Experience not found" error**
   - Ensure experience exists and is active
   - Check you have permission to access

2. **"Generation failed" error**
   - Verify experience has sufficient detail
   - Check proficiency level is valid (0, 1, or 2)
   - Retry if AI service is temporarily unavailable

3. **Character limit exceeded**
   - Review and shorten response sections
   - Focus on most impactful content
   - Use concise, professional language

4. **Compliance showing incorrect status**
   - Refresh compliance check
   - Ensure all current responses are marked
   - Check experience dates fall within 30 months

## FAQs

**Q: How often should I update my PERT responses?**
A: Review and update quarterly or when you gain significant new experience in a competency area.

**Q: Can I have multiple responses for the same competency?**
A: Yes, but only one can be marked as "current" for EVR submission.

**Q: How accurate is the AI analysis?**
A: AI provides a strong starting point with 80-90% accuracy, but always review and personalize responses.

**Q: Is my data secure?**
A: Yes, all data is encrypted and isolated. Only you can access your PERT responses.

**Q: Can I export my responses?**
A: Yes, you can export individual responses or download all responses as a text file.

## Future Enhancements

### Planned Features
1. CPA mentor review workflow
2. Direct EVR submission integration
3. Peer response examples (anonymized)
4. Mobile app support
5. Advanced analytics and insights

### Integration Roadmap
1. LinkedIn experience import
2. Resume synchronization
3. CPA Canada portal integration
4. Practice case integration

## Support

For technical support or feature requests:
1. Check the documentation
2. Contact support through the Help menu
3. Submit issues via GitHub

## Changelog

### Version 1.0 (January 2025)
- Initial release
- Core competency mapping
- PERT response generation
- EVR compliance tracking
- Response management

---

Last Updated: January 30, 2025