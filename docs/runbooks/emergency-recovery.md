# Emergency Recovery Procedures

## Overview

This document outlines the emergency recovery procedures for regaining site admin access to the Pathfinder system when normal authentication methods fail. These procedures are designed for critical situations and require special authorization.

## When to Use Emergency Recovery

Emergency recovery should ONLY be used when:

- ✅ Site admin is locked out of the system
- ✅ Password has been forgotten or compromised
- ✅ MFA device is lost or unavailable
- ✅ Recovery codes are exhausted or lost
- ✅ Account is locked due to failed attempts
- ✅ Temporary access needed for incident response

**DO NOT** use emergency recovery for:
- ❌ Routine password resets
- ❌ Creating additional admin accounts
- ❌ Bypassing security policies
- ❌ Testing or training purposes

## Security Requirements

### Physical Access Requirement

Emergency recovery **MUST** be executed from:
- Server console (physical access)
- Virtual machine console (vSphere, Hyper-V)
- Cloud instance console (AWS Systems Manager, Azure Serial Console)

**NOT** permitted from:
- SSH sessions
- Remote desktop connections
- Network-based terminals

### Authentication Methods

At least ONE of the following is required:

1. **Recovery Code** (recommended)
   - Single-use 8-character code (XXXX-XXXX format)
   - Generated during initial provisioning
   - Stored securely offline

2. **Emergency 2FA Token**
   - From designated emergency device
   - Configured separately from primary MFA
   - Time-based OTP (TOTP)

3. **Security Team Authorization**
   - Challenge token verification
   - Out-of-band confirmation
   - Documented approval process

## Recovery Procedures

### Procedure 1: Password Reset (Existing Admin)

Use when: Admin account exists but password is unknown

```bash
# Start recovery
npm run recovery:emergency --method=reset

# System will:
# 1. Verify physical access
# 2. Request authentication (recovery code/2FA)
# 3. Generate new temporary password
# 4. Display credentials once
# 5. Force password change on next login
```

**Output Example:**
```
Recovery Details:
   Method:   reset_password
   Username: siteadmin
   Password: Temporary_P@ssw0rd_2024!
   Expires:  24 hours
   
⚠️ Important:
   • Admin password has been reset
   • All recovery actions have been logged
   • Security team has been notified
```

### Procedure 2: Account Unlock

Use when: Account is locked due to failed login attempts

```bash
# Start recovery
npm run recovery:emergency --method=unlock

# System will:
# 1. Verify physical access
# 2. Request authentication
# 3. Clear failed login counter
# 4. Remove account lockout
# 5. Invalidate suspicious sessions
```

**Actions Taken:**
- Failed login counter reset to 0
- Account status set to 'active'
- Lockout timestamp cleared
- All active sessions terminated

### Procedure 3: Temporary Admin Creation

Use when: Need temporary elevated access without affecting existing admin

```bash
# Start recovery
npm run recovery:emergency --method=temporary

# System will:
# 1. Verify physical access
# 2. Request authentication
# 3. Create temporary admin account
# 4. Set 1-hour expiration
# 5. Display credentials once
```

**Temporary Admin Details:**
- Username: `recovery_admin_[timestamp]`
- Password: Auto-generated 20 characters
- Expiration: 1 hour (not extendable)
- Permissions: Full site_admin role
- Auto-deactivation after expiry

### Procedure 4: Override and Create New Admin

Use when: Existing admin is compromised or inaccessible

```bash
# Start recovery  
npm run recovery:emergency --method=override

# DANGER: This will:
# 1. Deactivate ALL existing site admins
# 2. Create new site admin account
# 3. Generate new credentials
# 4. Require complete re-provisioning
```

**⚠️ WARNING**: This is destructive and should be last resort!

## Step-by-Step Recovery Process

### Step 1: Prepare for Recovery

1. **Gather Information**
   - Current date/time
   - Reason for recovery
   - Incident ticket number
   - Your identification

2. **Notify Team**
   - Inform security team
   - Create incident ticket
   - Document in change log

3. **Access Server Console**
   - Physical access to server room
   - OR Virtual console access
   - Verify no SSH session active

### Step 2: Execute Recovery

1. **Navigate to Application Directory**
   ```bash
   cd /opt/pathfinder/backend
   ```

