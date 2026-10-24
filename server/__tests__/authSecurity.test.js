import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';

const prisma = {
  user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  passwordResetToken: { deleteMany: jest.fn(), create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  $transaction: jest.fn(),
};
jest.unstable_mockModule('../db/client.js', () => ({ default: prisma }));
// Deliberately import before assigning JWT_SECRET (ESM/dotenv regression).
const { requireJwtSecret } = await import('../config/auth.js');
const { authMiddleware, authRequired } = await import('../middleware/authMiddleware.js');
const { adminOnly } = await import('../middleware/adminOnly.js');
const { default: authRouter } = await import('../routes/auth.js');
const { default: adminRouter } = await import('../routes/adminAuth.js');
const originalSecret = process.env.JWT_SECRET;
const originalReset = process.env.ADMIN_RESET_SECRET;
const secret = 'isolated-auth-security-test-key';
const user = {
  id: 'security-test-user', email: 'security@example.invalid', name: 'Test',
  username: 'test', password: bcrypt.hashSync('test-password', 4),
  isAdmin: true, plan: 'FREE', track: 'BEGINNER', current_unit: 1,
};
function app() {
  const a = express();
  a.use(express.json(), cookieParser(), authMiddleware);
  a.use('/api/auth', authRouter);
  a.use('/api/admin/auth', adminRouter);
  a.get('/protected', authRequired, (req, res) => res.json({ ok: true, id: req.user.id }));
  a.get('/admin-protected', adminOnly, (req, res) => res.json({ ok: true }));
  return a;
}
function logs() {
  return ['log', 'warn', 'error'].map(k => JSON.stringify(console[k].mock.calls)).join('\n');
}
beforeEach(() => {
  jest.clearAllMocks();
  process.env.JWT_SECRET = secret;
  process.env.ADMIN_RESET_SECRET = 'isolated-reset-test-key';
  for (const k of ['log', 'warn', 'error']) jest.spyOn(console, k).mockImplementation(() => {});
  prisma.user.findUnique.mockResolvedValue(user);
  prisma.user.create.mockResolvedValue(user);
  prisma.user.update.mockResolvedValue(user);
  prisma.passwordResetToken.deleteMany.mockResolvedValue({ count: 0 });
  prisma.passwordResetToken.create.mockResolvedValue({});
  prisma.passwordResetToken.update.mockResolvedValue({});
  prisma.$transaction.mockResolvedValue([]);
});
afterEach(() => {
  jest.restoreAllMocks();
  if (originalSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalSecret;
  if (originalReset === undefined) delete process.env.ADMIN_RESET_SECRET;
  else process.env.ADMIN_RESET_SECRET = originalReset;
});

describe('authentication hardening', () => {
  test.each([undefined, '', '   '])('missing/blank secret fails signing and verification: %p', async value => {
    if (value === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = value;
    expect(() => requireJwtSecret()).toThrow('JWT_SECRET must be configured');
    for (const endpoint of ['/api/auth/login', '/api/admin/auth/login']) {
      const res = await request(app()).post(endpoint).send({ email: user.email, password: 'test-password' });
      expect(res.status).toBe(500);
      expect(res.body.ok).toBe(false);
      expect(res.body.token).toBeUndefined();
    }
    const token = jwt.sign({ id: user.id }, secret);
    expect((await request(app()).get('/protected').set('Authorization', `Bearer ${token}`)).status).toBe(401);
  });
  test('student login retains response, cookie, seven-day token and both verification paths', async () => {
    const res = await request(app()).post('/api/auth/login').send({ email: user.email, password: 'test-password' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, email: user.email, plan: 'FREE', user: { id: user.id }, track: 'BEGINNER' });
    const decoded = jwt.verify(res.body.token, secret);
    expect(decoded.exp - decoded.iat).toBe(7 * 86400);
    expect(res.headers['set-cookie'][0]).toContain('fj_token=');
    expect((await request(app()).get('/protected').set('Authorization', `Bearer ${res.body.token}`)).status).toBe(200);
    expect((await request(app()).get('/protected').set('Cookie', `fj_token=${res.body.token}`)).status).toBe(200);
    expect((await request(app()).get('/api/auth/me').set('Authorization', `Bearer ${res.body.token}`)).body.ok).toBe(true);
    expect(logs()).not.toContain(user.email);
  });
  test('signup retains 201, response and seven-day token', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    const res = await request(app()).post('/api/auth/signup').send({ name: 'Test', email: user.email, password: 'test-password' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ ok: true, user: { id: user.id } });
    const decoded = jwt.verify(res.body.token, secret);
    expect(decoded.exp - decoded.iat).toBe(7 * 86400);
  });
  test('admin login retains contract and thirty-day token accepted by adminOnly', async () => {
    const res = await request(app()).post('/api/admin/auth/login').send({ email: user.email, password: 'test-password' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, admin: { id: user.id, email: user.email } });
    const decoded = jwt.verify(res.body.token, secret);
    expect(decoded).toMatchObject({ isAdmin: true, role: 'admin' });
    expect(decoded.exp - decoded.iat).toBe(30 * 86400);
    expect((await request(app()).get('/admin-protected').set('Authorization', `Bearer ${res.body.token}`)).status).toBe(200);
    expect((await request(app()).get('/protected').set('Authorization', `Bearer ${res.body.token}`)).status).toBe(200);
  });
  test('rejects malformed, wrong-key, expired and legacy fallback tokens', async () => {
    const payload = { id: user.id, role: 'admin', isAdmin: true };
    const tokens = ['bad.token', jwt.sign(payload, 'wrong-key'), jwt.sign(payload, secret, { expiresIn: -1 }),
      jwt.sign(payload, 'dev-secret'), jwt.sign(payload, 'fluencyjet_secret_2025')];
    for (const token of tokens) {
      expect((await request(app()).get('/protected').set('Authorization', `Bearer ${token}`)).status).toBe(401);
      expect((await request(app()).get('/admin-protected').set('Authorization', `Bearer ${token}`)).status).toBe(401);
    }
    expect((await request(app()).get('/protected')).body).toEqual({ ok: false, message: 'Unauthorized' });
    const student = jwt.sign({ id: user.id }, secret);
    expect((await request(app()).get('/admin-protected').set('Authorization', `Bearer ${student}`)).status).toBe(403);
  });
  test('reads configured bytes at call time and invalidates old key after rotation', async () => {
    process.env.JWT_SECRET = '  explicit-test-key  ';
    expect(requireJwtSecret()).toBe('  explicit-test-key  ');
    const old = jwt.sign({ id: user.id }, secret);
    expect((await request(app()).get('/protected').set('Authorization', `Bearer ${old}`)).status).toBe(401);
    const current = jwt.sign({ id: user.id }, requireJwtSecret());
    expect((await request(app()).get('/protected').set('Authorization', `Bearer ${current}`)).status).toBe(200);
  });
  test('forgot password retains neutral response and hashed 30-minute reset without disclosure', async () => {
    const raw = Buffer.alloc(32, 7);
    jest.spyOn(crypto, 'randomBytes').mockReturnValue(raw);
    const start = Date.now();
    const res = await request(app()).post('/api/auth/forgot-password').send({ email: user.email });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, message: 'If an account exists for that email, reset instructions have been sent.' });
    const data = prisma.passwordResetToken.create.mock.calls[0][0].data;
    expect(data.tokenHash).toBe(crypto.createHash('sha256').update(raw.toString('hex')).digest('hex'));
    expect(data.expiresAt.getTime() - start).toBeGreaterThanOrEqual(30 * 60000);
    expect(data.expiresAt.getTime() - start).toBeLessThan(30 * 60000 + 3000);
    expect(logs()).not.toContain(raw.toString('hex'));
    expect(logs()).not.toContain('reset-password?token=');
    expect(logs()).not.toContain(user.email);
    prisma.user.findUnique.mockResolvedValueOnce(null);
    expect((await request(app()).post('/api/auth/forgot-password').send({ email: 'absent@example.invalid' })).body).toEqual(res.body);
  });
  test('reset/admin-link API contracts remain, and errors cannot leak reset URLs or PII', async () => {
    const raw = 'test-only-reset-token';
    prisma.passwordResetToken.findUnique.mockResolvedValue({ id: 'r', userId: user.id, expiresAt: new Date(Date.now() + 60000), usedAt: null });
    const res = await request(app()).post('/api/auth/reset-password').send({ token: raw, password: 'new-password' });
    expect(res.body).toEqual({ ok: true, message: 'Password updated successfully. Please log in.' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect((await request(app()).post('/api/auth/admin/generate-reset-link').send({ email: user.email })).status).toBe(403);
    const link = await request(app()).post('/api/auth/admin/generate-reset-link').send({ email: user.email, adminSecret: process.env.ADMIN_RESET_SECRET });
    expect(link.status).toBe(200);
    expect(link.body).toMatchObject({ ok: true, email: user.email, resetUrl: expect.stringContaining('/reset-password?token='), expiresAt: expect.any(String) });
    expect(logs()).not.toContain(link.body.resetUrl);
    prisma.user.findUnique.mockRejectedValue(new Error(`${user.email} /reset-password?token=${raw}`));
    for (const endpoint of ['/api/auth/forgot-password', '/api/auth/admin/generate-reset-link', '/api/auth/login', '/api/admin/auth/login']) {
      expect((await request(app()).post(endpoint).send({ email: user.email, password: 'test-password', adminSecret: process.env.ADMIN_RESET_SECRET })).status).toBe(500);
    }
    expect(logs()).not.toContain(raw);
    expect(logs()).not.toContain(user.email);
    expect(logs()).not.toContain('reset-password?token=');
  });
  test('missing fields, bad credentials and invalid resets retain status contracts', async () => {
    expect((await request(app()).post('/api/auth/login').send({})).status).toBe(400);
    expect((await request(app()).post('/api/admin/auth/login').send({})).status).toBe(400);
    expect((await request(app()).post('/api/auth/login').send({ email: user.email, password: 'wrong' })).status).toBe(401);
    expect((await request(app()).post('/api/auth/reset-password').send({})).status).toBe(400);
    prisma.passwordResetToken.findUnique.mockResolvedValue(null);
    expect((await request(app()).post('/api/auth/reset-password').send({ token: 'invalid', password: 'new-password' })).body.message).toBe('Reset link is invalid or expired');
  });
  test('target production modules contain no fallback JWT key or sensitive debug log', () => {
    for (const f of ['../routes/adminAuth.js', '../middleware/authMiddleware.js', '../routes/auth.js']) {
      const source = readFileSync(new URL(f, import.meta.url), 'utf8');
      expect(source).not.toMatch(/dev-secret|fluencyjet_secret_2025|AUTH-DEBUG|AUTH AVATAR DEBUG/);
      expect(source).not.toMatch(/console\.(log|warn|error)\([^;]*(?:rawToken|resetUrl|user\.email)/s);
    }
    const entry = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
    expect(entry).not.toContain('[ADMIN-DEBUG]');
    expect(entry.indexOf('requireJwtSecret();')).toBeGreaterThan(entry.indexOf('dotenv.config('));
    expect(entry.indexOf('requireJwtSecret();')).toBeLessThan(entry.indexOf('const app = express()'));
  });
  test('isolated ESM import before dotenv loading supports explicit local secret and rejects missing production secret', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'fj-auth-test-'));
    const helper = new URL('../config/auth.js', import.meta.url).href;
    const dotenv = new URL('../node_modules/dotenv/lib/main.js', import.meta.url).href;
    try {
      writeFileSync(path.join(dir, '.env'), 'JWT_SECRET=dotenv-test-only-key\n');
      const env = { ...process.env, NODE_ENV: 'production' };
      delete env.JWT_SECRET;
      const code = `import { requireJwtSecret } from ${JSON.stringify(helper)}; import dotenv from ${JSON.stringify(dotenv)}; dotenv.config({path: ${JSON.stringify(path.join(dir, '.env'))}}); if (requireJwtSecret() !== 'dotenv-test-only-key') process.exit(2);`;
      expect(spawnSync(process.execPath, ['--input-type=module', '-e', code], { env }).status).toBe(0);
      expect(spawnSync(process.execPath, ['--input-type=module', '-e', `import { requireJwtSecret } from ${JSON.stringify(helper)}; requireJwtSecret();`], { env }).status).toBe(1);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
