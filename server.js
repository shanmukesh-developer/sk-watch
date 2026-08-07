import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import https from 'https';
import { ExpressPeerServer } from 'peer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

// Integrated PeerJS Signaling Engine on /peerjs endpoint
const peerServer = ExpressPeerServer(server, {
  debug: true,
  path: '/'
});

app.use('/peerjs', peerServer);

// Serve Vite build output
app.use(express.static(path.join(__dirname, 'dist')));

// Health check endpoint for keep-alive ping
app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

server.listen(PORT, () => {
  console.log(`SK WatchParty & PeerJS Signaling Server running on port ${PORT}`);

  // Self-ping loop every 13 minutes so Render never sleeps
  const RENDER_URL = process.env.RENDER_EXTERNAL_URL;
  if (RENDER_URL) {
    console.log(`Auto-ping enabled for Render URL: ${RENDER_URL}`);
    setInterval(() => {
      const client = RENDER_URL.startsWith('https') ? https : http;
      client.get(`${RENDER_URL}/ping`, (res) => {
        console.log(`[Auto-Ping] Render keep-alive success (${res.statusCode})`);
      }).on('error', (err) => {
        console.error('[Auto-Ping] Keep-alive error:', err.message);
      });
    }, 13 * 60 * 1000); // 13 minutes (Render sleeps after 15m)
  }
});
