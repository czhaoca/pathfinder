# CPA PERT Writer Module (Enhanced)

## Overview

The CPA PERT Writer is a specialized module for managing Professional Experience Reporting Tool (PERT) submissions for CPA candidates. It supports both Employment Verification Route (EVR) and Practical Experience Route (PPR) with comprehensive tracking and submission management.

## Key Features

### 🗓️ Complete Time Frame Tracking
- **Date Range Support**: Track experience periods with start and end dates
- **Duration Calculation**: Automatic calculation of experience duration
- **Report Periods**: Define reporting periods for compliance
- **Submission Deadlines**: Track and manage submission deadlines

### 📊 Experience Breakdown
- **Activity Tracking**: Break down experiences into discrete activities
  - Planning phases
  - Execution phases
  - Review and documentation
  - Analysis and presentation
- **Hours Allocation**: Track hours spent on each activity
- **Competency Mapping**: Link activities to specific competencies
- **Deliverables Tracking**: Document outputs and deliverables

### 📈 Progress Tracking
- **Milestone Recording**: Track progression through competency levels
- **Hours Accumulation**: Monitor total hours per competency
- **Evidence Collection**: Link experiences to competency evidence
- **Mentor Feedback**: Capture and store mentor assessments
- **Self-Assessment**: Document personal progress evaluations

### 📤 Submission Management
- **Version Control**: Track all versions of experiences and reports
- **Submission Types**: Support draft, final, and revision submissions
- **CPA Integration**: Direct submission to CPA with reference tracking
- **Confirmation Codes**: Store CPA confirmation and reference numbers
- **Export Formats**: Support PDF, DOCX, XML, and JSON exports
- **Integrity Checking**: SHA-256 checksums for submission verification

### ⏱️ Time Tracking
- **Daily Logging**: Track time spent on experiences daily
- **Activity Categories**: Classify time by activity type
  - Direct work
  - Supervision
  - Training
  - Research
  - Documentation
- **Billable Hours**: Track billable vs non-billable time
- **CPA Eligibility**: Flag hours as CPA-eligible or not

## Database Schema

### Core Tables

#### `pf_cpa_pert_reports`
- Manages PERT reports with defined time periods
- Tracks EVR/PPR route type
- Stores employer and position information
- Version control for report updates

#### `pf_cpa_pert_experiences`
- Individual experiences with date ranges
- CARL method fields (Challenge, Actions, Results, Lessons)
- Proficiency level tracking (0, 1, 2)
- Word count and character tracking
- Approval status workflow

#### `pf_cpa_experience_breakdown`
- Detailed activity breakdown per experience
- Activity types and descriptions
- Time allocation per activity
- Competency demonstrations
- Business impact documentation

#### `pf_cpa_progress_milestones`
- Competency progression tracking
- Level achievements with dates
- Evidence accumulation
- Mentor feedback storage
- Next steps planning

#### `pf_cpa_pert_submissions`
- Submission records to CPA
- Submission types and statuses
- CPA reference numbers
- File exports and formats
- Submission checksums

#### `pf_cpa_submission_history`
- Complete audit trail
- Action tracking
- Status transitions
- Reviewer comments
- Attachment management

#### `pf_cpa_experience_time_tracking`
- Daily time logs
- Activity categorization
- Billability tracking
- CPA eligibility flags

## API Endpoints

### Report Management
- `POST /api/cpa-pert/enhanced/reports` - Create new report
- `GET /api/cpa-pert/enhanced/reports` - List user reports
- `GET /api/cpa-pert/enhanced/reports/:id` - Get report details
- `PUT /api/cpa-pert/enhanced/reports/:id` - Update report

### Experience Management
- `POST /reports/:id/experiences` - Add experience
- `PUT /experiences/:id` - Update experience (creates version)
- `DELETE /experiences/:id` - Soft delete experience
- `GET /experiences/:id/versions` - Get version history

### Experience Breakdown
- `POST /experiences/:id/breakdown` - Add activity breakdown
- `GET /experiences/:id/breakdown` - Get breakdown details
- `PUT /breakdown/:id` - Update breakdown entry

### Time Tracking
- `POST /experiences/:id/time-tracking` - Log daily time
- `GET /experiences/:id/time-tracking` - Get time logs
- `GET /reports/:id/time-summary` - Get time summary

### Progress Tracking
- `POST /progress/milestones` - Record milestone
- `GET /progress/timeline` - Get progress timeline
- `GET /progress/summary` - Get overall progress

### Submission Management
- `POST /reports/:id/submit-to-cpa` - Submit to CPA
- `GET /reports/:id/submission-history` - Get history
- `POST /submissions/:id/withdraw` - Withdraw submission
- `GET /submissions/:id/status` - Check status

### Export & Templates
- `GET /reports/:id/export` - Export report
- `GET /templates` - Get experience templates
- `POST /templates/:id/generate` - Generate from template

## Usage Examples

### Creating a Report with Time Period

