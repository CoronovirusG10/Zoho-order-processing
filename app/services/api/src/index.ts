import { createApp } from './app.js';

const PORT = process.env.PORT || 3000;
const app = createApp();

const server = app.listen(PORT, () => {
  console.log(`[API] Server listening on port ${PORT}`);
  console.log(`[API] Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[API] SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('[API] Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[API] SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('[API] Server closed');
    process.exit(0);
  });
});
