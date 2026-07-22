require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Keep the server alive if a library (e.g. the PDF parser) throws an async
// error the route handler can't catch. Log it instead of crashing the process,
// which would drop every in-flight request and show users "load failed".
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception (kept alive):', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection (kept alive):', reason);
});

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server calls (no origin) and listed origins
    if (!origin || allowedOrigins.some(o => origin === o || origin.endsWith('.netlify.app'))) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Tally Anthropic token usage per request and flush to the user's profile
app.use(require('./middleware/trackUsage'));

app.use('/api/profile',   require('./routes/profile'));
app.use('/api/resume',    require('./routes/resume'));
app.use('/api/jobs',      require('./routes/jobs'));
app.use('/api/ai',        require('./routes/ai'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/admin',     require('./routes/admin'));

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// TEMP diagnostic — reports only whether each env var is present, never its value.
app.get('/debug/env', (_req, res) => {
  const present = (v) => Boolean(process.env[v] && process.env[v].length > 0);
  res.json({
    SUPABASE_URL: present('SUPABASE_URL'),
    SUPABASE_SERVICE_KEY: present('SUPABASE_SERVICE_KEY'),
    SUPABASE_ANON_KEY: present('SUPABASE_ANON_KEY'),
    ANTHROPIC_API_KEY: present('ANTHROPIC_API_KEY'),
    anon_key_length: process.env.SUPABASE_ANON_KEY ? process.env.SUPABASE_ANON_KEY.length : 0,
  });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Apply Ready server on port ${PORT}`);
  console.log(`Job API: ${process.env.JOB_API_KEY ? 'Adzuna' : 'mock data (set JOB_API_ID + JOB_API_KEY to use Adzuna)'}`);
});