```javascript
const report = await cpaPertService.createReport({
  user_id: 'user-123',
  report_period_start: '2024-01-01',
  report_period_end: '2024-06-30',
  submission_deadline: '2024-07-15',
  route_type: 'EVR',
  employer_name: 'ABC Company',
  position_title: 'Senior Accountant',
  hours_worked: 900
});
```

### Adding Experience with Date Range

```javascript
const experience = await cpaPertService.addExperience({
  report_id: report.id,
  sub_competency_id: 'FR.1.1',
  experience_title: 'Year-End Financial Reporting',
  experience_start_date: '2024-01-15',
  experience_end_date: '2024-02-28',
  proficiency_level: 1,
  challenge: 'Complex consolidation requirements...',
  actions: 'Developed automated consolidation process...',
  results: 'Reduced reporting time by 40%...',
  lessons_learned: 'Importance of automation...',
  time_spent_hours: 120,
  complexity_level: 'complex'
});
```

### Breaking Down Experience Activities

```javascript
await cpaPertService.addExperienceBreakdown({
  experience_id: experience.id,
  activity_type: 'planning',
  activity_description: 'Designed consolidation framework',
  start_date: '2024-01-15',
  end_date: '2024-01-20',
  hours_spent: 20,
  competencies_demonstrated: ['FR.1.1', 'PS.2.1'],
  deliverables: ['Framework Document', 'Process Map'],
  business_impact: 'Standardized consolidation approach'
});

await cpaPertService.addExperienceBreakdown({
  experience_id: experience.id,
  activity_type: 'execution',
  activity_description: 'Implemented automated processes',
  start_date: '2024-01-21',
  end_date: '2024-02-15',
  hours_spent: 80,
  competencies_demonstrated: ['FR.1.1', 'MA.2.3'],
  deliverables: ['Automation Scripts', 'Consolidated Reports'],
  business_impact: 'Reduced manual effort by 60%'
});
```

### Tracking Daily Time

```javascript
await cpaPertService.trackExperienceTime({
  experience_id: experience.id,
  user_id: 'user-123',
  activity_date: '2024-01-20',
  hours_logged: 8,
  activity_category: 'direct_work',
  description: 'Developed consolidation framework',
  is_billable: 'Y',
  is_cpa_eligible: 'Y'
});
```

### Recording Progress Milestone

```javascript
await cpaPertService.recordProgressMilestone({
  user_id: 'user-123',
  sub_competency_id: 'FR.1.1',
  milestone_date: '2024-03-01',
  previous_level: 0,
  achieved_level: 1,
  evidence_count: 5,
  hours_accumulated: 200,
  key_experiences: [experience.id],
  mentor_feedback: 'Demonstrated strong understanding',
  self_assessment: 'Confident at Level 1',
  next_steps: 'Focus on Level 2 complexity'
});
```

### Submitting to CPA

```javascript
const submission = await cpaPertService.submitReportToCPA(
  report.id,
  'user-123',
  {
    submission_type: 'final',
    submission_deadline: '2024-07-15',
    exported_file_format: 'pdf'
  }
);

console.log('Submission Reference:', submission.cpa_reference_number);
console.log('Checksum:', submission.submission_checksum);
```

## Compliance Features

### Character Limits
- Level 0: 350 characters
- Level 1: 500 characters  
- Level 2: 700 characters

### Word Count Tracking
- Automatic word and character counting
- Validation against proficiency level limits
- Warning system for approaching limits

### CARL Method Validation
- Ensures all four components are present
- Minimum length requirements
- Structure validation

### Version Control
- All changes create new versions
- Original entries preserved
- Complete audit trail
- Rollback capability

## Security & Privacy

### Data Protection
- User-specific data isolation
- Encrypted sensitive fields
- Audit logging for all operations
- HIPAA-compliant storage

### Access Control
- JWT authentication required
- User ownership verification
- Role-based permissions
- Rate limiting on submissions

## Integration

### MCP Server
- Contextual AI assistance
- Experience writing help
- Competency mapping suggestions
- Quality improvement recommendations

### Export Formats
- **PDF**: Formatted reports for printing
- **DOCX**: Editable Word documents
- **XML**: Structured data for CPA systems
- **JSON**: Complete data export

## Best Practices

1. **Regular Progress Updates**: Record milestones as you achieve them
2. **Detailed Breakdowns**: Use activity breakdowns for complex experiences
3. **Daily Time Tracking**: Log time daily for accuracy
4. **Version Management**: Review versions before submission
5. **Deadline Monitoring**: Set reminders for submission deadlines
6. **Evidence Collection**: Link supporting documents to experiences
7. **Mentor Review**: Get feedback before final submission
8. **Checksum Verification**: Verify checksums after submission

## Support

For issues or questions about the CPA PERT Writer module:
- Documentation: `/docs/addons/cpa-pert-writer/`
- API Reference: `/docs/api/API-REFERENCE.md#cpa-pert-module-enhanced`
- Database Schema: `/docs/architecture/database.md#cpa-pert-module-enhanced`