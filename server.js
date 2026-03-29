require('dotenv').config();
const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(compression());
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "'unsafe-eval'",
        "https://unpkg.com",
        "https://cdn.jsdelivr.net",
        "https://cdnjs.cloudflare.com"
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://unpkg.com",
        "https://cdn.jsdelivr.net",
        "https://fonts.googleapis.com",
        "https://cdnjs.cloudflare.com"
      ],
      imgSrc: [
        "'self'",
        "data:",
        "blob:",
        "https://*.tile.openstreetmap.org",
        "https://*.basemaps.cartocdn.com",
        "https://i.ibb.co",
        "https://image.ibb.co",
        "https://*.supabase.co"
      ],
      connectSrc: [
        "'self'",
        "https://*.supabase.co",
        "wss://*.supabase.co",
        "https://api.imgbb.com",
        "https://nominatim.openstreetmap.org"
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com",
        "https://cdnjs.cloudflare.com"
      ],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '7d',
  etag: true
}));

app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    imgbbApiKey: process.env.IMGBB_API_KEY
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🟢 Gwadloup Alèrt v2.0 — Port ${PORT}`);
});
