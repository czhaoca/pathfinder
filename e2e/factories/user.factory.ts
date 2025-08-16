import { randomBytes } from 'crypto';
import { User } from '../fixtures/auth.fixture';

interface CreateUserOptions {
  daysAgo?: number;
  withDeletion?: boolean;
}

export class UserFactory {
  private static users: User[] = [];
  private static apiUrl = process.env.API_URL || 'http://localhost:4000';
  
  static async createUser(role: 'user' | 'admin' | 'site_admin' = 'user'): Promise<User> {
    const id = randomBytes(8).toString('hex');
    const user: User = {
      id: `user_${id}`,
      username: `test_${role}_${id}`,
      email: `test_${role}_${id}@example.com`,
      password: `SecurePass@${id}`,
      roles: [{ role_name: role }],
      mfaEnabled: false
    };
    
    // Create user via API
    const response = await fetch(`${this.apiUrl}/api/v2/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ADMIN_TOKEN}`
      },
      body: JSON.stringify({
        username: user.username,
        email: user.email,
        password: user.password,
        roles: [role]
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create user: ${response.statusText}`);
    }
    
    const data = await response.json();
    user.id = data.id;
    
    this.users.push(user);
    return user;
  }
  
  static async createUserWithTempPassword(): Promise<User> {
    const user = await this.createUser('user');
    user.temporaryPassword = `TempPass@${randomBytes(4).toString('hex')}`;
    
    // Force password to be temporary via API
    await fetch(`${this.apiUrl}/api/v2/admin/users/${user.id}/force-password-change`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.ADMIN_TOKEN}`
      }
    });
    
    return user;
  }
  
  static async createUserWithDeletionScheduled(options: CreateUserOptions = {}): Promise<User> {
    const user = await this.createUser('user');
    
    // Schedule deletion via API
    const response = await fetch(`${this.apiUrl}/api/v2/admin/deletion-queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ADMIN_TOKEN}`
      },
      body: JSON.stringify({
        user_id: user.id,
        type: 'user_requested',
        reason: 'Test deletion',
        category: 'testing',
        scheduled_days_offset: options.daysAgo ? -options.daysAgo : 0
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to schedule deletion: ${response.statusText}`);
    }
    
    return user;
  }
  
  static async cleanup(user: User): Promise<void> {
    try {
      // Delete user via API
      await fetch(`${this.apiUrl}/api/v2/admin/users/${user.id}/force-delete`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${process.env.ADMIN_TOKEN}`
        }
      });
    } catch (error) {
      console.error(`Failed to cleanup user ${user.id}:`, error);
    }
    
    // Remove from tracked users
    this.users = this.users.filter(u => u.id !== user.id);
  }
  
  static async cleanupAll(): Promise<void> {
    await Promise.all(this.users.map(user => this.cleanup(user)));
    this.users = [];
  }
  
  static generatePassword(options: {
    length?: number;
    includeSpecial?: boolean;
    includeNumbers?: boolean;
  } = {}): string {
    const length = options.length || 16;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '@$!%*?&';
    
    let charset = chars;
    if (options.includeNumbers !== false) charset += numbers;
    if (options.includeSpecial !== false) charset += special;
    
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    
    return password;
  }
}