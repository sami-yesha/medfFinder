/**
 * MedFinder - Admin Auth
 * Credentials come from .env; tokens are HMAC-signed { email, exp } payloads.
 */
const crypto = require('crypto');

const TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

// Without a configured secret, tokens are only valid until the server restarts
const SECRET = process.env.ADMIN_TOKEN_SECRET || crypto.randomBytes(32).toString('hex');

const sign = (data) => crypto.createHmac('sha256', SECRET).update(data).digest('base64url');

/** Constant-time string comparison */
const safeEqual = (a, b) => {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
};

const issueToken = (email) => {
  const payload = Buffer.from(JSON.stringify({ email, exp: Date.now() + TOKEN_TTL_MS })).toString('base64url');
  return `${payload}.${sign(payload)}`;
};

const verifyToken = (token) => {
  const [payload, sig] = String(token || '').split('.');
  if (!payload || !sig || !safeEqual(sig, sign(payload))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
};

// ── POST /api/auth/login ─────────────────────────────────────
const login = (req, res) => {
  const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    return res.status(503).json({ message: 'Admin login is not configured on the server.' });
  }

  const { email, password } = req.body || {};
  const emailOk = safeEqual(String(email || '').trim().toLowerCase(), ADMIN_EMAIL.toLowerCase());
  const passOk  = safeEqual(password || '', ADMIN_PASSWORD);
  if (!emailOk || !passOk) return res.status(401).json({ message: 'Invalid email or password.' });

  res.json({ token: issueToken(ADMIN_EMAIL), email: ADMIN_EMAIL, expiresIn: TOKEN_TTL_MS });
};

// ── Middleware: require a valid admin Bearer token ───────────
const requireAdmin = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  const admin  = verifyToken(token);
  if (!admin) return res.status(401).json({ message: 'Authentication required.' });
  req.admin = admin;
  next();
};

module.exports = { login, requireAdmin };
