// Sends one test email per template using the same builders as server.js
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

const PORT = 3000;
const TO = 'manthan6446@gmail.com';
const LOGO_PATH = path.join(__dirname, 'logo-light.png');
const EMAIL_LOGO = { filename: 'logo-light.png', path: LOGO_PATH, cid: 'vg-logo' };

const read = f => fs.readFileSync(path.join(__dirname, f), 'utf-8');
const otp = () => String(crypto.randomInt(100000, 999999)).split('').join(' ');
const injectOpenLink = html => html.split('{{LINK}}').join(`http://localhost:${PORT}`);

const mails = [
  {
    name: '1. Verification Code',
    subject: 'Your ValueGrid Verification Code',
    html: injectOpenLink(read('valuegrid-mail-template.html').replace('{{OTP}}', otp())),
  },
  {
    name: '2. Password Reset',
    subject: 'Reset your ValueGrid password',
    html: read('valuegrid-password-reset-mail.html')
      .replace('{{OTP}}', otp())
      .split('{{RESET_LINK}}').join(`http://localhost:${PORT}/reset`),
  },
  {
    name: '3. Login Alert',
    subject: 'New login to your ValueGrid account',
    html: read('valuegrid-login-alert-mail.html')
      .replace('Chrome on Windows', 'Chrome on Windows')
      .replace('103.45.67.89', '127.0.0.1')
      .replace('July 10, 2025 &middot; 2:34 PM IST', new Date().toLocaleString('en-IN') + ' IST')
      .replace(/href="#"/g, `href="http://localhost:${PORT}"`),
  },
  {
    name: '4. Welcome / Thank You',
    subject: 'Thank you for signing in to ValueGrid',
    html: injectOpenLink(read('valuegrid-welcome-mail.html').replace('{{NAME}}', 'Manthan')),
  },
];

(async () => {
  await transporter.verify();
  console.log('SMTP connection verified OK');
  for (const m of mails) {
    try {
      const r = await transporter.sendMail({
        from: `"ValueGrid" <${process.env.SMTP_USER}>`,
        to: TO,
        subject: `[TEST] ${m.subject}`,
        text: m.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
        attachments: [EMAIL_LOGO],
        html: m.html,
      });
      console.log(`SENT  ${m.name} -> ${r.messageId}`);
      console.log(`      server response: ${r.response}`);
    } catch (e) {
      console.error(`ERROR ${m.name}: ${e.message}`);
    }
    await new Promise(res => setTimeout(res, 2000));
  }
})();
