import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';

export type Role = 'Broker' | 'Client';

const sessions = new Map<string, Role>();

export function createSession(role: Role): string {
  const sessionId = crypto.randomUUID();
  sessions.set(sessionId, role);
  return sessionId;
}

export function destroySession(sessionId: string) {
  sessions.delete(sessionId);
}

export function bearerFrom(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim() || null;
}

export function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/** NFR-03: 401 when not authenticated, 403 when authenticated without the Broker role. */
export function requireBroker(req: Request, res: Response, next: NextFunction) {
  const sessionId = bearerFrom(req);
  const role = sessionId ? sessions.get(sessionId) : undefined;
  if (!role) return res.status(401).json({ error: 'Authentication required' });
  if (role !== 'Broker') return res.status(403).json({ error: "The 'Broker' role is required" });
  next();
}
