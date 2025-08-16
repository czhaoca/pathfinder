-- Migration: Token-based password system with client-side hashing
-- Issue: #9
-- Description: Implement secure password management with dual hashing and token-based retrieval

-- Drop existing password column from users table if exists
ALTER TABLE pf_users DROP COLUMN IF EXISTS password_hash CASCADE;

-- Create enhanced password storage table
CREATE TABLE IF NOT EXISTS pf_user_passwords (
    user_id VARCHAR2(36) PRIMARY KEY,
    password_hash VARCHAR2(255) NOT NULL, -- Argon2id hash of client hash
    server_salt VARCHAR2(255) NOT NULL,
    client_salt VARCHAR2(255) NOT NULL,
    algorithm VARCHAR2(20) DEFAULT 'argon2id',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expires_at TIMESTAMP, -- For temporary passwords
    must_change NUMBER(1) DEFAULT 0 CHECK (must_change IN (0, 1)),
    last_changed TIMESTAMP,
    change_count NUMBER(5) DEFAULT 0,
    password_version NUMBER(5) DEFAULT 1,
    strength_score NUMBER(3) CHECK (strength_score BETWEEN 0 AND 100),
    is_temporary NUMBER(1) DEFAULT 0 CHECK (is_temporary IN (0, 1)),
    temporary_password VARCHAR2(255), -- Encrypted temporary password for retrieval
    CONSTRAINT fk_pwd_user FOREIGN KEY (user_id) REFERENCES pf_users(id) ON DELETE CASCADE
);

-- Create password history table for reuse prevention
CREATE TABLE IF NOT EXISTS pf_password_history (
    id VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
    user_id VARCHAR2(36) NOT NULL,
    password_hash VARCHAR2(255) NOT NULL,
    used_from TIMESTAMP NOT NULL,
    used_until TIMESTAMP NOT NULL,
    change_reason VARCHAR2(100),
    changed_by VARCHAR2(36),
    client_ip VARCHAR2(45),
    user_agent VARCHAR2(500),
    CONSTRAINT fk_pwd_hist_user FOREIGN KEY (user_id) REFERENCES pf_users(id) ON DELETE CASCADE,
    CONSTRAINT fk_pwd_hist_changed_by FOREIGN KEY (changed_by) REFERENCES pf_users(id)
);

