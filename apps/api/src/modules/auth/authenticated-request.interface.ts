import type { Request } from 'express';

export interface AuthenticatedActor {
  actorType: 'user' | 'agent';
  authUserId: string;
  email: string | null;
  clientId?: string | null;
  agentName?: string | null;
  agentRunId?: string | null;
  delegatedAuthUserId?: string | null;
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
