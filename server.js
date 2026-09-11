const express = require('express');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Public URL of the site (e.g. https://valuegrid.com).
// Used for links inside emails. Falls back to localhost in development.
const PUBLIC_URL = (process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/$/, '');

// Admin panel password — must be set in production (see render.yaml).
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

app.use(express.json());
app.use(express.static(__dirname));

// ─── Admin auth ────────────────────────────────────────────────
// Protects every /api/admin/* route and the admin.html page itself.
// The client sends the password as `Authorization: Bearer <password>`,
// or as `?admin_key=<password>` for the initial page load.
function adminKey(req) {
  const auth = req.headers.authorization || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  return bearer || (typeof req.query.admin_key === 'string' ? req.query.admin_key : '');
}
function requireAdmin(req, res, next) {
  if (ADMIN_PASSWORD && adminKey(req) === ADMIN_PASSWORD) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized. Admin password required.' });
}

// Admin credentials check (used by the login form)
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (ADMIN_PASSWORD && password === ADMIN_PASSWORD) {
    return res.json({ success: true });
  }
  return res.status(401).json({ error: 'Incorrect admin password.' });
});

// ─── SMTP Config ───────────────────────────────────────────────
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';

if (!SMTP_USER || !SMTP_PASS) {
  console.error('⚠ SMTP_USER and SMTP_PASS environment variables are required.');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

// ─── Email brand assets (attached as inline logo via CID) ──────
const LOGO_PATH = path.join(__dirname, 'logo-light.png');
const EMAIL_LOGO = {
  filename: 'logo-light.png',
  path: LOGO_PATH,
  cid: 'vg-logo', // referenced as <img src="cid:vg-logo"> in templates
};

// White wordmark for dark-background emails. (The file is named logo-dark.png,
// i.e. "the logo for dark backgrounds" — it has white text.)
const EMAIL_LOGO_WHITE = {
  filename: 'logo-dark.png',
  path: path.join(__dirname, 'logo-dark.png'),
  cid: 'vg-logo-white', // referenced as <img src="cid:vg-logo-white">
};

// ─── In-memory OTP store ──────────────────────────────────────
// { email: { otp, expiresAt, purpose } }
const otpStore = {};

// ─── User data file ───────────────────────────────────────────
const USERS_FILE = path.join(__dirname, 'users.json');
const LOGINS_FILE = path.join(__dirname, 'logins.json');
const REVIEWS_FILE = path.join(__dirname, 'reviews.json');

function loadUsers() {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8')); } catch { return []; }
}
function saveUsers(users) { fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2)); }

function loadLogins() {
  try { return JSON.parse(fs.readFileSync(LOGINS_FILE, 'utf-8')); } catch { return []; }
}
function saveLogins(logins) { fs.writeFileSync(LOGINS_FILE, JSON.stringify(logins, null, 2)); }

function loadReviews() {
  try { return JSON.parse(fs.readFileSync(REVIEWS_FILE, 'utf-8')); } catch { return []; }
}
function saveReviews(reviews) { fs.writeFileSync(REVIEWS_FILE, JSON.stringify(reviews, null, 2)); }


// ─── OTP helpers ──────────────────────────────────────────────
function generateOTP() {
  return String(crypto.randomInt(100000, 999999));
}

// Replace the plain-text CTA button in a template with a real link.
// Templates keep the raw text `Open ValueGrid` inside the button cell
// so this stays a simple, safe find-and-replace.
function injectOpenLink(html) {
  return html.split('{{LINK}}').join(PUBLIC_URL);
}

function buildEmailHTML(otp) {
  const templatePath = path.join(__dirname, 'valuegrid-mail-template.html');
  let html = fs.readFileSync(templatePath, 'utf-8');
  html = html.replace('{{OTP}}', otp.split('').join(' '));
  return injectOpenLink(html);
}

// ─── Password Reset Email (OTP code) ───────────────────────
function buildPasswordResetHTML(otp) {
  const templatePath = path.join(__dirname, 'valuegrid-password-reset-mail.html');
  let html = fs.readFileSync(templatePath, 'utf-8');
  // The template renders each OTP digit in its own box ({{D1}}..{{D6}}).
  String(otp).padStart(6, '0').split('').forEach((digit, i) => {
    html = html.replace(`{{D${i + 1}}}`, digit);
  });
  html = html.replace('{{OTP}}', otp.split('').join(' '));
  html = html.replace('http://localhost:3000', PUBLIC_URL);
  return html;
}

