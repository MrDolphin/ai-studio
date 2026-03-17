/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import express from 'express';
import { createServer as createViteServer } from 'vite';
import { Server } from 'socket.io';
import { createServer } from 'http';
import { v4 as uuidv4 } from 'uuid';
import {
  GameState,
  Player,
  Orb,
  OrbType,
  WORLD_SIZE,
  BASE_SPEED,
  BOOST_SPEED,
  TICK_RATE,
  MAX_ORBS,
  INITIAL_LENGTH,
  SEGMENT_SPACING,
  TURN_SPEED,
} from './src/shared/types.ts';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  },
});

const PORT = 3000;

const COLORS = [
  '#ff7eb3', // vibrant pink
  '#ffb86c', // vibrant orange
  '#f1fa8c', // vibrant yellow
  '#50fa7b', // vibrant green
  '#8be9fd', // vibrant blue
  '#bd93f9', // vibrant purple
];

const state: GameState = {
  players: {},
  orbs: {},
  leaderboard: [],
};

function spawnOrb(x?: number, y?: number, value?: number, color?: string, force = false, type?: OrbType) {
  if (!force && Object.keys(state.orbs).length >= MAX_ORBS) return;
  const id = uuidv4();
  
  let orbType: OrbType = type ?? 'standard';
  if (!type && !value) {
    orbType = Math.random() < 0.1 ? 'super' : Math.random() < 0.05 ? 'bonus' : 'standard';
  }

  let orbValue = value ?? 1;
  let orbColor = color ?? COLORS[Math.floor(Math.random() * COLORS.length)];

  if (orbType === 'super' && !value) {
    orbValue = 5;
    orbColor = '#ffffff';
  } else if (orbType === 'bonus' && !value) {
    orbValue = 10;
    orbColor = '#ff00ff';
  }

  state.orbs[id] = {
    id,
    x: x ?? (Math.random() - 0.5) * WORLD_SIZE,
    y: y ?? (Math.random() - 0.5) * WORLD_SIZE,
    value: orbValue,
    color: orbColor,
    type: orbType,
  };
}

// Initial orbs
for (let i = 0; i < 150; i++) {
  spawnOrb();
}

let snakeCounter = 1;

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  socket.on('join', () => {
    const name = `Snake-${snakeCounter++}`;
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const startX = (Math.random() - 0.5) * (WORLD_SIZE - 20);
    const startY = (Math.random() - 0.5) * (WORLD_SIZE - 20);
    const angle = Math.random() * Math.PI * 2;

    const segments = [];
    for (let i = 0; i < INITIAL_LENGTH; i++) {
      segments.push({
        x: startX - Math.cos(angle) * i * SEGMENT_SPACING,
        y: startY - Math.sin(angle) * i * SEGMENT_SPACING,
      });
    }

    state.players[socket.id] = {
      id: socket.id,
      name,
      color,
      segments,
      score: INITIAL_LENGTH,
      isBoosting: false,
      state: 'alive',
      currentAngle: angle,
      inputs: { left: false, right: false, boost: false },
    };

    socket.emit('init', socket.id);
  });

  socket.on('update_state', (data: { segments: any[], score: number, currentAngle: number, isBoosting: boolean, state: string }) => {
    const player = state.players[socket.id];
    if (player && player.state === 'alive') {
      player.segments = data.segments;
      player.score = data.score;
      player.currentAngle = data.currentAngle;
      player.isBoosting = data.isBoosting;
      
      if (data.state === 'dead') {
        player.state = 'dead';
        // Drop orbs
        player.segments.forEach((seg, i) => {
          if (i % 2 === 0) spawnOrb(seg.x, seg.y, 1, player.color, true);
        });
      }
    }
  });

  socket.on('collect_orb', (orbId: string) => {
    if (state.orbs[orbId]) {
      delete state.orbs[orbId];
    }
  });

  socket.on('cut_tail', (data: { targetId: string, segmentIndex: number }) => {
    const target = state.players[data.targetId];
    if (target && target.state === 'alive') {
      // Drop segments as orbs
      const droppedSegments = target.segments.slice(data.segmentIndex);
      droppedSegments.forEach((seg, i) => {
        if (i % 2 === 0) spawnOrb(seg.x, seg.y, 1, target.color, true);
      });
      
      // Truncate target snake
      target.segments = target.segments.slice(0, data.segmentIndex);
      target.score = Math.max(10, target.segments.length);
      
      if (target.segments.length < 2) {
        target.state = 'dead';
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    const player = state.players[socket.id];
    if (player && player.state === 'alive') {
      // Drop orbs
      player.segments.forEach((seg, i) => {
        if (i % 2 === 0) spawnOrb(seg.x, seg.y, 1, player.color, true);
      });
    }
    delete state.players[socket.id];
  });
});

