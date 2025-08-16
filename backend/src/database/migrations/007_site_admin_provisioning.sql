-- Migration: Site admin provisioning system
-- Issue: #10
-- Description: Create tables for site admin provisioning, recovery codes, MFA, and emergency access

-- Recovery codes table for account recovery
CREATE TABLE IF NOT EXISTS pf_recovery_codes (
    id VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
    user_id VARCHAR2(36) NOT NULL,
    code_hash VARCHAR2(255) NOT NULL, -- SHA-256 hash of recovery code
    code_index NUMBER(3) NOT NULL, -- Index for ordering (1-10)
    used_at TIMESTAMP,
    used_by_ip VARCHAR2(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expires_at TIMESTAMP,
    CONSTRAINT fk_recovery_user FOREIGN KEY (user_id) REFERENCES pf_users(id) ON DELETE CASCADE,
    CONSTRAINT uk_user_code_index UNIQUE (user_id, code_index)
);

-- MFA settings table for multi-factor authentication
CREATE TABLE IF NOT EXISTS pf_mfa_settings (
    id VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
    user_id VARCHAR2(36) NOT NULL UNIQUE,
    mfa_enabled NUMBER(1) DEFAULT 0 CHECK (mfa_enabled IN (0, 1)),
    mfa_type VARCHAR2(20) DEFAULT 'totp' CHECK (mfa_type IN ('totp', 'sms', 'email', 'hardware')),
    secret_encrypted VARCHAR2(500), -- Encrypted TOTP secret
    backup_codes_generated NUMBER(1) DEFAULT 0 CHECK (backup_codes_generated IN (0, 1)),
    phone_number VARCHAR2(20), -- For SMS MFA
    phone_verified NUMBER(1) DEFAULT 0 CHECK (phone_verified IN (0, 1)),
    email_verified NUMBER(1) DEFAULT 0 CHECK (email_verified IN (0, 1)),
    last_used TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_mfa_user FOREIGN KEY (user_id) REFERENCES pf_users(id) ON DELETE CASCADE
);

-- Emergency access log for tracking recovery attempts
CREATE TABLE IF NOT EXISTS pf_emergency_access_log (
    id VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
    recovery_method VARCHAR2(50) CHECK (recovery_method IN ('recovery_code', 'physical_access', 'support_ticket', 'emergency_override')),
    initiated_at TIMESTAMP NOT NULL,
    initiated_by VARCHAR2(100), -- Username or system identifier
    completed_at TIMESTAMP,
    success NUMBER(1) DEFAULT 0 CHECK (success IN (0, 1)),
    failure_reason VARCHAR2(500),
    recovery_admin_id VARCHAR2(36),
    challenge_token VARCHAR2(255),
    validation_method VARCHAR2(100),
    ip_address VARCHAR2(45),
    user_agent VARCHAR2(500),
    server_hostname VARCHAR2(255),
    alert_sent NUMBER(1) DEFAULT 0 CHECK (alert_sent IN (0, 1)),
    alert_sent_at TIMESTAMP,
    alert_channels VARCHAR2(255), -- JSON array of channels
    notes CLOB,
    metadata CLOB CHECK (metadata IS JSON),
    CONSTRAINT fk_recovery_admin FOREIGN KEY (recovery_admin_id) REFERENCES pf_users(id)
);

-- Site admin provisioning status table
CREATE TABLE IF NOT EXISTS pf_site_admin_provisioning (
    id VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
    provisioning_status VARCHAR2(50) NOT NULL CHECK (provisioning_status IN ('pending', 'in_progress', 'completed', 'failed', 'rolled_back')),
    provisioned_user_id VARCHAR2(36),
    provisioned_username VARCHAR2(100),
    provisioning_method VARCHAR2(50) CHECK (provisioning_method IN ('deployment_script', 'manual', 'api', 'emergency')),
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    deployed_by VARCHAR2(100), -- System user or deployment tool
    deployment_environment VARCHAR2(50), -- dev, staging, production
    deployment_version VARCHAR2(50),
    password_displayed NUMBER(1) DEFAULT 0 CHECK (password_displayed IN (0, 1)),
    password_displayed_at TIMESTAMP,
    mfa_configured NUMBER(1) DEFAULT 0 CHECK (mfa_configured IN (0, 1)),
    recovery_codes_generated NUMBER(3) DEFAULT 0,
    first_login_at TIMESTAMP,
    password_changed_at TIMESTAMP,
    error_message VARCHAR2(1000),
    rollback_performed NUMBER(1) DEFAULT 0 CHECK (rollback_performed IN (0, 1)),
    rollback_at TIMESTAMP,
    audit_logged NUMBER(1) DEFAULT 0 CHECK (audit_logged IN (0, 1)),
    alerts_sent CLOB CHECK (alerts_sent IS JSON), -- JSON array of alert details
    CONSTRAINT fk_provisioned_user FOREIGN KEY (provisioned_user_id) REFERENCES pf_users(id)
);

-- Provisioning alerts configuration
CREATE TABLE IF NOT EXISTS pf_provisioning_alerts (
    id VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
    alert_type VARCHAR2(50) NOT NULL CHECK (alert_type IN ('email', 'webhook', 'slack', 'pagerduty', 'sms')),
    alert_config CLOB NOT NULL CHECK (alert_config IS JSON), -- Configuration details
    enabled NUMBER(1) DEFAULT 1 CHECK (enabled IN (0, 1)),
    test_mode NUMBER(1) DEFAULT 0 CHECK (test_mode IN (0, 1)),
    last_triggered TIMESTAMP,
    trigger_count NUMBER(10) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Temporary admin sessions for emergency recovery
CREATE TABLE IF NOT EXISTS pf_temporary_admin_sessions (
    id VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
    admin_user_id VARCHAR2(36) NOT NULL,
    session_token_hash VARCHAR2(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_reason VARCHAR2(500) NOT NULL,
    created_by VARCHAR2(100),
    revoked NUMBER(1) DEFAULT 0 CHECK (revoked IN (0, 1)),
    revoked_at TIMESTAMP,
    revoked_by VARCHAR2(36),
    revoked_reason VARCHAR2(500),
    last_activity TIMESTAMP,
    actions_performed CLOB CHECK (actions_performed IS JSON), -- Audit trail
    CONSTRAINT fk_temp_admin_user FOREIGN KEY (admin_user_id) REFERENCES pf_users(id),
    CONSTRAINT fk_revoked_by_user FOREIGN KEY (revoked_by) REFERENCES pf_users(id)
);

-- Create indexes for performance
CREATE INDEX idx_recovery_codes_user ON pf_recovery_codes(user_id, used_at);
CREATE INDEX idx_recovery_codes_expires ON pf_recovery_codes(expires_at);
CREATE INDEX idx_mfa_user_enabled ON pf_mfa_settings(user_id, mfa_enabled);
CREATE INDEX idx_emergency_log_time ON pf_emergency_access_log(initiated_at DESC);
CREATE INDEX idx_emergency_log_admin ON pf_emergency_access_log(recovery_admin_id);
CREATE INDEX idx_provisioning_status ON pf_site_admin_provisioning(provisioning_status, completed_at);
CREATE INDEX idx_temp_sessions_expires ON pf_temporary_admin_sessions(expires_at);
CREATE INDEX idx_temp_sessions_token ON pf_temporary_admin_sessions(session_token_hash);

-- Create function to check if site admin exists
CREATE OR REPLACE FUNCTION check_site_admin_exists 
RETURN NUMBER 
IS
    v_count NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM pf_users u
    JOIN pf_user_roles ur ON u.id = ur.user_id
    WHERE ur.role_id = (SELECT id FROM pf_roles WHERE name = 'site_admin')
    AND ur.is_active = 1
    AND u.status = 'active';
    
    IF v_count > 0 THEN
        RETURN 1;
    ELSE
        RETURN 0;
    END IF;
END check_site_admin_exists;
/

-- Create procedure for emergency recovery
CREATE OR REPLACE PROCEDURE initiate_emergency_recovery(
    p_challenge_token IN VARCHAR2,
    p_recovery_method IN VARCHAR2,
    p_initiated_by IN VARCHAR2,
    p_ip_address IN VARCHAR2,
    p_result OUT VARCHAR2
) AS
    v_log_id VARCHAR2(36);
    v_existing_admin NUMBER;
BEGIN
    -- Generate log ID
    v_log_id := SYS_GUID();
    
    -- Check if site admin already exists
    v_existing_admin := check_site_admin_exists();
    
    -- Log the recovery attempt
    INSERT INTO pf_emergency_access_log (
        id, recovery_method, initiated_at, initiated_by,
        challenge_token, ip_address, success
    ) VALUES (
        v_log_id, p_recovery_method, CURRENT_TIMESTAMP, p_initiated_by,
        p_challenge_token, p_ip_address, 0
    );
    
    -- If site admin exists, require additional validation
    IF v_existing_admin = 1 THEN
        p_result := 'REQUIRES_ADDITIONAL_VALIDATION';
    ELSE
        p_result := 'PROCEED_WITH_RECOVERY';
    END IF;
    
    COMMIT;
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        p_result := 'ERROR: ' || SQLERRM;
END initiate_emergency_recovery;
/

-- Create procedure to validate provisioning attempt
CREATE OR REPLACE PROCEDURE validate_provisioning_attempt(
    p_username IN VARCHAR2,
    p_can_proceed OUT NUMBER,
    p_message OUT VARCHAR2
) AS
    v_existing_count NUMBER;
    v_pending_count NUMBER;
BEGIN
    -- Check for existing site admin
    SELECT COUNT(*) INTO v_existing_count
    FROM pf_users u
    JOIN pf_user_roles ur ON u.id = ur.user_id
    WHERE ur.role_id = (SELECT id FROM pf_roles WHERE name = 'site_admin')
    AND ur.is_active = 1;
    
    IF v_existing_count > 0 THEN
        p_can_proceed := 0;
        p_message := 'Site admin already exists';
        RETURN;
    END IF;
    
    -- Check for pending provisioning
    SELECT COUNT(*) INTO v_pending_count
    FROM pf_site_admin_provisioning
    WHERE provisioning_status IN ('pending', 'in_progress')
    AND started_at > CURRENT_TIMESTAMP - INTERVAL '1' HOUR;
    
    IF v_pending_count > 0 THEN
        p_can_proceed := 0;
        p_message := 'Provisioning already in progress';
        RETURN;
    END IF;
    
    -- Check if username already exists
    SELECT COUNT(*) INTO v_existing_count
    FROM pf_users
    WHERE username = p_username;
    
    IF v_existing_count > 0 THEN
        p_can_proceed := 0;
        p_message := 'Username already exists';
        RETURN;
    END IF;
    
    p_can_proceed := 1;
    p_message := 'Provisioning can proceed';
    
END validate_provisioning_attempt;
/

-- Create view for monitoring provisioning status
CREATE OR REPLACE VIEW v_provisioning_status AS
SELECT 
    p.id,
    p.provisioning_status,
    p.provisioned_username,
    p.provisioning_method,
    p.started_at,
    p.completed_at,
    p.deployment_environment,
    p.first_login_at,
    p.password_changed_at,
    CASE 
        WHEN p.provisioning_status = 'completed' AND p.password_changed_at IS NOT NULL THEN 'fully_activated'
        WHEN p.provisioning_status = 'completed' AND p.first_login_at IS NOT NULL THEN 'awaiting_password_change'
        WHEN p.provisioning_status = 'completed' THEN 'awaiting_first_login'
        WHEN p.provisioning_status = 'failed' THEN 'failed'
        WHEN p.provisioning_status = 'rolled_back' THEN 'rolled_back'
        ELSE 'in_progress'
    END AS activation_status,
    u.status AS user_status,
    u.last_login,
    m.mfa_enabled,
    m.mfa_type
FROM pf_site_admin_provisioning p
LEFT JOIN pf_users u ON p.provisioned_user_id = u.id
LEFT JOIN pf_mfa_settings m ON u.id = m.user_id
ORDER BY p.started_at DESC;

-- Create view for emergency access monitoring
CREATE OR REPLACE VIEW v_emergency_access_monitor AS
SELECT 
    e.id,
    e.recovery_method,
    e.initiated_at,
    e.initiated_by,
    e.completed_at,
    e.success,
    e.failure_reason,
    e.ip_address,
    e.alert_sent,
    u.username AS recovery_admin_username,
    CASE 
        WHEN e.completed_at IS NULL AND 
             e.initiated_at > CURRENT_TIMESTAMP - INTERVAL '15' MINUTE THEN 'in_progress'
        WHEN e.completed_at IS NULL THEN 'abandoned'
        WHEN e.success = 1 THEN 'successful'
        ELSE 'failed'
    END AS status,
    ROUND((CURRENT_TIMESTAMP - e.initiated_at) * 24 * 60) AS minutes_elapsed
FROM pf_emergency_access_log e
LEFT JOIN pf_users u ON e.recovery_admin_id = u.id
WHERE e.initiated_at > CURRENT_TIMESTAMP - INTERVAL '7' DAY
ORDER BY e.initiated_at DESC;

-- Insert default alert configurations
INSERT INTO pf_provisioning_alerts (alert_type, alert_config, enabled) VALUES (
    'email',
    JSON_OBJECT(
        'to' VALUE 'security@company.com',
        'subject' VALUE 'Pathfinder Site Admin Provisioning Alert',
        'priority' VALUE 'high'
    ),
    1
);

INSERT INTO pf_provisioning_alerts (alert_type, alert_config, enabled) VALUES (
    'webhook',
    JSON_OBJECT(
        'url' VALUE '${PROVISIONING_ALERT_WEBHOOK}',
        'method' VALUE 'POST',
        'headers' VALUE JSON_OBJECT('Content-Type' VALUE 'application/json'),
        'retry_count' VALUE 3
    ),
    0  -- Disabled by default, enable when webhook URL is configured
);

-- Grant necessary permissions
GRANT SELECT ON v_provisioning_status TO pf_app_role;
GRANT SELECT ON v_emergency_access_monitor TO pf_app_role;
GRANT EXECUTE ON check_site_admin_exists TO pf_app_role;
GRANT EXECUTE ON validate_provisioning_attempt TO pf_app_role;
GRANT EXECUTE ON initiate_emergency_recovery TO pf_app_role;

-- Add audit log entry for migration
INSERT INTO pf_audit_log (
    event_type,
    event_category,
    event_status,
    event_description,
    metadata
) VALUES (
    'migration_executed',
    'system',
    'success',
    'Site admin provisioning system migration completed',
    JSON_OBJECT(
        'migration_file' VALUE '007_site_admin_provisioning.sql',
        'issue_number' VALUE 10,
        'tables_created' VALUE JSON_ARRAY(
            'pf_recovery_codes',
            'pf_mfa_settings',
            'pf_emergency_access_log',
            'pf_site_admin_provisioning',
            'pf_provisioning_alerts',
            'pf_temporary_admin_sessions'
        ),
        'functions_created' VALUE JSON_ARRAY(
            'check_site_admin_exists',
            'initiate_emergency_recovery',
            'validate_provisioning_attempt'
        )
    )
);

COMMIT;