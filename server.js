import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import https from 'https';
import { ExpressPeerServer } from 'peer';
import { Server } from 'socket.io';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

// ─── Integrated PeerJS Signaling Engine (for WebRTC media streams only) ───
const peerServer = ExpressPeerServer(server, {
  debug: true,
  allow_discovery: true,
  proxied: true
});

app.use('/peerjs', peerServer);

// ─── Socket.IO Room Relay Server (for guaranteed data delivery across networks) ───
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingInterval: 10000,
  pingTimeout: 20000,
  transports: ['websocket', 'polling']
});

// Track active rooms and their members
const rooms = new Map(); // roomId -> Set<socketId>

io.on('connection', (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`);
  let currentRoom = null;

  // Join a room (host creates, partner joins)
  socket.on('join-room', (roomId, nickname) => {
    if (currentRoom) {
      socket.leave(currentRoom);
      const members = rooms.get(currentRoom);
      if (members) {
        members.delete(socket.id);
        if (members.size === 0) rooms.delete(currentRoom);
      }
    }

    currentRoom = roomId;
    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    rooms.get(roomId).add(socket.id);

    const memberCount = rooms.get(roomId).size;
    console.log(`[Socket.IO] ${nickname || socket.id} joined room ${roomId} (${memberCount} members)`);

    // Notify other room members that someone joined
    socket.to(roomId).emit('peer-joined', {
      socketId: socket.id,
      nickname: nickname || '',
      memberCount
    });

    // Confirm join to the sender with member count
    socket.emit('room-joined', {
      roomId,
      memberCount,
      isHost: memberCount === 1
    });
  });

  // Relay data messages to all other members in the room
  socket.on('room-data', (data) => {
    if (currentRoom) {
      socket.to(currentRoom).emit('room-data', data);
    }
  });

  // Check if a room exists and has members (for "is host online?" check)
  socket.on('check-room', (roomId, callback) => {
    const members = rooms.get(roomId);
    const exists = members && members.size > 0;
    if (typeof callback === 'function') {
      callback({ exists, memberCount: members ? members.size : 0 });
    }
  });

  // Handle disconnect
  socket.on('disconnect', (reason) => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id} (${reason})`);
    if (currentRoom) {
      const members = rooms.get(currentRoom);
      if (members) {
        members.delete(socket.id);
        const remaining = members.size;
        if (remaining === 0) {
          rooms.delete(currentRoom);
        } else {
          // Notify remaining room members
          socket.to(currentRoom).emit('peer-left', {
            socketId: socket.id,
            memberCount: remaining
          });
        }
      }
    }
  });
});

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
  console.log(`SK WatchParty Server running on port ${PORT}`);
  console.log(`  PeerJS Signaling: /peerjs`);
  console.log(`  Socket.IO Relay:  active`);

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