2. **Run Recovery Script**
   ```bash
   npm run recovery:emergency
   ```

3. **Complete Security Verification**
   ```
   🔒 Performing security checks...
      User: root
      Host: pathfinder-prod-01
      ✓ Security checks completed

   📋 Recovery Challenge Generated:
      a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6

   🔐 Authorization Required:
   Do you have a valid recovery code? (y/n): y
   Enter recovery code (XXXX-XXXX): A1B2-C3D4
   ✓ Recovery code validated
   ```

4. **Select Recovery Method**
   ```
   📋 Select recovery method:
      1. Reset admin password
      2. Unlock admin account  
      3. Create temporary admin
      4. Override and create new admin
   Enter choice (1-4): 1
   ```

5. **Record Credentials**
   - Copy displayed credentials immediately
   - Store securely (password manager)
   - Never share or transmit insecurely

### Step 3: Verify Recovery

1. **Test Login**
   ```bash
   # From a different terminal
   curl -X POST https://pathfinder.company.com/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"siteadmin","password_hash":"..."}'
   ```

2. **Check Audit Logs**
   ```sql
   SELECT * FROM pf_emergency_access_log
   WHERE recovery_admin_id IS NOT NULL
   ORDER BY initiated_at DESC;
   ```

3. **Verify Alerts Sent**
   - Check email notifications
   - Verify webhook delivery
   - Confirm PagerDuty alert

### Step 4: Post-Recovery Actions

**Immediate Actions (Within 1 Hour):**

- [ ] Change temporary password
- [ ] Re-enable MFA
- [ ] Generate new recovery codes
- [ ] Test normal authentication
- [ ] Review audit logs for anomalies

**Follow-up Actions (Within 24 Hours):**

- [ ] Document recovery in incident report
- [ ] Update access control documentation  
- [ ] Review what led to lockout
- [ ] Implement preventive measures
- [ ] Security team debriefing

**Compliance Actions (Within 7 Days):**

- [ ] Complete incident post-mortem
- [ ] Update runbook if needed
- [ ] Report to compliance officer
- [ ] Schedule recovery drill
- [ ] Review security policies

## Troubleshooting Recovery

### Error: "Emergency recovery requires physical server access"

**Cause**: Attempting recovery via SSH or remote connection

**Solution**:
1. Disconnect SSH session
2. Access server console directly
3. Use VM console if virtualized
4. Contact data center for physical access

### Error: "Invalid recovery code"

**Cause**: Code already used, expired, or incorrect

**Solution**:
1. Verify code format (XXXX-XXXX)
2. Check if code was previously used
3. Try different recovery code
4. Use 2FA method instead
5. Contact security team for override

### Error: "Recovery authorization failed"

**Cause**: Failed authentication during recovery

**Solution**:
1. Ensure 2FA device is synchronized
2. Check system time is correct
3. Request new challenge token
4. Get security team authorization
5. Escalate to emergency response team

### Error: "Another recovery in progress"

**Cause**: Previous recovery attempt not completed

**Solution**:
1. Wait 15 minutes for timeout
2. Check for other administrators
3. Review emergency access log
4. Force cleanup if necessary:
   ```sql
   UPDATE pf_emergency_access_log
   SET completed_at = CURRENT_TIMESTAMP
   WHERE completed_at IS NULL
   AND initiated_at < CURRENT_TIMESTAMP - INTERVAL '15' MINUTE;
   ```

## Security Considerations

### Audit Trail

All recovery actions create permanent audit records:

```sql
-- View all recovery attempts
SELECT 
    id,
    recovery_method,
    initiated_at,
    initiated_by,
    completed_at,
    success,
    failure_reason,
    recovery_admin_id,
    ip_address,
    alert_sent
FROM pf_emergency_access_log
ORDER BY initiated_at DESC;
```

### Automatic Alerts

Recovery triggers automatic notifications:

1. **Email Alert** (immediately)
   - To: security@company.com
   - Subject: "🚨 EMERGENCY RECOVERY INITIATED"
   - Contains: User, method, timestamp, host

2. **Webhook Notification** (immediately)
   - URL: Configured webhook endpoint
   - Payload: JSON with full recovery details
   - Retry: 3 attempts with exponential backoff

