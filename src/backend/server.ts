import crypto from 'crypto';
import { createServer } from 'net';
import { createApp } from './app';
import { initializeDatabase } from './database';

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

async function findAvailablePort(startPort: number): Promise<number> {
  const maxAttempts = 100;
  for (let port = startPort; port < startPort + maxAttempts; port++) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`Could not find available port after ${maxAttempts} attempts starting from port ${startPort}`);
}

async function start() {
  try {
    await initializeDatabase();

    const brokerAccessCode = process.env.BROKER_ACCESS_CODE || crypto.randomBytes(6).toString('hex');
    const { app } = createApp({ brokerAccessCode });

    const preferredPort = Number(process.env.PORT) || 3000;
    const port = await findAvailablePort(preferredPort);

    const server = app.listen(port, '127.0.0.1', () => {
      if (port !== preferredPort) {
        console.log(`Port ${preferredPort} is in use. Charter enquiry server running on http://localhost:${port}`);
      } else {
        console.log(`Charter enquiry server running on http://localhost:${port}`);
      }
      if (!process.env.BROKER_ACCESS_CODE) {
        console.log(`Broker access code (set BROKER_ACCESS_CODE to choose your own): ${brokerAccessCode}`);
      }
    });
    server.on('error', error => {
      console.error('Failed to start server:', error);
      process.exit(1);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
