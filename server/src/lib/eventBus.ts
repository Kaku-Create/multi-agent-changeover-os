import { EventEmitter } from 'node:events';
import type { AgentState } from '../domain/types.js';

export interface LiveTick {
  ts: number;
  type: 'tick';
  lines: {
    line: string;
    status: string;
    currentProduct: string | null;
    oee: number;
    activeChangeover: string | null;
  }[];
}

export interface ChangeoverProgressEvent {
  ts: number;
  type: 'changeover';
  eventId: string;
  phase: string;
  progress: number;
  message: string;
  scenario: string;
  fromProduct: string;
  toProduct: string;
}

export interface AgentUpdateEvent {
  ts: number;
  type: 'agents';
  agents: AgentState[];
}

export interface DatasetEvent {
  ts: number;
  type: 'dataset';
  generatedAt: string;
  counts: Record<string, number>;
}

export interface ImportEvent {
  ts: number;
  type: 'import';
  kind: string;
  imported: number;
  failed: number;
  filename?: string;
}

export interface AlertEvent {
  ts: number;
  type: 'alert';
  level: 'info' | 'warn' | 'error';
  title: string;
  detail: string;
}

export type StreamEvent =
  | LiveTick
  | ChangeoverProgressEvent
  | AgentUpdateEvent
  | DatasetEvent
  | ImportEvent
  | AlertEvent;

class EventBus extends EventEmitter {
  publish(event: StreamEvent) {
    this.emit('event', event);
  }
}

export const eventBus = new EventBus();
eventBus.setMaxListeners(500);
