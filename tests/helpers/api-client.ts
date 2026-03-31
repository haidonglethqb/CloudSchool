import { request, APIRequestContext, APIResponse } from '@playwright/test';
import path from 'path';
import fs from 'fs';

export type Role = 'PLATFORM_ADMIN' | 'SUPER_ADMIN' | 'STAFF' | 'TEACHER' | 'PARENT';

function loadTokens(): Record<string, string> {
  const authFile = path.resolve(__dirname, '..', '.auth-tokens.json');
  if (!fs.existsSync(authFile)) {
    throw new Error('Auth tokens not found. Run global-setup first.');
  }
  return JSON.parse(fs.readFileSync(authFile, 'utf-8'));
}

export function getToken(role: Role): string {
  const tokens = loadTokens();
  const token = tokens[role];
  if (!token) {
    throw new Error(`Token for role "${role}" not found.`);
  }
  return token;
}

export async function createAuthContext(
  role: Role,
  baseURL?: string
): Promise<APIRequestContext> {
  const token = getToken(role);
  const url = baseURL || process.env.API_BASE_URL || 'http://localhost:5001';

  return request.newContext({
    baseURL: url,
    extraHTTPHeaders: {
      'Content-Type': 'application/json',
      Cookie: `token=${token}`,
    },
  });
}

export async function assertStatus(
  response: APIResponse,
  expected: number
): Promise<void> {
  if (response.status() !== expected) {
    const body = await response.text();
    throw new Error(
      `Expected status ${expected}, got ${response.status()}.\nURL: ${response.url()}\nBody: ${body}`
    );
  }
}

export async function measureResponseTime(
  fn: () => Promise<APIResponse>
): Promise<{ response: APIResponse; duration: number }> {
  const start = Date.now();
  const response = await fn();
  const duration = Date.now() - start;
  return { response, duration };
}
