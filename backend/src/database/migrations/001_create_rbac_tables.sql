-- =====================================================
-- Migration: 001_create_rbac_tables
-- Description: Create RBAC tables for three-tier role system
-- Date: 2025-08-14
-- =====================================================

-- Check if migration has been applied
DECLARE
    v_count NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_count 
    FROM user_tables 
    WHERE table_name = 'PF_USER_ROLES';
    
    IF v_count > 0 THEN
        DBMS_OUTPUT.PUT_LINE('Migration already applied - skipping');
        RETURN;
    END IF;
END;
/

-- =====================================================
-- User Roles Assignment Table
-- =====================================================
CREATE TABLE pf_user_roles (
    user_id VARCHAR2(36) NOT NULL,
    role_name VARCHAR2(50) NOT NULL,
    granted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    granted_by VARCHAR2(36),
    expires_at TIMESTAMP,
    is_active NUMBER(1) DEFAULT 1,
    notes VARCHAR2(500),
    PRIMARY KEY (user_id, role_name),
    FOREIGN KEY (user_id) REFERENCES pf_users(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES pf_users(id),
    CONSTRAINT chk_role_name CHECK (role_name IN ('site_admin', 'admin', 'user'))
);

-- =====================================================
-- Role Permissions Mapping
-- =====================================================
CREATE TABLE pf_role_permissions (
    role_name VARCHAR2(50) NOT NULL,
    permission_code VARCHAR2(100) NOT NULL,
    resource_type VARCHAR2(50),
    allowed_actions VARCHAR2(500), -- JSON array
    description VARCHAR2(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role_name, permission_code),
    CONSTRAINT chk_perm_role CHECK (role_name IN ('site_admin', 'admin', 'user'))
);

-- =====================================================
-- Role Promotion Approvals Workflow
-- =====================================================
CREATE TABLE pf_role_promotion_approvals (
    id VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
    target_user_id VARCHAR2(36) NOT NULL,
    from_role VARCHAR2(50) NOT NULL,
    to_role VARCHAR2(50) NOT NULL,
    initiated_by VARCHAR2(36) NOT NULL,
    initiated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    required_approvals NUMBER(3) NOT NULL,
    current_approvals NUMBER(3) DEFAULT 0,
    status VARCHAR2(20) DEFAULT 'pending',
    justification VARCHAR2(1000),
    completed_at TIMESTAMP,
    expires_at TIMESTAMP,
    FOREIGN KEY (target_user_id) REFERENCES pf_users(id),
    FOREIGN KEY (initiated_by) REFERENCES pf_users(id),
    CONSTRAINT chk_approval_status CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'cancelled'))
);

-- =====================================================
-- Individual Approval Votes
-- =====================================================
CREATE TABLE pf_approval_votes (
    approval_id VARCHAR2(36) NOT NULL,
    voter_id VARCHAR2(36) NOT NULL,
    vote VARCHAR2(10) NOT NULL,
    voted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    comments VARCHAR2(500),
    PRIMARY KEY (approval_id, voter_id),
    FOREIGN KEY (approval_id) REFERENCES pf_role_promotion_approvals(id) ON DELETE CASCADE,
    FOREIGN KEY (voter_id) REFERENCES pf_users(id),
    CONSTRAINT chk_vote CHECK (vote IN ('approve', 'reject', 'abstain'))
);

