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

// ─── Integrated PeerJS Signaling Engine (for WebRTC media streams) ───
const peerServer = ExpressPeerServer(server, {
  debug: true,
  allow_discovery: true,
  proxied: true
});

app.use('/peerjs', peerServer);

// ─── Socket.IO Room Relay Server (guaranteed data delivery across ALL networks) ───
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingInterval: 10000,
  pingTimeout: 20000,
  transports: ['websocket', 'polling']
});

// Track active rooms: roomId -> Map<socketId, { peerId, nickname }>
const rooms = new Map();

io.on('connection', (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`);
  let currentRoom = null;

  // Join a room — both host and joiner use this
  // peerId = PeerJS peer ID (for WebRTC media calls)
  socket.on('join-room', ({ roomId, peerId, nickname }) => {
    // Leave previous room if any
    if (currentRoom) {
      socket.leave(currentRoom);
      const members = rooms.get(currentRoom);
      if (members) {
        members.delete(socket.id);
        if (members.size === 0) rooms.delete(currentRoom);
        else {
          socket.to(currentRoom).emit('peer-left', {
            socketId: socket.id,
            peerId,
            memberCount: members.size
          });
        }
      }
    }

    currentRoom = roomId;
    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Map());
    }
    rooms.get(roomId).set(socket.id, { peerId: peerId || '', nickname: nickname || '' });

    const memberCount = rooms.get(roomId).size;
    console.log(`[Socket.IO] ${nickname || socket.id} (peer:${peerId}) joined room ${roomId} (${memberCount} members)`);

    // Collect all existing members' PeerJS IDs (for the joiner to know who's already in the room)
    const existingMembers = [];
    rooms.get(roomId).forEach((info, sid) => {
      if (sid !== socket.id) {
        existingMembers.push({ socketId: sid, peerId: info.peerId, nickname: info.nickname });
      }
    });

    // Notify OTHER room members that someone joined
    socket.to(roomId).emit('peer-joined', {
      socketId: socket.id,
      peerId: peerId || '',
      nickname: nickname || '',
      memberCount
    });

    // Confirm join to THIS socket — include existing members list
    socket.emit('room-joined', {
      roomId,
      memberCount,
      isHost: memberCount === 1,
      existingMembers
    });
  });

  // Relay data messages to all other members in the room
  socket.on('room-data', (data) => {
    if (currentRoom) {
      socket.to(currentRoom).emit('room-data', data);
    }
  });

  // Handle disconnect
  socket.on('disconnect', (reason) => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id} (${reason})`);
    if (currentRoom) {
      const members = rooms.get(currentRoom);
      if (members) {
        const memberInfo = members.get(socket.id);
        members.delete(socket.id);
        const remaining = members.size;
        if (remaining === 0) {
          rooms.delete(currentRoom);
        } else {
          socket.to(currentRoom).emit('peer-left', {
            socketId: socket.id,
            peerId: memberInfo?.peerId || '',
            memberCount: remaining
          });
        }
      }
    }
  });
});

// Serve Vite build output
app.use(express.static(path.join(__dirname, 'dist')));

// Health check endpoint
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

  // Self-ping every 13 min so Render never sleeps
  const RENDER_URL = process.env.RENDER_EXTERNAL_URL;
  if (RENDER_URL) {
    console.log(`Auto-ping enabled: ${RENDER_URL}`);
    setInterval(() => {
      const client = RENDER_URL.startsWith('https') ? https : http;
      client.get(`${RENDER_URL}/ping`, (res) => {
        console.log(`[Auto-Ping] keep-alive (${res.statusCode})`);
      }).on('error', (err) => {
        console.error('[Auto-Ping] error:', err.message);
      });
    }, 13 * 60 * 1000);
  }
});
