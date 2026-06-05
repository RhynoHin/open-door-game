"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 5173);
const HOST = process.env.HOST || "0.0.0.0";
const rooms = new Map();

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
};

function roomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return rooms.has(code) ? roomCode() : code;
}

function cleanRoom(value) {
  const code = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  return code || roomCode();
}

function getRoom(code) {
  if (!rooms.has(code)) rooms.set(code, { code, clients: new Set(), state: null });
  return rooms.get(code);
}

function seatFor(room) {
  const used = new Set([...room.clients].map((client) => client.seat).filter((seat) => seat != null));
  if (!used.has(0)) return 0;
  if (!used.has(1)) return 1;
  return null;
}

function playerCount(room) {
  return [...room.clients].filter((client) => client.seat != null).length;
}

function sendFrame(socket, data) {
  const payload = Buffer.from(data);
  let header = null;
  if (payload.length < 126) {
    header = Buffer.from([0x81, payload.length]);
  } else if (payload.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }
  socket.write(Buffer.concat([header, payload]));
}

function sendJson(client, message) {
  if (client.socket.destroyed) return;
  sendFrame(client.socket, JSON.stringify(message));
}

function broadcast(room, message, except = null) {
  for (const client of room.clients) {
    if (client !== except) sendJson(client, message);
  }
}

function announcePeers(room) {
  const peers = playerCount(room);
  broadcast(room, { type: "peer", peers });
}

function removeClient(client) {
  const room = client.room;
  if (!room) return;
  room.clients.delete(client);
  announcePeers(room);
  if (room.clients.size === 0) rooms.delete(room.code);
}

function parseFrames(client, chunk) {
  client.buffer = Buffer.concat([client.buffer, chunk]);
  const messages = [];
  while (client.buffer.length >= 2) {
    const second = client.buffer[1];
    let length = second & 0x7f;
    let offset = 2;
    if (length === 126) {
      if (client.buffer.length < 4) break;
      length = client.buffer.readUInt16BE(2);
      offset = 4;
    } else if (length === 127) {
      if (client.buffer.length < 10) break;
      length = Number(client.buffer.readBigUInt64BE(2));
      offset = 10;
    }
    const masked = Boolean(second & 0x80);
    const maskOffset = masked ? offset : -1;
    const payloadOffset = offset + (masked ? 4 : 0);
    const frameEnd = payloadOffset + length;
    if (client.buffer.length < frameEnd) break;

    const first = client.buffer[0];
    const opcode = first & 0x0f;
    if (opcode === 0x8) {
      client.socket.end();
      return messages;
    }
    if (opcode === 0x1) {
      const payload = Buffer.from(client.buffer.subarray(payloadOffset, frameEnd));
      if (masked) {
        const mask = client.buffer.subarray(maskOffset, maskOffset + 4);
        for (let i = 0; i < payload.length; i += 1) payload[i] ^= mask[i % 4];
      }
      messages.push(payload.toString("utf8"));
    }
    client.buffer = client.buffer.subarray(frameEnd);
  }
  return messages;
}

function handleClientMessage(client, raw) {
  let message = null;
  try {
    message = JSON.parse(raw);
  } catch {
    return;
  }
  if (!message || typeof message.type !== "string") return;

  if (message.type === "state" && message.state) {
    client.room.state = message.state;
    broadcast(client.room, { type: "state", reason: message.reason || "state", state: message.state, seat: client.seat }, client);
  }

  if (message.type === "action" && message.action) {
    broadcast(client.room, { type: "action", action: message.action, seat: client.seat }, client);
  }
}

function handleUpgrade(req, socket) {
  const key = req.headers["sec-websocket-key"];
  if (!key) {
    socket.destroy();
    return;
  }
  const url = new URL(req.url, `http://${req.headers.host}`);
  const code = cleanRoom(url.searchParams.get("room"));
  const room = getRoom(code);
  const client = {
    id: crypto.randomUUID(),
    socket,
    room,
    seat: seatFor(room),
    buffer: Buffer.alloc(0),
  };
  room.clients.add(client);

  const accept = crypto.createHash("sha1").update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest("base64");
  socket.write(
    [
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Accept: ${accept}`,
      "",
      "",
    ].join("\r\n"),
  );

  sendJson(client, {
    type: "welcome",
    room: room.code,
    seat: client.seat,
    peers: playerCount(room),
    hasState: Boolean(room.state),
  });
  if (room.state) sendJson(client, { type: "state", reason: "sync", state: room.state });
  announcePeers(room);

  socket.on("data", (chunk) => {
    for (const message of parseFrames(client, chunk)) handleClientMessage(client, message);
  });
  socket.on("close", () => removeClient(client));
  socket.on("error", () => removeClient(client));
}

function safePath(urlPath) {
  const pathname = decodeURIComponent(urlPath.split("?")[0]);
  const file = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const resolved = path.resolve(ROOT, file);
  return resolved.startsWith(ROOT) ? resolved : path.join(ROOT, "index.html");
}

const server = http.createServer((req, res) => {
  const filePath = safePath(req.url || "/");
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "content-type": types[path.extname(filePath)] || "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(data);
  });
});

server.on("upgrade", (req, socket) => {
  if (!req.url.startsWith("/ws")) {
    socket.destroy();
    return;
  }
  handleUpgrade(req, socket);
});

server.listen(PORT, HOST, () => {
  const urls = [`http://127.0.0.1:${PORT}`];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === "IPv4" && !entry.internal) urls.push(`http://${entry.address}:${PORT}`);
    }
  }
  console.log(`Elite Ring Clash server`);
  console.log(urls.join("\n"));
});
