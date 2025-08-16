# Site Admin Provisioning Runbook

## Overview

This runbook provides step-by-step instructions for provisioning the site admin during initial deployment of the Pathfinder system. The site admin is the root-level administrator with full system access.

## Prerequisites

- [ ] Database server is running and accessible
- [ ] Database migrations have been executed
- [ ] Environment variables are configured
- [ ] Physical or console access to the server (for production)
- [ ] Deployment credentials are available

## Environment Variables Required

```bash
# Required
DATABASE_URL=oracle://connection_string
JWT_SECRET=64_character_hex_string
ENCRYPTION_KEY=32_character_hex_string

# Recommended
SITE_ADMIN_USERNAME=siteadmin
SITE_ADMIN_EMAIL=admin@company.com
APP_URL=https://pathfinder.company.com
ENABLE_MFA=true
PROVISIONING_ALERT_WEBHOOK=https://alerts.company.com/webhook
```

## Provisioning Process

### Step 1: Verify Environment

```bash
# Check environment setup
npm run env:check

# Verify database connectivity
npm run db:ping

# Check migration status
npm run db:status
```

### Step 2: Run Database Migrations

```bash
# Execute all migrations
npm run db:migrate

# Verify migrations
npm run db:verify
```

### Step 3: Execute Site Admin Provisioning

```bash
# Run provisioning script
npm run provision:site-admin

# For production with explicit environment
NODE_ENV=production npm run provision:site-admin

# With custom username
SITE_ADMIN_USERNAME=admin npm run provision:site-admin
```

### Step 4: Save Credentials

When the provisioning completes, you will see:

```
========================================
   SITE ADMIN CREDENTIALS - SAVE IMMEDIATELY
========================================

📌 LOGIN CREDENTIALS:
   Username: siteadmin
   Password: Xk9#mL2$pQ8!nR5@vT7&
   Email:    admin@company.com
   URL:      https://pathfinder.company.com

🔐 MULTI-FACTOR AUTHENTICATION:
   Secret Key: JBSWY3DPEHPK3PXP
   [QR Code displayed]

🔑 RECOVERY CODES (KEEP SAFE):
   01. A1B2-C3D4    02. E5F6-G7H8
   03. I9J0-K1L2    04. M3N4-O5P6
   05. Q7R8-S9T0    06. U1V2-W3X4
   07. Y5Z6-A7B8    08. C9D0-E1F2
   09. G3H4-I5J6    10. K7L8-M9N0

⚠️ IMPORTANT SECURITY NOTES:
   • Password expires in: 24 hours
   • MUST change password on first login
   • MFA is MANDATORY for site admin
   • Store recovery codes in a secure location
   • This information will NOT be shown again
```

**CRITICAL**: Copy and securely store all credentials immediately!

### Step 5: First Login

1. Navigate to the application URL
2. Enter username and temporary password
3. You will be prompted to change the password
4. Set up MFA using the secret key or QR code
5. Save the recovery codes securely

### Step 6: Post-Provisioning Tasks

- [ ] Verify login with new credentials
- [ ] Confirm MFA is working
- [ ] Test one recovery code (optional)
- [ ] Configure admin notifications
- [ ] Review audit logs
- [ ] Document provisioning in change log

## Troubleshooting

### Issue: "Site admin already exists"

```bash
# Check existing admin
npm run admin:status

# If locked out, use emergency recovery
npm run recovery:emergency
```

### Issue: "Database connection failed"

```bash
# Test database connection
npm run db:test

# Check environment variables
echo $DATABASE_URL

# Verify network connectivity
telnet database-host 1521
```

### Issue: "Migrations not found"

```bash
# Run migrations manually
cd backend
npm run db:migrate

# Check migration files exist
ls -la backend/src/database/migrations/
```

### Issue: "MFA setup failed"

1. Ensure authenticator app is synchronized
2. Check system time is correct
3. Try manual entry of secret key
4. Use recovery code if locked out

## Security Considerations

### Production Requirements

1. **Physical Access**: Must run from server console, not SSH
2. **Audit Logging**: All provisioning is logged
3. **Alerts**: Security team notified automatically
4. **Encryption**: Credentials encrypted at rest
5. **Expiry**: Temporary password expires in 24 hours

### Password Requirements

- Minimum 20 characters
- Contains uppercase, lowercase, numbers, special characters
- Cryptographically secure generation
- Must be changed on first login
- Cannot be reused (history tracked)

### Recovery Codes

- 10 single-use codes generated
- Each code is 8 characters (XXXX-XXXX format)
- Valid for 1 year
- Should be printed and stored securely
- Can be regenerated if lost (invalidates old codes)

## Monitoring & Alerts

### Automatic Alerts Triggered

1. Site admin provisioning started
2. Site admin successfully created
3. Provisioning failures
4. Emergency recovery attempts
5. Multiple failed login attempts

### Audit Log Entries

All provisioning activities create audit log entries:

```sql
SELECT * FROM pf_audit_log 
WHERE event_type LIKE 'site_admin%'
ORDER BY created_at DESC;
```

### Monitoring Dashboard

Check provisioning status:

```bash
# API endpoint
GET /api/admin/provisioning/status

# CLI command
npm run admin:monitor
```

## Emergency Procedures

### Lost Credentials

If site admin credentials are lost:

1. Attempt recovery with recovery codes
2. Use emergency recovery procedure
3. Contact security team for override

### Emergency Recovery

**Requirements**:
- Physical server access
- Recovery code or emergency 2FA
- Security team authorization

```bash
# Start emergency recovery
npm run recovery:emergency

# Follow prompts for authentication
# Select recovery method:
#   1. Reset password
#   2. Unlock account
#   3. Create temporary admin
#   4. Override and create new admin
```

### Rollback Procedure

If provisioning fails or needs rollback:

```bash
# Check provisioning status
npm run provision:status

# Rollback last provisioning
npm run provision:rollback

# Clean up failed attempts
npm run provision:cleanup
```

## Compliance & Documentation

### Required Documentation

- [ ] Record provisioning date/time
- [ ] Document who performed provisioning
- [ ] Note any issues encountered
- [ ] Confirm security controls enabled
- [ ] Update access control matrix

### Compliance Checks

- HIPAA: Administrative safeguards documented
- SOC2: Privileged access management recorded
- ISO 27001: Access provisioning logged
- PCI-DSS: Strong authentication enforced

### Change Log Entry

```markdown
## [Date] Site Admin Provisioned

**Performed by**: [Your Name]
**Ticket**: [Ticket Number]
**Environment**: Production
**Username**: siteadmin
**MFA Enabled**: Yes
**Recovery Codes**: Generated (10)
**Audit Log ID**: [UUID from logs]
**Notes**: [Any relevant notes]
```

## Contact Information

### Support Channels

- **Security Team**: security@company.com
- **DevOps Team**: devops@company.com
- **On-Call**: PagerDuty escalation
- **Documentation**: https://docs.pathfinder.com

### Escalation Path

1. Team Lead
2. Security Team
3. Platform Engineering
4. CTO/CISO

## Appendix

### Script Locations

- Provisioning: `/backend/scripts/provision-site-admin.js`
- Recovery: `/backend/scripts/emergency-recovery.js`
- Migrations: `/backend/src/database/migrations/`

### Configuration Files

- Environment: `.env`
- Database: `/backend/src/config/database.js`
- Security: `/backend/src/config/security.js`

### Related Documentation

- [Emergency Recovery Procedures](./emergency-recovery.md)
- [Security Best Practices](../security/best-practices.md)
- [MFA Setup Guide](../guides/mfa-setup.md)
- [Audit Log Review](../guides/audit-logs.md)