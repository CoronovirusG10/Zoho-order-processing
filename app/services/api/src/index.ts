import { createApp } from './app.js';
import { serviceFactory } from './services/service-factory.js';

const PORT = process.env.PORT || 3000;
const app = createApp();

// Initialize services asynchronously (non-blocking)
async function initializeServices(): Promise<void> {
  try {
    // Initialize Zoho client with Cosmos persistence
    // This is non-blocking - if it fails, ZohoClient falls back to in-memory
    await serviceFactory.initializeZohoClient();
    console.log('[API] Zoho client initialized');
  } catch (error) {
    console.warn('[API] Failed to initialize Zoho client:', error);
    console.warn('[API] Zoho will use in-memory storage (data lost on restart)');
  }
}

const server = app.listen(PORT, () => {
  console.log(`[API] Server listening on port ${PORT}`);
  console.log(`[API] Environment: ${process.env.NODE_ENV || 'development'}`);

  // Initialize services after server starts (non-blocking)
  initializeServices().catch((err) => {
    console.error('[API] Service initialization error:', err);
  });
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
