import { connect as netConnect, type Socket } from 'node:net';
import { connect as tlsConnect } from 'node:tls';
import { randomUUID } from 'node:crypto';
import type { RateLimitResult } from './rateLimit';

const SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local max = tonumber(ARGV[3])
local member = ARGV[4]
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)
if count >= max then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local reset = now + window
  if oldest[2] then reset = tonumber(oldest[2]) + window end
  return {0, 0, reset}
end
redis.call('ZADD', key, now, member)
redis.call('EXPIRE', key, math.ceil(window / 1000) + 2)
local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
local reset = now + window
if oldest[2] then reset = tonumber(oldest[2]) + window end
return {1, max - count - 1, reset}
`;

type RedisReply = string | number | Array<RedisReply> | null;

function encode(parts: string[]): Buffer {
  return Buffer.from(`*${parts.length}\r\n${parts.map((p) => `$${Buffer.byteLength(p)}\r\n${p}\r\n`).join('')}`);
}

function parseReply(buffer: Buffer): { value: RedisReply; rest: Buffer } | null {
  const lineEnd = buffer.indexOf('\r\n');
  if (lineEnd < 0) return null;
  const prefix = String.fromCharCode(buffer[0] ?? 0);
  const line = buffer.subarray(1, lineEnd).toString();
  if (prefix === ':' || prefix === '+' || prefix === '-') {
    const value = prefix === ':' ? Number(line) : line;
    return { value, rest: buffer.subarray(lineEnd + 2) };
  }
  if (prefix === '$') {
    const len = Number(line);
    if (len < 0) return { value: null, rest: buffer.subarray(lineEnd + 2) };
    const start = lineEnd + 2;
    if (buffer.length < start + len + 2) return null;
    return { value: buffer.subarray(start, start + len).toString(), rest: buffer.subarray(start + len + 2) };
  }
  if (prefix === '*') {
    let rest = buffer.subarray(lineEnd + 2);
    const values: RedisReply[] = [];
    for (let i = 0; i < Number(line); i += 1) {
      const parsed = parseReply(rest);
      if (!parsed) return null;
      values.push(parsed.value); rest = parsed.rest;
    }
    return { value: values, rest };
  }
  throw new Error('Unsupported Redis response');
}

async function readOnce(socket: Socket): Promise<RedisReply> {
  return new Promise<RedisReply>((resolve, reject) => {
    let buffer = Buffer.alloc(0);
    const onData = (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      try {
        const parsed = parseReply(buffer);
        if (!parsed) return;
        socket.off('data', onData);
        resolve(parsed.value);
      } catch (error) {
        socket.off('data', onData);
        reject(error);
      }
    };
    socket.on('data', onData);
    socket.once('error', reject);
    socket.once('timeout', () => reject(new Error('Redis timeout')));
  });
}

async function writeCommand(socket: Socket, parts: string[]): Promise<RedisReply> {
  socket.write(encode(parts));
  return readOnce(socket);
}

async function tcpCommand(parts: string[], parsed: URL): Promise<RedisReply> {
  const secure = parsed.protocol === 'rediss:';
  const socket = await new Promise<Socket>((resolve, reject) => {
    const onConnect = (s: Socket) => { s.setTimeout(4000); resolve(s); };
    const onError = (error: Error) => reject(error);
    const port = Number(parsed.port || 6379);
    if (secure) tlsConnect({ host: parsed.hostname, port, rejectUnauthorized: true }, function () { onConnect(this); }).once('error', onError);
    else netConnect({ host: parsed.hostname, port }, function () { onConnect(this); }).once('error', onError);
  });
  try {
    if (parsed.password) {
      const user = parsed.username ? decodeURIComponent(parsed.username) : '';
      const password = decodeURIComponent(parsed.password);
      const auth = await writeCommand(socket, user ? ['AUTH', user, password] : ['AUTH', password]);
      if (typeof auth === 'string' && auth.startsWith('ERR')) throw new Error(auth);
    }
    if (parsed.pathname && parsed.pathname !== '/') {
      const db = Number(parsed.pathname.slice(1));
      const selected = await writeCommand(socket, ['SELECT', String(Number.isFinite(db) ? db : 0)]);
      if (typeof selected === 'string' && selected.startsWith('ERR')) throw new Error(selected);
    }
    return writeCommand(socket, parts);
  } finally {
    socket.end();
  }
}

async function restCommand(baseUrl: URL, command: string[]): Promise<RedisReply> {
  const token = process.env.REDIS_TOKEN;
  const headers: HeadersInit = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  const response = await fetch(baseUrl, { method: 'POST', headers, body: JSON.stringify(command), cache: 'no-store' });
  if (!response.ok) throw new Error(`Redis REST ${response.status}`);
  const payload = await response.json() as { result?: RedisReply };
  return payload.result ?? null;
}

export async function consumeRedisRateLimit(key: string, max: number, windowMs: number, now = Date.now()): Promise<RateLimitResult | null> {
  const raw = process.env.REDIS_URL?.trim();
  if (!raw) return null;
  const parsed = new URL(raw);
  const redisKey = `finova:${key}`;
  const uniqueMember = `${now}-${randomUUID()}`;
  let reply: RedisReply;
  if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
    reply = await restCommand(parsed, ['EVAL', SCRIPT, '1', redisKey, String(now), String(windowMs), String(max), uniqueMember]);
  } else if (parsed.protocol === 'redis:' || parsed.protocol === 'rediss:') {
    reply = await tcpCommand(['EVAL', SCRIPT, '1', redisKey, String(now), String(windowMs), String(max), uniqueMember], parsed);
  } else throw new Error(`Unsupported REDIS_URL protocol: ${parsed.protocol}`);
  if (!Array.isArray(reply) || reply.length < 3) throw new Error('Unexpected Redis limiter response');
  const [allowed, remaining, resetAt] = reply;
  return { allowed: Number(allowed) === 1, remaining: Math.max(0, Number(remaining)), resetAt: Number(resetAt), limit: max };
}
