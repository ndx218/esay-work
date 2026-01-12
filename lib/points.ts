// lib/points.ts
export type StepName = 'outline' | 'draft' | 'feedback' | 'rewrite' | 'final' | 'refs';

export const MODE_COST: Record<StepName, Record<string, number>> = {
  outline: { free: 0, flash: 1 },
  draft:   { free: 0, pro: 2 },
  feedback:{ free: 0, flash: 1 },
  rewrite: { free: 0, pro: 1 },
  final:   { free: 0, undetectable: 2 },
  refs:    { free: 1 },
};

export function getCost(step: StepName, mode: string) {
  const t = MODE_COST[step] || {};
  return t[mode] ?? 0;
}
