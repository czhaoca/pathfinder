import { Page } from '@playwright/test';
import * as crypto from 'crypto';
import * as speakeasy from 'speakeasy';

export class AuthHelper {
  constructor(private page: Page) {}
  
  async login(username: string, password: string): Promise<void> {
    await this.page.goto('/login');
    
    // Client-side password hashing simulation
    const passwordHash = this.hashPassword(password);
    
    await this.page.fill('[data-testid="username"]', username);
    await this.page.fill('[data-testid="password"]', password);
    
    // Intercept and modify the request to include hash
    await this.page.route('**/api/v2/auth/login', async (route) => {
      const postData = JSON.parse(route.request().postData() || '{}');
      await route.continue({
        postData: JSON.stringify({
          ...postData,
          password_hash: passwordHash,
          client_salt: crypto.randomBytes(16).toString('hex')
        })
      });
    });
    
    await this.page.click('[data-testid="login-button"]');
    await this.page.waitForURL('/dashboard', { timeout: 10000 });
  }
  
  async loginAs(user: any, targetPage?: Page): Promise<void> {
    const page = targetPage || this.page;
    await page.goto('/login');
    await page.fill('[data-testid="username"]', user.username);
    await page.fill('[data-testid="password"]', user.password);
    await page.click('[data-testid="login-button"]');
    
    if (user.mfaEnabled) {
      await this.handleMFA(user.mfaSecret, page);
    }
    
    await page.waitForURL('/dashboard', { timeout: 10000 });
  }
  
  async logout(): Promise<void> {
    await this.page.click('[data-testid="user-menu"]');
    await this.page.click('[data-testid="logout-button"]');
    await this.page.waitForURL('/login');
  }
  
  async enableMFA(user: any): Promise<void> {
    await this.loginAs(user);
    await this.page.goto('/settings/security');
    await this.page.click('[data-testid="enable-mfa"]');
    
    // Get QR code or secret
    const secret = await this.page.getAttribute('[data-testid="mfa-secret"]', 'data-secret');
    user.mfaSecret = secret;
    user.mfaEnabled = true;
    
    // Verify with TOTP
    const token = this.generateTOTP(secret!);
    await this.page.fill('[data-testid="mfa-verify"]', token);
    await this.page.click('[data-testid="confirm-mfa"]');
    
    await this.page.waitForSelector('text=MFA enabled successfully');
  }
  
  async handleMFA(secret: string, page?: Page): Promise<void> {
    const p = page || this.page;
    await p.waitForSelector('[data-testid="mfa-input"]');
    const token = this.generateTOTP(secret);
    await p.fill('[data-testid="mfa-token"]', token);
    await p.click('[data-testid="verify-mfa"]');
  }
  
  generateTOTP(secret: string): string {
    return speakeasy.totp({
      secret: secret,
      encoding: 'base32'
    });
  }
  
  private hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
  }
  
  async getStoredToken(): Promise<string | null> {
    return await this.page.evaluate(() => {
      return sessionStorage.getItem('access_token') || localStorage.getItem('access_token');
    });
  }
  
  async setToken(token: string): Promise<void> {
    await this.page.evaluate((t) => {
      sessionStorage.setItem('access_token', t);
    }, token);
  }
  
  async clearSession(): Promise<void> {
    await this.page.evaluate(() => {
      sessionStorage.clear();
      localStorage.clear();
    });
  }
}