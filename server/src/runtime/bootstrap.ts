import { config } from '../config.js';
import { generateDataset } from '../engine/seed.js';
import { logger } from '../lib/logger.js';
import { eventBus } from '../lib/eventBus.js';
import { repository } from '../store/repository.js';

export function seedIfEmpty(force = false): boolean {
  const empty = repository.isEmpty();
  if (!empty && !force) {
    logger.info('dataset present, skip seeding', { counts: repository.counts() });
    return false;
  }
  return generateAndStore(config.seed);
}

export function generateAndStore(seed = config.seed): boolean {
  const started = Date.now();
  const dataset = generateDataset(seed);
  repository.replaceDataset(dataset, seed);
  const counts = repository.counts();
  logger.info('dataset generated', { seed, ms: Date.now() - started, counts });
  eventBus.publish({
    ts: Date.now(),
    type: 'dataset',
    generatedAt: dataset.generatedAt,
    counts: { ...counts },
  });
  return true;
}