// ─── Login Alert Email ──────────────────────────────────
function sniffDevice(userAgent) {
  const ua = userAgent || '';
  const browser = /Edg\//.test(ua) ? 'Edge'
    : /OPR\//.test(ua) ? 'Opera'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Safari\//.test(ua) ? 'Safari' : 'Unknown Browser';
  const os = /Windows/.test(ua) ? 'Windows'
    : /Android/.test(ua) ? 'Android'
    : /iPhone|iPad|iOS/.test(ua) ? 'iOS'
    : /Mac OS X/.test(ua) ? 'macOS'
    : /Linux/.test(ua) ? 'Linux' : 'Unknown OS';
  return `${browser} on ${os}`;
}

function buildLoginAlertHTML(req) {
  const templatePath = path.join(__dirname, 'valuegrid-login-alert-mail.html');
  let html = fs.readFileSync(templatePath, 'utf-8');
  const ip = (req.ip || req.socket.remoteAddress || 'Unknown').replace('::ffff:', '').replace('::1', '127.0.0.1');
  const device = sniffDevice(req.headers['user-agent']);
  const time = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric', month: 'long', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true
  }) + ' IST';

  html = html.replace('Chrome on Windows', device);
  html = html.replace('Mumbai, Maharashtra, India', 'India');
  html = html.replace('103.45.67.89', ip);
  html = html.replace('July 10, 2025 &middot; 2:34 PM IST', time);
  html = html.replace('Secure My Account',
    `<a href="${PUBLIC_URL}" style="font-size:14px; font-weight:600; color:#ffffff; text-decoration:none; display:inline-block;">Secure My Account</a>`);
  html = html.replace('href="#" style="font-size:14px; font-weight:600; color:#181818; text-decoration:none; display:inline-block;">This Was Me',
    `href="${PUBLIC_URL}" style="font-size:14px; font-weight:600; color:#181818; text-decoration:none; display:inline-block;">This Was Me`);
  return html;
}

function sendLoginAlertEmail(to, req) {
  if (!to) return;
  transporter.sendMail({
    from: `"ValueGrid" <${SMTP_USER}>`,
    to: to,
    subject: 'New login to your ValueGrid account',
    attachments: [EMAIL_LOGO],
    html: buildLoginAlertHTML(req)
  })
  .then(() => console.log(`[LoginAlert] Sent to ${to}`))
  .catch(e => console.error('[LoginAlert Error]', e.message));
}

// ─── Thank You Email ────────────────────────────────────────
function buildThankYouHTML(name) {
  const templatePath = path.join(__dirname, 'valuegrid-welcome-mail.html');
  let html = fs.readFileSync(templatePath, 'utf-8');
  html = html.replace('{{NAME}}', name);
  return injectOpenLink(html);
}

function sendThankYouEmail(to, name) {
  if (!to || !name) return;
  transporter.sendMail({
    from: `"ValueGrid" <${SMTP_USER}>`,
    to: to,
    subject: 'Thank you for signing in to ValueGrid',
    attachments: [EMAIL_LOGO],
    html: buildThankYouHTML(name)
  })
  .then(() => console.log(`[ThankYou] Sent to ${to}`))
  .catch(e => console.error('[ThankYou Error]', e.message));
}

// ─── API: Request OTP (forgot password) ───────────────────────
app.post('/api/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required.' });

  const users = loadUsers();
  const user = users.find((u) => u.email === email.toLowerCase().trim());

  // Always return success to prevent email enumeration
  if (!user) {
    return res.json({ success: true, message: 'If an account with that email exists, an OTP has been sent.' });
  }

  const otp = generateOTP();
  otpStore[email.toLowerCase().trim()] = {
    otp,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    purpose: 'password-reset',
  };

  try {
    await transporter.sendMail({
      from: `"ValueGrid Security" <${SMTP_USER}>`,
      to: email,
      subject: 'Your OTP for Password Reset',
      attachments: [EMAIL_LOGO_WHITE],
      html: buildPasswordResetHTML(otp),
    });
    console.log(`[OTP] Sent to ${email}: ${otp}`);
    res.json({ success: true, message: 'If an account with that email exists, an OTP has been sent.' });
  } catch (err) {
    console.error('[SMTP Error]', err.message);
    res.status(500).json({ error: 'Failed to send email. Please try again later.' });
  }
});

