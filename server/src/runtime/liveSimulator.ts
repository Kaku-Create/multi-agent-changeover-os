import { config } from '../config.js';
import { eventBus } from '../lib/eventBus.js';
import { logger } from '../lib/logger.js';
import { repository } from '../store/repository.js';
import { computeAgentStates } from './state.js';
import type { ChangeoverEvent } from '../domain/types.js';

let timer: NodeJS.Timeout | null = null;
let rotation = 0;

export function startLiveSimulator(): void {
  if (!config.enableLiveSimulator || timer) return;
  timer = setInterval(() => {
    try {
      const equipment = repository.listEquipment();
      const byLine = new Map<string, typeof equipment>();
      for (const e of equipment) {
        const arr = byLine.get(e.line) ?? [];
        arr.push(e);
        byLine.set(e.line, arr);
      }
      const events = repository.listEvents({ limit: 10 });
      const active = events.length ? events[rotation % events.length] : null;
      rotation += 1;

      eventBus.publish({
        ts: Date.now(),
        type: 'tick',
        lines: [...byLine.entries()].map(([line, eqs]) => ({
          line,
          status: active && active.line === line ? 'changeover' : 'running',
          currentProduct: eqs[0]?.currentProduct ?? null,
          oee: Math.round((eqs.reduce((a, e) => a + e.oee, 0) / eqs.length) * 10) / 10,
          activeChangeover: active && active.line === line ? active.id : null,
        })),
      });

      if (rotation % 3 === 0) {
        eventBus.publish({ ts: Date.now(), type: 'agents', agents: computeAgentStates() });
      }
    } catch (err) {
      logger.warn('live tick failed', { message: err instanceof Error ? err.message : String(err) });
    }
  }, config.liveTickMs);
  if (timer.unref) timer.unref();
  logger.info('live simulator started', { intervalMs: config.liveTickMs });
}

export function stopLiveSimulator(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export async function runChangeoverWithProgress(event: ChangeoverEvent): Promise<void> {
  const steps = event.schedule.tasks.length ? event.schedule.tasks : [];
  const total = steps.length || 1;
  const stepDelay = Math.min(600, 3200 / total);

  for (let i = 0; i < steps.length; i++) {
    const task = steps[i];
    eventBus.publish({
      ts: Date.now(),
      type: 'changeover',
      eventId: event.id,
      phase: task.step,
      progress: Math.round(((i + 1) / total) * 100),
      message: `${task.name}（${task.agent}）执行中`,
      scenario: event.scenario,
      fromProduct: event.fromProduct,
      toProduct: event.toProduct,
    });
    await delay(stepDelay);
  }

  if (event.scenario !== 'normal') {
    eventBus.publish({
      ts: Date.now(),
      type: 'alert',
      level: 'warn',
      title: `换产异常处置：${event.scenario}`,
      detail: `已由对应智能体告警并触发动态重排，换产实际耗时 ${event.actualMinutes} 分钟`,
    });
  }

  eventBus.publish({
    ts: Date.now(),
    type: 'changeover',
    eventId: event.id,
    phase: 'resume',
    progress: 100,
    message: `换产完成，用时 ${event.actualMinutes} 分钟，节省 ${event.savedRatio}%`,
    scenario: event.scenario,
    fromProduct: event.fromProduct,
    toProduct: event.toProduct,
  });
  eventBus.publish({ ts: Date.now(), type: 'agents', agents: computeAgentStates() });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    if (t.unref) t.unref();
  });
}
