const { 
  hasRequiredRole, 
  canCreateRole, 
  canModifyRole,
  ROLE_HIERARCHY 
} = require('../../src/middleware/rbac');

describe('RBAC Middleware', () => {
  describe('hasRequiredRole', () => {
    test('site_admin has access to all roles', () => {
      const userRoles = ['site_admin'];
      expect(hasRequiredRole(userRoles, ['site_admin'])).toBe(true);
      expect(hasRequiredRole(userRoles, ['admin'])).toBe(true);
      expect(hasRequiredRole(userRoles, ['user'])).toBe(true);
    });

    test('admin has access to admin and user roles', () => {
      const userRoles = ['admin'];
      expect(hasRequiredRole(userRoles, ['admin'])).toBe(true);
      expect(hasRequiredRole(userRoles, ['user'])).toBe(true);
      expect(hasRequiredRole(userRoles, ['site_admin'])).toBe(false);
    });

    test('user only has access to user role', () => {
      const userRoles = ['user'];
      expect(hasRequiredRole(userRoles, ['user'])).toBe(true);
      expect(hasRequiredRole(userRoles, ['admin'])).toBe(false);
      expect(hasRequiredRole(userRoles, ['site_admin'])).toBe(false);
    });

    test('handles multiple required roles', () => {
      const userRoles = ['admin'];
      expect(hasRequiredRole(userRoles, ['admin', 'site_admin'])).toBe(true);
      expect(hasRequiredRole(userRoles, ['site_admin', 'superuser'])).toBe(false);
    });

    test('handles empty roles', () => {
      expect(hasRequiredRole([], ['user'])).toBe(false);
      expect(hasRequiredRole(['user'], [])).toBe(false);
    });
  });

  describe('canCreateRole', () => {
    test('site_admin can create any role', () => {
      const userRoles = ['site_admin'];
      expect(canCreateRole(userRoles, 'site_admin')).toBe(true);
      expect(canCreateRole(userRoles, 'admin')).toBe(true);
      expect(canCreateRole(userRoles, 'user')).toBe(true);
    });

    test('admin can only create user role', () => {
      const userRoles = ['admin'];
      expect(canCreateRole(userRoles, 'user')).toBe(true);
      expect(canCreateRole(userRoles, 'admin')).toBe(false);
      expect(canCreateRole(userRoles, 'site_admin')).toBe(false);
    });

    test('user cannot create any role', () => {
      const userRoles = ['user'];
      expect(canCreateRole(userRoles, 'user')).toBe(false);
      expect(canCreateRole(userRoles, 'admin')).toBe(false);
      expect(canCreateRole(userRoles, 'site_admin')).toBe(false);
    });
  });

  describe('canModifyRole', () => {
    test('site_admin can modify any role except demoting site_admin', () => {
      const userRoles = ['site_admin'];
      
      // Can promote
      expect(canModifyRole(userRoles, 'user', 'admin')).toBe(true);
      expect(canModifyRole(userRoles, 'admin', 'site_admin')).toBe(true);
      
      // Can demote (except site_admin)
      expect(canModifyRole(userRoles, 'admin', 'user')).toBe(true);
      
      // Cannot demote site_admin
      expect(canModifyRole(userRoles, 'site_admin', 'admin')).toBe(false);
      expect(canModifyRole(userRoles, 'site_admin', 'user')).toBe(false);
    });

    test('admin can promote user to admin and demote admin to user', () => {
      const userRoles = ['admin'];
      
      // Can promote user to admin (with approval)
      expect(canModifyRole(userRoles, 'user', 'admin')).toBe(true);
      
      // Can demote admin to user
      expect(canModifyRole(userRoles, 'admin', 'user')).toBe(true);
      
      // Cannot promote to site_admin
      expect(canModifyRole(userRoles, 'user', 'site_admin')).toBe(false);
      expect(canModifyRole(userRoles, 'admin', 'site_admin')).toBe(false);
      
      // Cannot modify site_admin
      expect(canModifyRole(userRoles, 'site_admin', 'admin')).toBe(false);
    });

    test('user cannot modify any roles', () => {
      const userRoles = ['user'];
      
      expect(canModifyRole(userRoles, 'user', 'admin')).toBe(false);
      expect(canModifyRole(userRoles, 'admin', 'user')).toBe(false);
      expect(canModifyRole(userRoles, 'admin', 'site_admin')).toBe(false);
    });
  });

  describe('Role Hierarchy', () => {
    test('hierarchy is correctly defined', () => {
      expect(ROLE_HIERARCHY.site_admin).toEqual(['site_admin', 'admin', 'user']);
      expect(ROLE_HIERARCHY.admin).toEqual(['admin', 'user']);
      expect(ROLE_HIERARCHY.user).toEqual(['user']);
    });

    test('inheritance works correctly', () => {
      // Site admin inherits all
      const siteAdminInherited = ROLE_HIERARCHY.site_admin;
      expect(siteAdminInherited).toContain('admin');
      expect(siteAdminInherited).toContain('user');
      
      // Admin inherits user
      const adminInherited = ROLE_HIERARCHY.admin;
      expect(adminInherited).toContain('user');
      expect(adminInherited).not.toContain('site_admin');
      
      // User inherits nothing else
      const userInherited = ROLE_HIERARCHY.user;
      expect(userInherited).toHaveLength(1);
      expect(userInherited).toContain('user');
    });
  });
});