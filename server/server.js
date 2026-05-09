/**
 * MedFinder - Express Server Entry Point
 */
const express = require('express');
const cors    = require('cors');
const dotenv  = require('dotenv');
const path    = require('path');

// Load env vars BEFORE anything else
dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB = require('./config/db');

// Connect to MongoDB
connectDB();

const app = express();

// ── Middleware ──────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Serve the client/ folder as static files (CSS, JS, images)
app.use(express.static(path.join(__dirname, '../client')));

// ── API Routes ──────────────────────────────────────────────
app.use('/api/pharmacies', require('./routes/pharmacyRoutes'));
app.use('/api',            require('./routes/medicineRoutes'));

// ── HTML Page Routes (clean URLs, query strings preserved) ──
// e.g. /pages/details?pharmacyId=X&medicineId=Y → details.html
app.get('/pages/:page', (req, res) => {
  const file = path.join(__dirname, '../client/pages', req.params.page + '.html');
  res.sendFile(file, err => {
    if (err) res.status(404).json({ message: 'Page not found' });
  });
});

// Root → index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// ── Start ───────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀  MedFinder running → http://localhost:${PORT}`);
  console.log(`📦  MongoDB          → ${process.env.MONGODB_URI}`);
  console.log(`🌍  Env              → ${process.env.NODE_ENV || 'development'}\n`);
});
