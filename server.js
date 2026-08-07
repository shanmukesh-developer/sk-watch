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

// ─── IMPORTANT: Initialize Socket.IO FIRST (before PeerJS)
// ─── to avoid WebSocket upgrade event conflicts
const io = new Server(server, {
  path: '/relay',                    // Explicit path — avoids PeerJS conflict
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingInterval: 10000,
  pingTimeout: 20000,
  transports: ['polling', 'websocket'],   // Polling first (more reliable on Render)
  allowUpgrades: true
});

// ─── PeerJS Signaling Engine (for WebRTC media streams)
const peerServer = ExpressPeerServer(server, {
  debug: true,
  allow_discovery: true,
  proxied: true
});
app.use('/peerjs', peerServer);

// ─── Socket.IO Room Relay (guaranteed data delivery across ALL networks) ───
// Track active rooms: roomId -> Map<socketId, { peerId, nickname }>
const rooms = new Map();

io.on('connection', (socket) => {
  console.log(`[Relay] Client connected: ${socket.id}`);
  let currentRoom = null;

  socket.on('join-room', ({ roomId, peerId, nickname }) => {
    // Leave previous room
    if (currentRoom) {
      socket.leave(currentRoom);
      const members = rooms.get(currentRoom);
      if (members) {
        members.delete(socket.id);
        if (members.size === 0) rooms.delete(currentRoom);
        else {
          socket.to(currentRoom).emit('peer-left', {
            socketId: socket.id, peerId, memberCount: members.size
          });
        }
      }
    }

    currentRoom = roomId;
    socket.join(roomId);

    if (!rooms.has(roomId)) rooms.set(roomId, new Map());
    rooms.get(roomId).set(socket.id, { peerId: peerId || '', nickname: nickname || '' });

    const memberCount = rooms.get(roomId).size;
    console.log(`[Relay] ${nickname || socket.id} (peer:${peerId}) → room ${roomId} (${memberCount} members)`);

    // List existing members for the joiner
    const existingMembers = [];
    rooms.get(roomId).forEach((info, sid) => {
      if (sid !== socket.id) {
        existingMembers.push({ socketId: sid, peerId: info.peerId, nickname: info.nickname });
      }
    });

    // Tell others in the room
    socket.to(roomId).emit('peer-joined', {
      socketId: socket.id, peerId: peerId || '', nickname: nickname || '', memberCount
    });

    // Confirm to this client
    socket.emit('room-joined', {
      roomId, memberCount, isHost: memberCount === 1, existingMembers
    });
  });

  socket.on('room-data', (data) => {
    if (currentRoom) socket.to(currentRoom).emit('room-data', data);
  });

  socket.on('disconnect', (reason) => {
    console.log(`[Relay] Disconnected: ${socket.id} (${reason})`);
    if (currentRoom) {
      const members = rooms.get(currentRoom);
      if (members) {
        const info = members.get(socket.id);
        members.delete(socket.id);
        if (members.size === 0) rooms.delete(currentRoom);
        else {
          socket.to(currentRoom).emit('peer-left', {
            socketId: socket.id, peerId: info?.peerId || '', memberCount: members.size
          });
        }
      }
    }
  });
});

// Serve built frontend
app.use(express.static(path.join(__dirname, 'dist')));

app.get('/ping', (req, res) => res.status(200).send('pong'));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

server.listen(PORT, () => {
  console.log(`SK WatchParty Server on port ${PORT}`);
  console.log(`  Socket.IO Relay: /relay`);
  console.log(`  PeerJS Signaling: /peerjs`);

  const RENDER_URL = process.env.RENDER_EXTERNAL_URL;
  if (RENDER_URL) {
    console.log(`Auto-ping: ${RENDER_URL}`);
    setInterval(() => {
      const client = RENDER_URL.startsWith('https') ? https : http;
      client.get(`${RENDER_URL}/ping`, (r) => {
        console.log(`[Ping] ${r.statusCode}`);
      }).on('error', (e) => console.error('[Ping Error]', e.message));
    }, 13 * 60 * 1000);
  }
});
