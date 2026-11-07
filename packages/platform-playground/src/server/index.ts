import express from 'express';
import cors from 'cors';
import * as trpcExpress from '@trpc/server/adapters/express';
import { appRouter } from '@greenlight/platform';

const PORT = process.env.PORT || 3000;

// Express server for additional flexibility
const app = express();

// Do not disclose the framework and its version in the response headers
app.disable('x-powered-by');

// Enable CORS for development
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount tRPC handler on /trpc path
app.use(
  '/trpc',
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext: () => ({}),
  }),
);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 tRPC Server running on http://localhost:${PORT}`);
  console.log(`📡 tRPC endpoint: http://localhost:${PORT}/trpc`);
  console.log(`💚 Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  process.exit(0);
});
