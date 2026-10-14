import { Router } from 'express';
import type { Request, Response } from 'express';
import { eventBus, type StreamEvent } from '../lib/eventBus.js';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(': connected\n\n');

  const send = (event: StreamEvent) => {
    res.write(`event: ${event.type}\n`);
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };
  const listener = (event: StreamEvent) => {
    try {
      send(event);
    } catch {
      /* client gone */
    }
  };

  eventBus.on('event', listener);
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 15000);
  if (heartbeat.unref) heartbeat.unref();

  req.on('close', () => {
    clearInterval(heartbeat);
    eventBus.off('event', listener);
    res.end();
  });
});

export default router;
