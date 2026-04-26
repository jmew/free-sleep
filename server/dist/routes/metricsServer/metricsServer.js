import express from 'express';
import metrics from '../../metrics/metrics.js';
const router = express.Router();
router.get('/metrics/server', (_req, res) => {
    res.json(metrics.snapshot());
});
export default router;
//# sourceMappingURL=metricsServer.js.map