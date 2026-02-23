import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { apiRouter } from './routes/index.js';
import { handleDynamicWebhook } from './routes/dynamicWebhook.js';
import { errorResponse } from './utils/response.js';

const app = express();

app.use(
  cors({
    origin: env.FRONTEND_ORIGIN,
    credentials: true,
  }),
);

app.post(
  '/webhooks/dynamic',
  express.raw({ type: 'application/json' }),
  handleDynamicWebhook,
);

app.use(express.json());
app.use(apiRouter);
app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const message =
      error instanceof Error ? error.message : 'Internal server error';
    const status =
      typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      typeof (error as { status?: unknown }).status === 'number'
        ? (error as { status: number }).status
        : 500;

    errorResponse(res, message, status);
  },
);

app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`abrium-backend listening on :${env.PORT}`);
});