// ─── API: Verify OTP ─────────────────────────────────────────
app.post('/api/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required.' });

  const key = email.toLowerCase().trim();
  const record = otpStore[key];

  if (!record) {
    return res.status(400).json({ error: 'No OTP request found. Please request a new code.' });
  }
  if (Date.now() > record.expiresAt) {
    delete otpStore[key];
    return res.status(400).json({ error: 'OTP has expired. Please request a new code.' });
  }
  if (record.otp !== otp.trim()) {
    return res.status(400).json({ error: 'Invalid OTP. Please try again.' });
  }

  // OTP verified — mark it, don't delete yet (reset needs it)
  record.verified = true;
  res.json({ success: true, message: 'OTP verified successfully.' });
});

// ─── API: Reset Password ─────────────────────────────────────
app.post('/api/reset-password', (req, res) => {
  const { email, newPassword } = req.body;
  if (!email || !newPassword) return res.status(400).json({ error: 'Email and new password are required.' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

  const key = email.toLowerCase().trim();
  const record = otpStore[key];

  if (!record || !record.verified) {
    return res.status(400).json({ error: 'OTP not verified. Please complete the verification first.' });
  }

  // Update user password
  const users = loadUsers();
  const user = users.find((u) => u.email === key);
  if (!user) {
    return res.status(400).json({ error: 'User not found.' });
  }

  // Simple hash to match client-side hashPassword()
  const hash = simpleHash(newPassword);
  user.password = hash;
  saveUsers(users);

  // Cleanup
  delete otpStore[key];

  console.log(`[Reset] Password changed for ${key}`);
  res.json({ success: true, message: 'Password has been reset successfully. You can now login.' });
});

// ─── Simple hash (matches client-side) ────────────────────────
function simpleHash(password) {
  const str = 'vg_salt_' + password + '_pepper';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = ((hash < 5) - hash) + ch;
    hash = hash & hash;
  }
  return 'h_' + Math.abs(hash).toString(36);
}

// ─── API: Signup (also store server-side) ─────────────────────
app.post('/api/signup', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'All fields are required.' });

  const users = loadUsers();
  const exists = users.find((u) => u.email === email.toLowerCase().trim());
  if (exists) return res.status(409).json({ error: 'An account with this email already exists.' });

  const user = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    name,
    email: email.toLowerCase().trim(),
    password: simpleHash(password),
    createdAt: new Date().toISOString(),
    phone: '',
    businessName: '',
    businessType: '',
    location: '',
  };

  users.push(user);
  saveUsers(users);

  // Record login on signup
  const logins = loadLogins();
  logins.push({
    email: user.email,
    timestamp: new Date().toISOString(),
    status: 'signup',
    ip: req.ip || req.socket.remoteAddress
  });
  saveLogins(logins);

  console.log(`[Signup] ${user.email}`);
  res.json({ success: true, message: 'Account created.' });
  sendThankYouEmail(user.email, user.name);
});

// ─── API: Update Profile (server-side) ───────────────────────
app.put('/api/profile', (req, res) => {
  const { email, phone, businessName, businessType, location } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  const users = loadUsers();
  const user = users.find((u) => u.email === email.toLowerCase().trim());
  if (!user) return res.status(404).json({ error: 'User not found' });

  user.phone = phone || user.phone;
  user.businessName = businessName || user.businessName;
  user.businessType = businessType || user.businessType;
  user.location = location || user.location;
  saveUsers(users);

  console.log(`[Profile Updated] ${user.email}`);
  res.json({ success: true, message: 'Profile updated.' });
});

// ─── API: Login (check server-side) ──────────────────────────
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'All fields are required.' });

  const users = loadUsers();
  const hashed = simpleHash(password);
  const user = users.find((u) => u.email === email.toLowerCase().trim() && u.password === hashed);

  if (!user) return res.status(401).json({ error: 'Invalid email or password.' });

  const sessionUser = { ...user };
  delete sessionUser.password;

  // Record login
  const logins = loadLogins();
  logins.push({
    email: user.email,
    timestamp: new Date().toISOString(),
    status: 'success',
    ip: req.ip || req.socket.remoteAddress
  });
  saveLogins(logins);

  res.json({ success: true, user: sessionUser });
  sendLoginAlertEmail(user.email, req);
});

