import React from 'react';
import type { AgentState, ChangeoverProgress, LineStatus, RealtimeAlert } from './types';
import { api } from './api';

export interface RealtimeState {
  connected: boolean;
  lines: LineStatus[];
  progress: ChangeoverProgress | null;
  agents: AgentState[];
  alerts: RealtimeAlert[];
  lastEventAt: number | null;
}

const initial: RealtimeState = {
  connected: false,
  lines: [],
  progress: null,
  agents: [],
  alerts: [],
  lastEventAt: null,
};

const RealtimeContext = React.createContext<RealtimeState>(initial);

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<RealtimeState>(initial);

  React.useEffect(() => {
    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      source = new EventSource(api.streamUrl());
      source.onopen = () => setState((s) => ({ ...s, connected: true }));
      source.onerror = () => {
        setState((s) => ({ ...s, connected: false }));
        source?.close();
        retry = setTimeout(connect, 5000);
      };
      source.addEventListener('tick', (e) => {
        const data = JSON.parse((e as MessageEvent).data) as { ts: number; lines: LineStatus[] };
        setState((s) => ({ ...s, lines: data.lines, lastEventAt: data.ts }));
      });
      source.addEventListener('agents', (e) => {
        const data = JSON.parse((e as MessageEvent).data) as { ts: number; agents: AgentState[] };
        setState((s) => ({ ...s, agents: data.agents, lastEventAt: data.ts }));
      });
      source.addEventListener('changeover', (e) => {
        const data = JSON.parse((e as MessageEvent).data) as ChangeoverProgress & { ts: number };
        setState((s) => ({ ...s, progress: data, lastEventAt: data.ts }));
      });
      source.addEventListener('alert', (e) => {
        const data = JSON.parse((e as MessageEvent).data) as RealtimeAlert;
        setState((s) => ({ ...s, alerts: [data, ...s.alerts].slice(0, 20), lastEventAt: data.ts }));
      });
    };

    connect();
    return () => {
      if (retry) clearTimeout(retry);
      source?.close();
    };
  }, []);

  return <RealtimeContext.Provider value={state}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(): RealtimeState {
  return React.useContext(RealtimeContext);
}
