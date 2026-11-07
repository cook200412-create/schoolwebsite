import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';

describe('API skeleton', () => {
  it('reports degraded health when the database is not connected', async () => {
    const res = await request(createApp()).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body.data.db).toBe('disconnected');
  });
  it('returns the consistent error envelope for unknown routes', async () => {
    const res = await request(createApp()).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
  });
  it('sets security headers and serves API docs', async () => {
    const res = await request(createApp()).get('/api/docs.json');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(Object.keys(res.body.paths).length).toBeGreaterThan(50);
  });
});
