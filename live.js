/**
 * GET /api/live?matchId=xxx
 * SSE — scorer push করলে সাথে সাথে viewer পাবে
 * Vercel max 25s → client auto-reconnect করবে
 */

import { Redis } from '@upstash/redis';

const kv = new Redis({
  url:   process.env.LIVECS_KV_REST_API_URL,
  token: process.env.LIVECS_KV_REST_API_TOKEN,
});

export const config = { maxDuration: 25 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const matchId = req.query.matchId || req.query.match;
  if (!matchId) return res.status(400).end();

  // SSE headers
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  const send = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // সাথে সাথে current data পাঠাও
  const raw = await kv.get(`match:${matchId}`);
  if (!raw) {
    send({ error: 'not_found' });
    return res.end();
  }
  send(typeof raw === 'string' ? JSON.parse(raw) : raw);

  // Signal poll — 1 সেকেন্ড পরপর চেক
  let lastSignal = await kv.get(`signal:${matchId}`) || '0';
  let alive = true;
  res.on('close', () => { alive = false; });

  const interval = setInterval(async () => {
    if (!alive) { clearInterval(interval); return; }

    try {
      const sig = await kv.get(`signal:${matchId}`);
      if (sig && sig !== lastSignal) {
        lastSignal = sig;
        const d = await kv.get(`match:${matchId}`);
        if (d) send(typeof d === 'string' ? JSON.parse(d) : d);
      }
    } catch {}
  }, 1000);

  // 23s পর বন্ধ — client reconnect করবে
  setTimeout(() => {
    clearInterval(interval);
    if (alive) {
      res.write('event: reconnect\ndata: {}\n\n');
      res.end();
    }
  }, 23000);
}