// ─── API: Google Auth ──────────────────────────────────────────
// The client sends a Google OAuth2 access token; we verify it against
// Google's userinfo endpoint before trusting it.
app.post('/api/google-auth', async (req, res) => {
  const { accessToken } = req.body;
  if (!accessToken) {
    return res.status(400).json({ error: 'Google access token required' });
  }

  let profile;
  try {
    const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { 'Authorization': 'Bearer ' + accessToken }
    });
    if (!r.ok) {
      console.error('[GoogleAuth] userinfo failed: ' + r.status);
      return res.status(401).json({ error: 'Invalid Google credentials. Please try again.' });
    }
    profile = await r.json();
  } catch (err) {
    console.error('[GoogleAuth Error]', err.message);
    return res.status(500).json({ error: 'Failed to verify with Google. Try again.' });
  }

  const email = (profile.email || '').toLowerCase().trim();
  if (!email) {
    return res.status(400).json({ error: 'Google account has no email address.' });
  }
  const name = profile.name || profile.given_name || 'Google User';

  const users = loadUsers();
  let user = users.find((u) => u.email === email);

  if (!user) {
    user = {
      id: 'google_' + Date.now().toString(36),
      name: name,
      email: email,
      createdAt: new Date().toISOString(),
      phone: '', businessName: '', businessType: '', location: ''
    };
    users.push(user);
    saveUsers(users);
  } else if (!user.password && user.name !== name) {
    // Keep the display name fresh for Google-created accounts.
    user.name = name;
    saveUsers(users);
  }

  const logins = loadLogins();
  logins.push({
    email: user.email,
    timestamp: new Date().toISOString(),
    status: 'google_login',
    ip: req.ip || req.socket.remoteAddress
  });
  saveLogins(logins);

  const safeUser = { ...user };
  delete safeUser.password;
  res.json({ success: true, user: safeUser });
  sendLoginAlertEmail(user.email, req);
});
app.get('/api/admin/data', requireAdmin, (req, res) => {
  res.json({
    users: loadUsers(),
    logins: loadLogins(),
    reviews: loadReviews()
  });
});

// ─── API: Reviews CRUD ──────────────────────────────────────
app.get('/api/reviews', (req, res) => {
  res.json(loadReviews());
});

app.post('/api/reviews', (req, res) => {
  const { name, rating, text } = req.body;
  if (!name || !rating || !text) return res.status(400).json({ error: 'All fields required.' });

  const reviews = loadReviews();
  const review = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    name: name.trim(),
    rating: parseInt(rating),
    text: text.trim(),
    date: new Date().toISOString()
  };
  reviews.push(review);
  saveReviews(reviews);
  res.json({ success: true, review });
});

app.put('/api/reviews/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { name, rating, text } = req.body;
  const reviews = loadReviews();
  const idx = reviews.findIndex((r) => r.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Review not found.' });

  if (name !== undefined) reviews[idx].name = name.trim();
  if (rating !== undefined) reviews[idx].rating = parseInt(rating);
  if (text !== undefined) reviews[idx].text = text.trim();
  saveReviews(reviews);
  res.json({ success: true, review: reviews[idx] });
});

app.delete('/api/reviews/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  let reviews = loadReviews();
  const before = reviews.length;
  reviews = reviews.filter((r) => r.id !== id);
  if (reviews.length === before) return res.status(404).json({ error: 'Review not found.' });
  saveReviews(reviews);
  res.json({ success: true, message: 'Review deleted.' });
});

// ─── API: Delete Login Entry ─────────────────────────────────
app.delete('/api/logins/:index', requireAdmin, (req, res) => {
  const idx = parseInt(req.params.index, 10);
  const logins = loadLogins();
  if (idx < 0 || idx >= logins.length) return res.status(404).json({ error: 'Entry not found.' });
  logins.splice(idx, 1);
  saveLogins(logins);
  res.json({ success: true });
});

// ─── API: Clear All Login History ────────────────────────────
app.delete('/api/logins', requireAdmin, (req, res) => {
  saveLogins([]);
  res.json({ success: true, message: 'Login history cleared.' });
});

// ─── Start ────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 ValueGrid server running at http://localhost:${PORT}\n`);
});