-- =====================================================
-- Indexes for Performance
-- =====================================================
CREATE INDEX idx_user_roles_user ON pf_user_roles(user_id);
CREATE INDEX idx_user_roles_active ON pf_user_roles(is_active, role_name);
CREATE INDEX idx_user_roles_expires ON pf_user_roles(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX idx_role_perms_role ON pf_role_permissions(role_name);
CREATE INDEX idx_role_perms_resource ON pf_role_permissions(resource_type);

CREATE INDEX idx_promotion_status ON pf_role_promotion_approvals(status, expires_at);
CREATE INDEX idx_promotion_target ON pf_role_promotion_approvals(target_user_id);
CREATE INDEX idx_promotion_initiator ON pf_role_promotion_approvals(initiated_by);

CREATE INDEX idx_votes_approval ON pf_approval_votes(approval_id);
CREATE INDEX idx_votes_voter ON pf_approval_votes(voter_id);

-- =====================================================
-- Insert Default Permissions
-- =====================================================
-- Site Admin - Full access to everything
INSERT INTO pf_role_permissions (role_name, permission_code, resource_type, allowed_actions, description) VALUES
('site_admin', 'system.all', '*', '["*"]', 'Full system access'),
('site_admin', 'users.all', 'user', '["create","read","update","delete"]', 'Full user management'),
('site_admin', 'roles.all', 'role', '["create","read","update","delete"]', 'Full role management'),
('site_admin', 'config.all', 'configuration', '["create","read","update","delete"]', 'System configuration'),
('site_admin', 'audit.all', 'audit', '["read","export","delete"]', 'Audit log management');

-- Admin - User management without deletion
INSERT INTO pf_role_permissions (role_name, permission_code, resource_type, allowed_actions, description) VALUES
('admin', 'users.manage', 'user', '["create","read","update"]', 'User management without deletion'),
('admin', 'users.roles', 'role', '["read","update"]', 'Role assignment (with approval)'),
('admin', 'users.reset_password', 'user', '["update"]', 'Reset user passwords'),
('admin', 'reports.view', 'report', '["read","export"]', 'View and export reports'),
('admin', 'audit.view', 'audit', '["read"]', 'View audit logs'),
('admin', 'users.bulk', 'user', '["update"]', 'Bulk user operations');

-- User - Personal access only
INSERT INTO pf_role_permissions (role_name, permission_code, resource_type, allowed_actions, description) VALUES
('user', 'profile.own', 'profile', '["read","update"]', 'Own profile management'),
('user', 'experiences.own', 'experience', '["create","read","update","delete"]', 'Own experiences'),
('user', 'skills.own', 'skill', '["create","read","update","delete"]', 'Own skills'),
('user', 'documents.own', 'document', '["create","read","update","delete"]', 'Own documents'),
('user', 'settings.own', 'settings', '["read","update"]', 'Own settings'),
('user', 'chat.own', 'chat', '["create","read"]', 'Own chat history');

-- Admin inherits all user permissions
INSERT INTO pf_role_permissions (role_name, permission_code, resource_type, allowed_actions, description) 
SELECT 'admin', permission_code, resource_type, allowed_actions, description 
FROM pf_role_permissions 
WHERE role_name = 'user';

-- Site Admin inherits all admin permissions (which include user permissions)
INSERT INTO pf_role_permissions (role_name, permission_code, resource_type, allowed_actions, description) 
SELECT 'site_admin', permission_code, resource_type, allowed_actions, description 
FROM pf_role_permissions 
WHERE role_name = 'admin' 
AND permission_code NOT IN (SELECT permission_code FROM pf_role_permissions WHERE role_name = 'site_admin');

-- =====================================================
-- Migrate Existing Users to Default Role
-- =====================================================
-- Assign all existing users to 'user' role by default
INSERT INTO pf_user_roles (user_id, role_name, granted_at, notes)
SELECT id, 'user', CURRENT_TIMESTAMP, 'Initial migration - default role assignment'
FROM pf_users
WHERE id NOT IN (SELECT user_id FROM pf_user_roles);

-- =====================================================
-- Create Triggers
-- =====================================================
-- Auto-assign 'user' role to new users
CREATE OR REPLACE TRIGGER trg_auto_assign_user_role
AFTER INSERT ON pf_users
FOR EACH ROW
BEGIN
    INSERT INTO pf_user_roles (user_id, role_name, granted_at, notes)
    VALUES (:NEW.id, 'user', CURRENT_TIMESTAMP, 'Auto-assigned on user creation');
EXCEPTION
    WHEN DUP_VAL_ON_INDEX THEN
        NULL; -- Role already exists, ignore
END;
/

-- Update approval count when votes are cast
CREATE OR REPLACE TRIGGER trg_update_approval_count
AFTER INSERT ON pf_approval_votes
FOR EACH ROW
WHEN (NEW.vote = 'approve')
BEGIN
    UPDATE pf_role_promotion_approvals
    SET current_approvals = current_approvals + 1
    WHERE id = :NEW.approval_id;
    
    -- Check if approval threshold met
    DECLARE
        v_required NUMBER;
        v_current NUMBER;
        v_target_user VARCHAR2(36);
        v_to_role VARCHAR2(50);
    BEGIN
        SELECT required_approvals, current_approvals + 1, target_user_id, to_role
        INTO v_required, v_current, v_target_user, v_to_role
        FROM pf_role_promotion_approvals
        WHERE id = :NEW.approval_id;
        
        IF v_current >= v_required THEN
            -- Mark as approved
            UPDATE pf_role_promotion_approvals
            SET status = 'approved', completed_at = CURRENT_TIMESTAMP
            WHERE id = :NEW.approval_id;
            
            -- Execute the promotion
            UPDATE pf_user_roles
            SET is_active = 0
            WHERE user_id = v_target_user;
            
            INSERT INTO pf_user_roles (user_id, role_name, granted_by, notes)
            VALUES (v_target_user, v_to_role, :NEW.voter_id, 'Promoted via approval workflow');
        END IF;
    END;
END;
/

-- =====================================================
-- Migration Tracking
-- =====================================================
INSERT INTO pf_migrations (version, name, applied_at)
VALUES ('001', 'create_rbac_tables', CURRENT_TIMESTAMP);

COMMIT;

DBMS_OUTPUT.PUT_LINE('RBAC tables created successfully');