// NPC Spawning
function spawnNPC() {
  const id = `npc-${uuidv4()}`;
  const name = `Bot-${Math.floor(Math.random() * 1000)}`;
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  const startX = (Math.random() - 0.5) * (WORLD_SIZE - 20);
  const startY = (Math.random() - 0.5) * (WORLD_SIZE - 20);
  const angle = Math.random() * Math.PI * 2;

  const segments = [];
  for (let i = 0; i < INITIAL_LENGTH; i++) {
    segments.push({
      x: startX - Math.cos(angle) * i * SEGMENT_SPACING,
      y: startY - Math.sin(angle) * i * SEGMENT_SPACING,
    });
  }

  state.players[id] = {
    id,
    name,
    color,
    segments,
    score: INITIAL_LENGTH,
    isBoosting: false,
    state: 'alive',
    currentAngle: angle,
    inputs: { left: false, right: false, boost: false },
    isNPC: true,
  };
}

// Initial NPCs
for (let i = 0; i < 5; i++) {
  spawnNPC();
}

// Game Loop
setInterval(() => {
  const delta = 1 / TICK_RATE;

  // Update NPCs
  for (const id in state.players) {
    const player = state.players[id];
    if (player.state !== 'alive') continue;

    if (player.isNPC) {
      // Simple AI: Head towards nearest orb
      let nearestOrb: Orb | null = null;
      let minDist = Infinity;
      const head = player.segments[0];

      for (const orbId in state.orbs) {
        const orb = state.orbs[orbId];
        const dist = Math.sqrt((head.x - orb.x) ** 2 + (head.y - orb.y) ** 2);
        if (dist < minDist) {
          minDist = dist;
          nearestOrb = orb;
        }
      }

      if (nearestOrb) {
        const targetAngle = Math.atan2(nearestOrb.y - head.y, nearestOrb.x - head.x);
        let diff = targetAngle - player.currentAngle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;

        if (Math.abs(diff) > 0.1) {
          player.currentAngle += Math.sign(diff) * TURN_SPEED * delta;
        }
      }

      // Move NPC
      const speed = player.isBoosting ? BOOST_SPEED : BASE_SPEED;
      const newHead = {
        x: head.x + Math.cos(player.currentAngle) * speed * delta,
        y: head.y + Math.sin(player.currentAngle) * speed * delta,
      };

      // Boundary check for NPCs
      const boundary = WORLD_SIZE / 2;
      if (newHead.x < -boundary || newHead.x > boundary || newHead.y < -boundary || newHead.y > boundary) {
        player.currentAngle += Math.PI / 2; // Turn away
      }

      player.segments.unshift(newHead);
      const targetLength = Math.floor(player.score);
      while (player.segments.length > targetLength) {
        player.segments.pop();
      }

      // NPC Orb collection
      for (const orbId in state.orbs) {
        const orb = state.orbs[orbId];
        const dx = newHead.x - orb.x;
        const dy = newHead.y - orb.y;
        if (dx * dx + dy * dy < 4) {
          player.score += orb.value;
          delete state.orbs[orbId];
        }
      }

      // NPC Collision detection
      let npcCollided = false;
      for (const otherId in state.players) {
        if (otherId === id) continue;
        const other = state.players[otherId];
        if (other.state !== 'alive') continue;

        for (let i = 0; i < other.segments.length; i++) {
          const seg = other.segments[i];
          const dx = newHead.x - seg.x;
          const dy = newHead.y - seg.y;
          if (dx * dx + dy * dy < 2.25) {
            if (i === 0) {
              // Head to head
              npcCollided = true;
            } else {
              // Cut tail
              const droppedSegments = other.segments.slice(i);
              droppedSegments.forEach((s, idx) => {
                if (idx % 2 === 0) spawnOrb(s.x, s.y, 1, other.color, true);
              });
              other.segments = other.segments.slice(0, i);
              other.score = Math.max(10, other.segments.length);
              if (other.segments.length < 2) other.state = 'dead';
            }
            break;
          }
        }
        if (npcCollided) break;
      }

      if (npcCollided) {
        player.state = 'dead';
        player.segments.forEach((seg, i) => {
          if (i % 2 === 0) spawnOrb(seg.x, seg.y, 1, player.color, true);
        });
      }
    }

    // Common updates (boosting orb drops)
    if (player.isBoosting) {
      if (Math.random() < 0.1 && player.segments.length > 0) {
        const tail = player.segments[player.segments.length - 1];
        spawnOrb(tail.x, tail.y, 1, player.color, true);
      }
    }
  }

  // Respawn NPCs if they died
  const npcCount = Object.values(state.players).filter(p => p.isNPC && p.state === 'alive').length;
  if (npcCount < 5) {
    spawnNPC();
  }

  // Spawn random orbs
  if (Math.random() < 0.2) {
    spawnOrb();
  }

  // Update leaderboard
  state.leaderboard = Object.values(state.players)
    .filter(p => p.state === 'alive')
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(p => ({ id: p.id, name: p.name, score: Math.floor(p.score), color: p.color }));

  // Broadcast state
  io.emit('state', state);

}, 1000 / TICK_RATE);

async function startServer() {
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
