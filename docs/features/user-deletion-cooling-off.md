# User Deletion with 7-Day Cooling-Off Period

## Overview

Pathfinder implements a comprehensive user deletion system with a 7-day cooling-off period to protect users from accidental or impulsive account deletion. This feature ensures GDPR compliance while maintaining data safety and user protection.

## Key Features

### 7-Day Cooling-Off Period
- Users who request account deletion have 7 days to change their mind
- Account remains fully accessible during the cooling-off period
- Deletion can be cancelled at any time before the 7-day period expires
- Automatic reminders sent on days 1, 3, and 6

### Data Protection
- Complete data export provided before deletion
- 30-day recovery window for deleted accounts (admin assistance required)
- Secure backup storage with encryption
- Audit trail for all deletion activities

### Administrative Controls
- Site administrators can override the cooling-off period for immediate deletion
- Site administrators can recover deleted accounts within 30 days
- Comprehensive deletion queue management
- Real-time statistics and monitoring

## User Experience

### Requesting Deletion

1. Navigate to Account Settings
2. Click "Delete Account"
3. Select reason for deletion (optional)
4. Type "DELETE" to confirm
5. Acknowledge the cooling-off period
6. Receive confirmation email with cancellation token

### During Cooling-Off Period

Users will see:
- Warning banner on all pages
- Countdown timer showing days remaining
- Cancel button prominently displayed
- Access to all features remains available

### Email Reminders

| Day | Email Type | Content |
|-----|------------|---------|
| 0 | Confirmation | Deletion scheduled, cancellation instructions |
| 1 | Reminder 1 | 6 days remaining, cancellation link |
| 3 | Reminder 2 | 4 days remaining, cancellation link |
| 6 | Final Warning | 24 hours remaining, urgent action required |
| 7 | Completion | Account deleted confirmation |

## Cancellation Process

### Via Web Interface
1. Click "Cancel Deletion" button in warning banner
2. Confirm cancellation
3. Account immediately restored to normal status

### Via Email Link
1. Click cancellation link in any reminder email
2. Confirm identity if required
3. Deletion request cancelled

### Via API
```bash
POST /api/users/{userId}/cancel-deletion
{
  "cancellation_token": "your-token-here"
}
```

## Administrator Functions

### Override Cooling-Off Period

Site administrators can immediately delete accounts in special circumstances:

```bash
POST /api/admin/users/{userId}/override-deletion
Authorization: Bearer {admin-token}
```

**Use cases:**
- Legal requirements
- Security incidents
- User safety concerns
- Compliance requests

### Recover Deleted User

Within 30 days of deletion, site administrators can recover accounts:

```bash
POST /api/admin/users/{userId}/recover
Authorization: Bearer {site-admin-token}
```

**Recovery includes:**
- All user data
- Profile information
- Experiences and career data
- Preferences and settings

### Monitor Deletion Queue

```bash
GET /api/admin/deletion-queue?status=pending
```

Returns:
- Pending deletions
- Scheduled dates
- User information
- Cancellation status

## Data Export

### Automatic Export
- Triggered when deletion is requested
- Completed within 24 hours
- Download link sent via email
- Available for 30 days

### Export Contents
- User profile (JSON)
- All experiences (JSON)
- Career data (JSON)
- Session history (JSON)
- Audit logs (JSON)
- Custom data tables (JSON)
- README with instructions

### Export Format
```
user-export-{uuid}.zip
├── README.md
├── metadata.json
├── user.json
├── profile.json
├── sessions.json
├── roles.json
├── preferences.json
├── audit_log.json
└── custom_tables/
    ├── experiences.json
    └── career_paths.json
```

## GDPR Compliance

### Right to Erasure (Article 17)
- Users can request deletion at any time
- Processing completed within 30 days
- Confirmation provided upon completion

### Data Portability (Article 20)
- Complete data export in machine-readable format
- Provided before deletion
- Can be transferred to other services

### Anonymization Option
- Alternative to complete deletion
- Preserves aggregated data for analytics
- Personal identifiers removed
- Complies with "privacy by design"

