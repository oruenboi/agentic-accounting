import type { Request } from 'express';

export interface AuthenticatedActor {
  authUserId: string;
  email: string | null;
}

export interface RequestActorContext {
  appUserId: string;
  authUserId: string;
  organizationRole: string | null;
  firmRole: string | null;
  firmId: string;
}

export interface AuthenticatedRequest extends Request {
  actor?: AuthenticatedActor;
  requestId?: string;
}