3. **PagerDuty Alert** (if critical)
   - Service: Pathfinder-Security
   - Urgency: High
   - Auto-escalation: 5 minutes

### Monitoring & Detection

Monitor for suspicious recovery patterns:

```sql
-- Multiple recovery attempts
SELECT COUNT(*) as attempt_count, 
       DATE(initiated_at) as attempt_date
FROM pf_emergency_access_log
WHERE initiated_at > CURRENT_TIMESTAMP - INTERVAL '30' DAY
GROUP BY DATE(initiated_at)
HAVING COUNT(*) > 1;

-- Failed recovery attempts
SELECT * FROM pf_emergency_access_log
WHERE success = 0
AND initiated_at > CURRENT_TIMESTAMP - INTERVAL '7' DAY;

-- Temporary admins still active
SELECT * FROM pf_temporary_admin_sessions
WHERE expires_at > CURRENT_TIMESTAMP
AND revoked = 0;
```

## Recovery Codes Management

### Viewing Recovery Code Status

```bash
# Check recovery code status
curl -X GET https://pathfinder.company.com/api/admin/recovery/codes \
  -H "Authorization: Bearer <token>"
```

### Generating New Recovery Codes

```bash
# Generate new codes (invalidates unused old codes)
curl -X POST https://pathfinder.company.com/api/admin/recovery/generate-codes \
  -H "Authorization: Bearer <token>"
```

**Important**: 
- Generates 10 new codes
- Invalidates all unused existing codes
- Codes valid for 1 year
- Store printed copy securely

## Compliance Requirements

### Documentation Requirements

For each recovery event, document:

1. **Incident Details**
   - Date and time
   - Reason for recovery
   - Method used
   - Person performing recovery

2. **Authorization**
   - How authorization was obtained
   - Who approved (if applicable)
   - Authentication method used

3. **Actions Taken**
   - Specific recovery steps
   - Any deviations from procedure
   - Issues encountered

4. **Verification**
   - Confirmation of access restored
   - Audit log review completed
   - Alerts confirmed sent

### Regulatory Compliance

**HIPAA Requirements:**
- Document administrative safeguard implementation
- Record access control modifications
- Maintain audit trail for 6 years

**SOC2 Requirements:**
- Evidence of privileged access management
- Documentation of emergency procedures
- Proof of monitoring and alerting

**PCI-DSS Requirements:**
- Strong authentication verification
- Documented approval process
- Regular testing of procedures

## Testing & Drills

### Monthly Recovery Drill

Perform monthly test in non-production:

1. Create test scenario
2. Execute recovery procedure
3. Verify all steps work
4. Document any issues
5. Update procedures as needed

### Quarterly Review

Every quarter:
- Review all recovery events
- Analyze patterns or trends
- Update documentation
- Train new team members
- Test alert mechanisms

## Contact Information

### Primary Contacts

**Security Team**
- Email: security@company.com
- Phone: +1-555-SEC-TEAM
- On-call: PagerDuty @security

**Platform Team**
- Email: platform@company.com  
- Phone: +1-555-PLATFORM
- On-call: PagerDuty @platform

### Escalation Path

1. **Level 1**: On-call Engineer
2. **Level 2**: Security Team Lead
3. **Level 3**: Director of Engineering
4. **Level 4**: CTO/CISO

### External Support

**Oracle Support** (for database issues)
- Portal: support.oracle.com
- Phone: +1-800-223-1711
- Priority: Severity 1

**Cloud Provider Support**
- AWS: Through support console
- Azure: Through Azure portal
- GCP: Through Cloud Console

## Appendix

### Related Documentation

- [Site Admin Provisioning](./site-admin-provisioning.md)
- [Security Incident Response](../security/incident-response.md)
- [Audit Log Analysis](../guides/audit-logs.md)
- [MFA Troubleshooting](../guides/mfa-troubleshooting.md)

### Change Log

Document all updates to this procedure:

```markdown
## 2024-01-15 - v1.0
- Initial emergency recovery procedures
- Added 4 recovery methods
- Integrated with audit logging

## 2024-01-20 - v1.1  
- Added troubleshooting section
- Enhanced security checks
- Added compliance requirements
```