## Security Considerations

### Authentication
- Deletion requires authenticated session
- Cancellation requires valid token
- Admin actions require site_admin role

### Audit Logging
- All deletion requests logged
- Cancellations tracked
- Admin overrides flagged as critical
- Recovery actions logged

### Data Protection
- Backups encrypted at rest
- Secure token generation
- Time-limited recovery window
- Automatic cleanup of old backups

## API Reference

### Request Deletion
```http
DELETE /api/users/{userId}
Content-Type: application/json
Authorization: Bearer {token}

{
  "confirmation": "DELETE",
  "reason": "Optional reason"
}
```

### Cancel Deletion
```http
POST /api/users/{userId}/cancel-deletion
Content-Type: application/json
Authorization: Bearer {token}

{
  "cancellation_token": "token-from-email"
}
```

### Check Status
```http
GET /api/users/{userId}/deletion-status
Authorization: Bearer {token}
```

Response:
```json
{
  "isScheduled": true,
  "scheduledFor": "2024-01-07T00:00:00Z",
  "requestedAt": "2024-01-01T00:00:00Z",
  "canCancel": true,
  "type": "soft",
  "reason": "User requested"
}
```

## Database Schema

### Deletion Queue Table
```sql
pf_user_deletion_queue
├── user_id (PK)
├── deletion_requested_at
├── deletion_scheduled_for
├── deletion_type
├── requested_by
├── cancellation_token
├── status
├── reminder_1_sent
├── reminder_3_sent
├── reminder_6_sent
└── processed_at
```

### Backup Table
```sql
pf_deleted_users_backup
├── deletion_id (PK)
├── user_id
├── user_data (CLOB)
├── deleted_at
├── recovery_available_until
└── recovered
```

## Configuration

### Environment Variables
```bash
# Email configuration
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASS=password
EMAIL_FROM="Pathfinder <noreply@example.com>"

# Export configuration
EXPORT_PATH=/var/exports
API_BASE_URL=https://api.example.com

# Timing configuration
DELETION_COOLING_OFF_DAYS=7
DELETION_RECOVERY_DAYS=30
REMINDER_SCHEDULE="1,3,6"
```

### Scheduled Jobs
```javascript
// Cron schedule configuration
{
  reminders: '0 * * * *',      // Every hour
  processing: '*/15 * * * *',   // Every 15 minutes
  cleanup: '0 3 * * *'          // Daily at 3 AM
}
```

## Troubleshooting

### Common Issues

**Deletion not processing after 7 days**
- Check scheduled job status
- Verify database connectivity
- Review error logs for failed attempts

**Emails not being sent**
- Verify SMTP configuration
- Check email service status
- Review email queue for failures

**Cannot cancel deletion**
- Verify cancellation token is valid
- Check if 7-day period has expired
- Ensure user is authenticated

**Export not available**
- Check export service status
- Verify storage permissions
- Review export queue for errors

### Support Procedures

1. **User wants immediate deletion**
   - Explain cooling-off period purpose
   - Escalate to site admin if necessary
   - Document reason for override

2. **Accidental deletion after 7 days**
   - Check if within 30-day recovery window
   - Site admin performs recovery
   - User data fully restored

3. **Missing cancellation token**
   - Verify user identity
   - Manually cancel via admin interface
   - Generate new cancellation link if needed

## Best Practices

### For Users
- Export data before requesting deletion
- Save cancellation token securely
- Review reminder emails carefully
- Cancel promptly if unsure

### For Administrators
- Monitor deletion queue regularly
- Document all override decisions
- Test recovery procedures monthly
- Review audit logs for anomalies

### For Developers
- Test deletion flow in staging
- Implement proper error handling
- Log all deletion operations
- Maintain backup integrity

## Compliance Checklist

- [ ] GDPR Article 17 compliance
- [ ] CCPA deletion rights
- [ ] HIPAA retention requirements
- [ ] Data export functionality
- [ ] Audit trail maintenance
- [ ] Secure backup storage
- [ ] Recovery procedures tested
- [ ] Documentation updated