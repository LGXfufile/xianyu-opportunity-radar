import { z } from 'zod';

export const opportunitySchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  audience: z.string(),
  format: z.string(),
  score: z.number().min(0).max(100),
  demand: z.number().min(0).max(100),
  competition: z.number().min(0).max(100),
  profit: z.number().min(0).max(100),
  delivery: z.number().min(0).max(100),
  risk: z.number().min(0).max(100),
  price: z.string(),
  reason: z.array(z.string()).min(1),
  warning: z.string().optional(),
  confidence: z.enum(['高', '中', '低'])
});

export type Opportunity = z.infer<typeof opportunitySchema>;

export type Feedback = { kind: 'success' | 'error' | 'warning' | 'info'; message: string };

export type WatchItem = { id: string; title: string; score: number; savedAt: number };
