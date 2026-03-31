import { request, FullConfig } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '.env.test') });

interface UserCredentials {
  email: string;
  password: string;
  tenantCode?: string;
}

const USERS: Record<string, UserCredentials> = {
  PLATFORM_ADMIN: {
    email: process.env.PLATFORM_ADMIN_EMAIL || 'admin@cloudschool.vn',
    password: process.env.PLATFORM_ADMIN_PASSWORD || 'admin123',
  },
  SUPER_ADMIN: {
    email: process.env.SUPER_ADMIN_EMAIL || 'admin@demo.school.vn',
    password: process.env.SUPER_ADMIN_PASSWORD || 'admin123',
    tenantCode: process.env.TENANT_CODE || 'THPT-DEMO',
  },
  STAFF: {
    email: process.env.STAFF_EMAIL || 'staff@demo.school.vn',
    password: process.env.STAFF_PASSWORD || 'staff123',
    tenantCode: process.env.TENANT_CODE || 'THPT-DEMO',
  },
  TEACHER: {
    email: process.env.TEACHER_EMAIL || 'teacher@demo.school.vn',
    password: process.env.TEACHER_PASSWORD || 'teacher123',
    tenantCode: process.env.TENANT_CODE || 'THPT-DEMO',
  },
  PARENT: {
    email: process.env.PARENT_EMAIL || 'parent1@demo.school.vn',
    password: process.env.PARENT_PASSWORD || 'parent123',
    tenantCode: process.env.TENANT_CODE || 'THPT-DEMO',
  },
};

async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL || process.env.API_BASE_URL || 'http://localhost:5001';
  const tokens: Record<string, string> = {};

  const apiContext = await request.newContext({ baseURL });

  for (const [role, creds] of Object.entries(USERS)) {
    try {
      const response = await apiContext.post('/api/auth/login', {
        data: {
          email: creds.email,
          password: creds.password,
          ...(creds.tenantCode ? { tenantCode: creds.tenantCode } : {}),
        },
      });

      if (response.ok()) {
        const cookies = response.headers()['set-cookie'];
        if (cookies) {
          const tokenMatch = cookies.match(/token=([^;]+)/);
          if (tokenMatch) {
            tokens[role] = tokenMatch[1];
          }
        }
        console.log(`✅ ${role} login successful`);
      } else {
        const body = await response.text();
        console.warn(`⚠️ ${role} login failed (${response.status()}): ${body}`);
      }
    } catch (error) {
      console.warn(`⚠️ ${role} login error: ${error}`);
    }
  }

  await apiContext.dispose();

  const authFile = path.resolve(__dirname, '.auth-tokens.json');
  fs.writeFileSync(authFile, JSON.stringify(tokens, null, 2));
  console.log(`\n🔐 Auth tokens saved to ${authFile}`);
}

export default globalSetup;