-- Create one-time password tokens table
CREATE TABLE IF NOT EXISTS pf_password_tokens (
    token_hash VARCHAR2(255) PRIMARY KEY, -- SHA256 hash of token
    user_id VARCHAR2(36) NOT NULL,
    token_type VARCHAR2(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_by VARCHAR2(36),
    reason VARCHAR2(500),
    ip_address VARCHAR2(45),
    user_agent VARCHAR2(500),
    metadata CLOB CHECK (metadata IS JSON),
    CONSTRAINT fk_token_user FOREIGN KEY (user_id) REFERENCES pf_users(id) ON DELETE CASCADE,
    CONSTRAINT fk_token_created_by FOREIGN KEY (created_by) REFERENCES pf_users(id),
    CONSTRAINT chk_token_type CHECK (token_type IN ('retrieval', 'reset', 'force_reset', 'activation'))
);

-- Create password policy configuration table
CREATE TABLE IF NOT EXISTS pf_password_policies (
    id VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
    policy_name VARCHAR2(100) UNIQUE NOT NULL,
    min_length NUMBER(3) DEFAULT 8,
    max_length NUMBER(3) DEFAULT 128,
    require_uppercase NUMBER(1) DEFAULT 1 CHECK (require_uppercase IN (0, 1)),
    require_lowercase NUMBER(1) DEFAULT 1 CHECK (require_lowercase IN (0, 1)),
    require_numbers NUMBER(1) DEFAULT 1 CHECK (require_numbers IN (0, 1)),
    require_special NUMBER(1) DEFAULT 1 CHECK (require_special IN (0, 1)),
    min_uppercase NUMBER(3) DEFAULT 1,
    min_lowercase NUMBER(3) DEFAULT 1,
    min_numbers NUMBER(3) DEFAULT 1,
    min_special NUMBER(3) DEFAULT 1,
    password_history_count NUMBER(3) DEFAULT 5,
    password_expiry_days NUMBER(5) DEFAULT 90,
    temp_password_expiry_hours NUMBER(3) DEFAULT 24,
    token_retrieval_expiry_hours NUMBER(3) DEFAULT 1,
    token_reset_expiry_hours NUMBER(3) DEFAULT 3,
    max_login_attempts NUMBER(3) DEFAULT 5,
    lockout_duration_minutes NUMBER(5) DEFAULT 30,
    allow_common_passwords NUMBER(1) DEFAULT 0 CHECK (allow_common_passwords IN (0, 1)),
    enforce_dictionary_check NUMBER(1) DEFAULT 1 CHECK (enforce_dictionary_check IN (0, 1)),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by VARCHAR2(36),
    updated_by VARCHAR2(36),
    CONSTRAINT fk_policy_created_by FOREIGN KEY (created_by) REFERENCES pf_users(id),
    CONSTRAINT fk_policy_updated_by FOREIGN KEY (updated_by) REFERENCES pf_users(id)
);

-- Create password strength analysis table
CREATE TABLE IF NOT EXISTS pf_password_strength_log (
    id VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
    user_id VARCHAR2(36) NOT NULL,
    analysis_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    strength_score NUMBER(3) NOT NULL CHECK (strength_score BETWEEN 0 AND 100),
    length_score NUMBER(3) CHECK (length_score BETWEEN 0 AND 100),
    complexity_score NUMBER(3) CHECK (complexity_score BETWEEN 0 AND 100),
    uniqueness_score NUMBER(3) CHECK (uniqueness_score BETWEEN 0 AND 100),
    dictionary_check_passed NUMBER(1) CHECK (dictionary_check_passed IN (0, 1)),
    common_password_check_passed NUMBER(1) CHECK (common_password_check_passed IN (0, 1)),
    recommendations CLOB,
    CONSTRAINT fk_strength_user FOREIGN KEY (user_id) REFERENCES pf_users(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX idx_pwd_user_expires ON pf_user_passwords(user_id, expires_at);
CREATE INDEX idx_pwd_user_must_change ON pf_user_passwords(user_id, must_change);
CREATE INDEX idx_pwd_hist_user_date ON pf_password_history(user_id, used_from DESC);
CREATE INDEX idx_pwd_tokens_user ON pf_password_tokens(user_id, token_type);
CREATE INDEX idx_pwd_tokens_expires ON pf_password_tokens(expires_at);
CREATE INDEX idx_pwd_tokens_used ON pf_password_tokens(used_at);

-- Insert default password policy
INSERT INTO pf_password_policies (
    policy_name,
    min_length,
    max_length,
    require_uppercase,
    require_lowercase,
    require_numbers,
    require_special,
    min_uppercase,
    min_lowercase,
    min_numbers,
    min_special,
    password_history_count,
    password_expiry_days,
    temp_password_expiry_hours,
    token_retrieval_expiry_hours,
    token_reset_expiry_hours,
    max_login_attempts,
    lockout_duration_minutes
) VALUES (
    'default',
    12,           -- Increased from 8 for better security
    128,
    1,
    1,
    1,
    1,
    2,            -- At least 2 uppercase
    2,            -- At least 2 lowercase
    2,            -- At least 2 numbers
    2,            -- At least 2 special chars
    10,           -- Remember last 10 passwords
    90,
    24,
    1,
    3,
    5,
    30
);

-- Insert high-security policy for admins
INSERT INTO pf_password_policies (
    policy_name,
    min_length,
    max_length,
    require_uppercase,
    require_lowercase,
    require_numbers,
    require_special,
    min_uppercase,
    min_lowercase,
    min_numbers,
    min_special,
    password_history_count,
    password_expiry_days,
    temp_password_expiry_hours,
    token_retrieval_expiry_hours,
    token_reset_expiry_hours,
    max_login_attempts,
    lockout_duration_minutes
) VALUES (
    'admin',
    16,           -- Higher minimum for admins
    128,
    1,
    1,
    1,
    1,
    3,            -- More complexity required
    3,
    3,
    3,
    20,           -- Remember more passwords
    30,           -- More frequent rotation
    12,           -- Shorter temp password validity
    1,
    1,            -- Shorter reset window
    3,            -- Fewer attempts allowed
    60            -- Longer lockout
);

-- Add password policy reference to users
ALTER TABLE pf_users ADD password_policy_id VARCHAR2(36);
ALTER TABLE pf_users ADD CONSTRAINT fk_user_password_policy 
    FOREIGN KEY (password_policy_id) REFERENCES pf_password_policies(id);

-- Update existing users to use default policy
UPDATE pf_users 
SET password_policy_id = (SELECT id FROM pf_password_policies WHERE policy_name = 'default')
WHERE password_policy_id IS NULL;

-- Create stored procedure for password token cleanup
CREATE OR REPLACE PROCEDURE cleanup_expired_tokens AS
BEGIN
    -- Delete expired unused tokens
    DELETE FROM pf_password_tokens 
    WHERE expires_at < CURRENT_TIMESTAMP 
    AND used_at IS NULL;
    
    -- Delete used tokens older than 30 days
    DELETE FROM pf_password_tokens 
    WHERE used_at IS NOT NULL 
    AND used_at < CURRENT_TIMESTAMP - INTERVAL '30' DAY;
    
    COMMIT;
END cleanup_expired_tokens;
/

-- Create stored procedure for password expiry check
CREATE OR REPLACE PROCEDURE check_password_expiry AS
    CURSOR expired_passwords IS
        SELECT up.user_id, u.email, u.username, pp.password_expiry_days
        FROM pf_user_passwords up
        JOIN pf_users u ON up.user_id = u.id
        LEFT JOIN pf_password_policies pp ON u.password_policy_id = pp.id
        WHERE up.expires_at IS NULL  -- Not a temporary password
        AND up.last_changed < CURRENT_TIMESTAMP - INTERVAL '1' DAY * NVL(pp.password_expiry_days, 90)
        AND up.must_change = 0;
BEGIN
    FOR rec IN expired_passwords LOOP
        -- Mark password as must change
        UPDATE pf_user_passwords 
        SET must_change = 1 
        WHERE user_id = rec.user_id;
        
        -- Log the expiry event
        INSERT INTO pf_audit_log (
            event_type,
            event_category,
            event_status,
            user_id,
            event_description,
            metadata
        ) VALUES (
            'password_expired',
            'security',
            'success',
            rec.user_id,
            'Password expired due to age policy',
            JSON_OBJECT(
                'username' VALUE rec.username,
                'expiry_days' VALUE rec.password_expiry_days
            )
        );
    END LOOP;
    
    COMMIT;
END check_password_expiry;
/

-- Create view for password status monitoring
CREATE OR REPLACE VIEW v_password_status AS
SELECT 
    u.id AS user_id,
    u.username,
    u.email,
    up.created_at AS password_created,
    up.last_changed AS password_last_changed,
    up.expires_at AS password_expires_at,
    up.must_change,
    up.is_temporary,
    up.strength_score,
    pp.policy_name AS password_policy,
    CASE 
        WHEN up.expires_at IS NOT NULL AND up.expires_at < CURRENT_TIMESTAMP THEN 'expired'
        WHEN up.must_change = 1 THEN 'must_change'
        WHEN up.is_temporary = 1 THEN 'temporary'
        WHEN up.last_changed < CURRENT_TIMESTAMP - INTERVAL '1' DAY * pp.password_expiry_days THEN 'aging'
        ELSE 'active'
    END AS password_status,
    ROUND(
        CURRENT_TIMESTAMP - up.last_changed
    ) AS days_since_change,
    pp.password_expiry_days - ROUND(
        CURRENT_TIMESTAMP - up.last_changed
    ) AS days_until_expiry
FROM pf_users u
LEFT JOIN pf_user_passwords up ON u.id = up.user_id
LEFT JOIN pf_password_policies pp ON u.password_policy_id = pp.id;

-- Grant necessary permissions
GRANT SELECT ON v_password_status TO pf_app_role;
GRANT EXECUTE ON cleanup_expired_tokens TO pf_app_role;
GRANT EXECUTE ON check_password_expiry TO pf_app_role;

-- Add audit log entries for migration
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
    'Token-based password system migration completed',
    JSON_OBJECT(
        'migration_file' VALUE '006_token_based_password_system.sql',
        'issue_number' VALUE 9,
        'tables_created' VALUE JSON_ARRAY(
            'pf_user_passwords',
            'pf_password_history',
            'pf_password_tokens',
            'pf_password_policies',
            'pf_password_strength_log'
        )
    )
);

COMMIT;