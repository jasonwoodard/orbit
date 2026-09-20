import type { Request, Response } from '@google-cloud/functions-framework';
import { buildIcs } from './ics';
import type { Variant } from './rotation';

function parseVariant(value: unknown): Variant {
  return value === '3D' ? '3D' : '2D';
}

function parseMe(value: unknown): 1 | 2 | undefined {
  if (value === '1') return 1;
  if (value === '2') return 2;
  return undefined;
}

export function orbitIcs(req: Request, res: Response): void {
  const { p1, p2, me, variant } = req.query;

  if (typeof p1 !== 'string' || p1.length === 0 || typeof p2 !== 'string' || p2.length === 0) {
    res
      .status(400)
      .set('Content-Type', 'text/plain; charset=utf-8')
      .send('Missing required parameter(s): p1 and p2 are both required.');
    return;
  }

  const ics = buildIcs({
    p1,
    p2,
    me: parseMe(me),
    variant: parseVariant(variant),
  });

  res.status(200).set('Content-Type', 'text/calendar; charset=utf-8').send(ics);
}
