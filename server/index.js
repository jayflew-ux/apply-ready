require('dotenv').config();
const express = require('express');
const cors = require('cors');

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

app.use('/api/profile',   require('./routes/profile'));
app.use('/api/resume',    require('./routes/resume'));
app.use('/api/jobs',      require('./routes/jobs'));
app.use('/api/ai',        require('./routes/ai'));
app.use('/api/documents', require('./routes/documents'));

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Apply Ready server on port ${PORT}`);
  console.log(`Job API: ${process.env.JOB_API_KEY ? 'Adzuna' : 'mock data (set JOB_API_ID + JOB_API_KEY to use Adzuna)'}`);
});
