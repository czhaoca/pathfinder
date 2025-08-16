import { test as base } from '@playwright/test';
import { AuthHelper } from '../helpers/auth.helper';
import { UserFactory } from '../factories/user.factory';

export interface User {
  id: string;
  username: string;
  email: string;
  password: string;
  temporaryPassword?: string;
  roles: Array<{ role_name: string }>;
  mfaEnabled?: boolean;
  mfaSecret?: string;
}

type AuthFixtures = {
  authHelper: AuthHelper;
  regularUser: User;
  adminUser: User;
  siteAdminUser: User;
};

export const test = base.extend<AuthFixtures>({
  authHelper: async ({ page }, use) => {
    const helper = new AuthHelper(page);
    await use(helper);
  },
  
  regularUser: async ({ page }, use) => {
    const user = await UserFactory.createUser('user');
    await use(user);
    await UserFactory.cleanup(user);
  },
  
  adminUser: async ({ page }, use) => {
    const user = await UserFactory.createUser('admin');
    await use(user);
    await UserFactory.cleanup(user);
  },
  
  siteAdminUser: async ({ page }, use) => {
    const user = await UserFactory.createUser('site_admin');
    await use(user);
    await UserFactory.cleanup(user);
  },
});

export { expect } from '@playwright/test';