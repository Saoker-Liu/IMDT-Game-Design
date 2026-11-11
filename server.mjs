import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { makePlayer, makeGame, act, tick, viewFor, finish } from './public/engine.mjs';
import { MAPS, terrainFor } from './public/terrain.mjs';

const PUBLIC = path.resolve(fileURLToPath(new URL('./public/', import.meta.url)));
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon', '.json': 'application/json' };
const clean = (s, fallback, max = 20) => typeof s === 'string' && s.trim() ? s.trim().slice(0, max) : fallback;
const token = () => randomBytes(32).toString('hex');
const equalToken = (a, b) => typeof a === 'string' && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export function createGameServer({ now = Date.now, disconnectMs = 90_000, rng = Math.random } = {}) {
  const rooms = new Map();
  const sessions = new Map();
  const limits = new Map();
  function dropMember(room, playerId) {
    const index = room.game.players.findIndex(p => p.id === playerId);
    if (index < 0) return;
    const member = room.members.get(playerId);
    if (member) sessions.delete(member.token);
    room.members.delete(playerId);
    if (room.members.size === 0) { rooms.delete(room.id); return; }
    if (room.game.phase === 'lobby') {
      room.game.players.splice(index, 1);
      room.game.players.forEach((p, i) => { p.ready = false; p.terrain = terrainFor(room.game.mapId, i); });
      room.game.version++;
    } else if (room.game.phase !== 'result') {
      finish(room.game, 1 - index, now(), 'left');
    }
  }
  const timer = setInterval(() => {
    for (const room of rooms.values()) {
      tick(room.game, now());
      for (const [id, member] of room.members) {
        if (now() - member.lastSeen > disconnectMs) dropMember(room, id);
      }
      if (now() - room.createdAt > 6 * 60 * 60 * 1000) {
        for (const member of room.members.values()) sessions.delete(member.token);
        rooms.delete(room.id);
      }
    }
    for (const [ip, item] of limits) if (now() - item.at > 60_000) limits.delete(ip);
  }, 250);
  timer.unref();

  const server = http.createServer(async (req, res) => {
    const send = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(JSON.stringify(data));
    };
    try {
      const url = new URL(req.url, 'http://localhost');
      if (!url.pathname.startsWith('/api/')) {
        if (req.method !== 'GET' && req.method !== 'HEAD') return send(405, { error: 'Method not allowed' });
        const route = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
        const target = path.resolve(PUBLIC, `.${route}`);
        if (!target.startsWith(PUBLIC + path.sep)) return send(403, { error: 'Forbidden' });
        try {
          const data = await readFile(target);
          res.writeHead(200, { 'Content-Type': MIME[path.extname(target)] || 'application/octet-stream',
            'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin' });
          return res.end(req.method === 'HEAD' ? undefined : data);
        } catch { return send(404, { error: 'Not found' }); }
      }
      // The LAN service is same-origin only. No permissive CORS or credentials in URLs.
      if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}` && req.headers.origin !== `https://${req.headers.host}`) {
        return send(403, { error: '请从房间服务器的地址打开游戏' });
      }
      if (url.pathname === '/api/health' && req.method === 'GET') return send(200, { ok: true, mode: 'lan', version: '3.0.0' });
      if (url.pathname === '/api/rooms' && req.method === 'GET') {
        return send(200, { rooms: [...rooms.values()].map(r => ({
          id: r.id, name: r.name, mapId: r.game.mapId, count: r.members.size, phase: r.game.phase,
          host: r.game.players.find(p => r.members.has(p.id))?.name || '指挥官', createdAt: r.createdAt,
        })).sort((a, b) => b.createdAt - a.createdAt) });
      }
      let body = {};
      if (req.method === 'POST') {
        const ip = req.socket.remoteAddress;
        const bucket = limits.get(ip) || { at: now(), count: 0 };
        if (now() - bucket.at > 60_000) { bucket.at = now(); bucket.count = 0; }
        bucket.count++; limits.set(ip, bucket);
        if (bucket.count > 600) return send(429, { error: '操作过于频繁，请稍后重试' });
        let size = 0, raw = '';
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 8192) return send(413, { error: '请求过大' });
          raw += chunk;
        }
        try { body = JSON.parse(raw || '{}'); } catch { return send(400, { error: '无效 JSON' }); }
        if (!body || typeof body !== 'object' || Array.isArray(body)) return send(400, { error: '无效请求' });
      }
      if (req.method === 'POST' && ['/api/create', '/api/join'].includes(url.pathname)) {
        const name = clean(body.name, '指挥官', 16);
        const id = randomUUID();
        const secret = token();
        let room;
        if (url.pathname === '/api/create') {
          const mapId = body.mapId ?? 'open-sea';
          if (!MAPS.some(m => m.id === mapId)) return send(400, { error: '未知的作战地图' });
          if (rooms.size >= 100) return send(409, { error: '房间已满，请稍后再试' });
          let code;
          do { code = randomBytes(3).toString('hex').toUpperCase(); } while (rooms.has(code));
          room = { id: code, name: clean(body.roomName, `${name}的海域`), createdAt: now(),
            game: makeGame([makePlayer(id, name)], mapId), members: new Map() };
          rooms.set(code, room);
        } else {
          room = rooms.get(String(body.roomId || '').toUpperCase());
          if (!room) return send(404, { error: '房间不存在或已结束' });
          if (room.game.phase !== 'lobby' || room.members.size >= 2) return send(409, { error: '房间已满或正在交战' });
          const player = makePlayer(id, name);
          player.terrain = terrainFor(room.game.mapId, room.game.players.length);
          room.game.players.push(player); room.game.version++;
        }
        room.members.set(id, { token: secret, lastSeen: now() });
        sessions.set(secret, { roomId: room.id, playerId: id });
        return send(200, { token: secret, roomId: room.id });
      }
      const bearer = (req.headers.authorization || '').replace(/^Bearer /, '');
      const session = sessions.get(bearer);
      const room = session && rooms.get(session.roomId);
      const member = room?.members.get(session?.playerId);
      if (!room || !member || !equalToken(bearer, member.token)) return send(401, { error: '房间连接已结束，请重新进入' });
      member.lastSeen = now();
      tick(room.game, now());
      if (url.pathname === '/api/state' && req.method === 'GET') return send(200, {
        ...viewFor(room.game, session.playerId), roomId: room.id, roomName: room.name, serverNow: now(),
        opponentConnected: room.members.size === 2,
      });
      if (url.pathname === '/api/action' && req.method === 'POST') {
        try { act(room.game, session.playerId, body, now(), rng); }
        catch (error) { return send(409, { error: error.message }); }
        return send(200, { ...viewFor(room.game, session.playerId), roomId: room.id, roomName: room.name,
          serverNow: now(), opponentConnected: room.members.size === 2 });
      }
      if (url.pathname === '/api/leave' && req.method === 'POST') {
        dropMember(room, session.playerId); return send(200, { ok: true });
      }
      return send(404, { error: 'Not found' });
    } catch (error) {
      console.error('Request failed:', error.message);
      if (!res.headersSent) send(500, { error: '服务器暂时无法处理，请重试' });
      else res.end();
    }
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 15_000;
  server.on('close', () => clearInterval(timer));
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const port = Number(process.env.PORT) || 3000;
  const server = createGameServer();
  server.listen(port, '0.0.0.0', () => {
    console.log(`\n  雾海对弈 · FOGBOUND\n  本机试玩  http://localhost:${port}`);
    for (const entries of Object.values(networkInterfaces())) for (const net of entries || []) {
      if (net.family === 'IPv4' && !net.internal) console.log(`  局域网    http://${net.address}:${port}`);
    }
    console.log('\n  同一 Wi-Fi 的玩家打开相同的局域网地址即可创建 / 加入房间。\n');
  });
}
