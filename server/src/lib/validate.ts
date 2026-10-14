import { z } from 'zod';
import { badRequest } from './errors.js';

export function parse<T extends z.ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw badRequest('参数校验失败', result.error.flatten());
  }
  return result.data;
}

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type Pagination = z.infer<typeof paginationSchema>;

export const importKindSchema = z.enum([
  'products',
  'materials',
  'equipment',
  'operators',
  'workorders',
]);

export const importBodySchema = z.object({
  format: z.enum(['csv', 'json']).optional(),
  filename: z.string().max(255).optional(),
  mode: z.enum(['merge', 'replace', 'append']).default('merge'),
  content: z.string().min(1, 'content 不能为空'),
});

export const simulateSchema = z.object({
  from: z.string().max(64).optional(),
  to: z.string().max(64).optional(),
  scenario: z
    .enum(['normal', 'agv_delay', 'material_shortage', 'equipment_alarm', 'quality_fail', 'staff_absence'])
    .optional(),
  seed: z.coerce.number().int().positive().optional(),
});

export const regenerateSchema = z.object({
  seed: z.coerce.number().int().positive().optional(),
});
