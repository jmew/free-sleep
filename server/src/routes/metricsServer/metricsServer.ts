import express, { Request, Response } from 'express';
import metrics from '../../metrics/metrics.js';

const router = express.Router();

router.get('/metrics/server', (_req: Request, res: Response) => {
  res.json(metrics.snapshot());
});

export default router;
