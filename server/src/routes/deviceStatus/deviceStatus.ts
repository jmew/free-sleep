import express, { Request, Response } from 'express';
import { FrankenCommandTimeoutError, getDeviceStatusCoalesced } from '../../8sleep/frankenServer.js';
import { DeviceStatus, DeviceStatusSchema } from './deviceStatusSchema.js';
import logger from '../../logger.js';
import { updateDeviceStatus } from './updateDeviceStatus.js';
import { markManualTempChange } from '../../jobs/scheduleOverride.js';
import { DeepPartial } from 'ts-essentials';

const router = express.Router();

router.get('/deviceStatus', async (req: Request, res: Response) => {
  try {
    const resp = await getDeviceStatusCoalesced();
    res.json(resp);
  } catch (error) {
    if (error instanceof FrankenCommandTimeoutError) {
      logger.warn(`/deviceStatus timed out: ${error.message}`);
      res.status(503).json({
        error: { message: 'Pod did not respond in time, retrying connection' },
      });
      return;
    }
    throw error;
  }
});


router.post('/deviceStatus', async (req: Request, res: Response) => {
  const { body } = req;
  const validationResult = DeviceStatusSchema.deepPartial().safeParse(body);
  if (!validationResult.success) {
    logger.error('Invalid device status update:', validationResult.error);
    res.status(400).json({
      error: 'Invalid request data',
      details: validationResult?.error?.errors,
    });
    return;
  }

  await updateDeviceStatus(body as DeepPartial<DeviceStatus>);

  // If the user manually set a target temperature on a side, maybe pause the
  // remaining schedule (see scheduleOverride.markManualTempChange for rules).
  for (const side of ['left', 'right'] as const) {
    if (body?.[side]?.targetTemperatureF !== undefined) {
      await markManualTempChange(side);
    }
  }

  res.status(204).end();
});


export default router;
