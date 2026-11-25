import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AuditConfig, AuditReport, CrawlProgressEvent } from './src/types/audit.ts';
import { runWebsiteAudit } from './server/crawler.ts';
import { generateGroundedAICritique } from './server/aiCritique.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '16mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/critique', async (req, res) => {
    const report = req.body as Omit<AuditReport, 'aiCritique'> | undefined;
    if (!report || !report.domain || !report.ui) {
      res.status(400).json({ error: 'Invalid audit report payload.' });
      return;
    }
    const critique = await generateGroundedAICritique(report);
    res.json(critique);
  });

  // Live SSE streaming website audit endpoint
  app.post('/api/analyze/stream', async (req, res) => {
    const body = req.body as Partial<AuditConfig> | undefined;
    if (!body || typeof body.url !== 'string' || !body.url.trim()) {
      res.status(400).json({ error: 'Please provide a valid website URL.' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const abortController = new AbortController();
    let streamClosed = false;

    const sendEvent = (event: CrawlProgressEvent) => {
      if (streamClosed || res.writableEnded) return;
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    res.on('close', () => {
      if (!res.writableEnded) {
        streamClosed = true;
        abortController.abort();
      }
    });

    // Heartbeat keep-alive so proxies never drop long multi-page crawls
    const heartbeat = setInterval(() => {
      if (!streamClosed && !res.writableEnded) {
        res.write(': keep-alive\n\n');
      }
    }, 10000);

    try {
      const config: AuditConfig = {
        url: body.url.trim(),
        maxPages: typeof body.maxPages === 'number' ? body.maxPages : 10,
        viewports: Array.isArray(body.viewports) && body.viewports.length > 0 ? body.viewports : ['desktop', 'tablet', 'phone'],
      };

      await runWebsiteAudit(config, sendEvent, abortController.signal);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred while crawling this website.';
      sendEvent({
        type: 'error',
        stage: 'Crawl Failed',
        message,
        percent: 0,
        error: message,
      });
    } finally {
      clearInterval(heartbeat);
      if (!res.writableEnded) {
        res.end();
      }
    }
  });

  // Vite dev middleware or production static assets
  const isProd = process.env.NODE_ENV === 'production';
  const distDir = path.resolve(__dirname, 'dist');

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Monograph server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Monograph server:', err);
  process.exit(1);
});
