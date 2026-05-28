const { createServer } = require('node:http');
const { appendFile, mkdir, readFile, stat } = require('node:fs/promises');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const nodemailer = require('nodemailer');

const root = __dirname;
loadEnvFile(path.join(root, '.env'));

const dataDir = path.join(root, 'data');
const submissionsFile = path.join(dataDir, 'submissions.jsonl');
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3000);
const emailTo = process.env.CONTACT_EMAIL_TO || 'contact@qualitywellnesscare.com';
const emailFrom = process.env.CONTACT_EMAIL_FROM || process.env.SMTP_USER;

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

function loadEnvFile(filePath) {
  try {
    const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);

    lines.forEach((line) => {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('#')) {
        return;
      }

      const separatorIndex = trimmed.indexOf('=');

      if (separatorIndex === -1) {
        return;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, '');

      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    });
  } catch {
    // A .env file is optional; production hosts usually provide env vars directly.
  }
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;

      if (body.length > 64 * 1024) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });

    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function cleanText(value, maxLength) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hasEmailConfig() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && emailFrom && emailTo);
}

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

function formatSubmissionEmail(submission) {
  return [
    'New assisted care assessment request',
    '',
    `Name: ${submission.fullName}`,
    `Email: ${submission.email}`,
    `Phone: ${submission.phone}`,
    `Source: ${submission.source}`,
    `Submitted: ${submission.createdAt}`,
    '',
    'Message:',
    submission.message
  ].join('\n');
}

async function sendSubmissionEmail(submission) {
  if (!hasEmailConfig()) {
    console.warn('Email is not configured. Saved submission locally only.');
    return false;
  }

  const transporter = createTransport();

  await transporter.sendMail({
    to: emailTo,
    from: emailFrom,
    replyTo: submission.email,
    subject: `New assessment request from ${submission.fullName}`,
    text: formatSubmissionEmail(submission)
  });

  return true;
}

async function handleAssessment(req, res) {
  try {
    const body = await readRequestBody(req);
    const payload = JSON.parse(body || '{}');
    const submission = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      source: cleanText(payload.source, 80) || 'website',
      fullName: cleanText(payload.fullName, 120),
      email: cleanText(payload.email, 160).toLowerCase(),
      phone: cleanText(payload.phone, 40),
      message: cleanText(payload.message, 2000)
    };

    const missingFields = ['fullName', 'email', 'phone', 'message'].filter((field) => !submission[field]);

    if (missingFields.length > 0) {
      sendJson(res, 400, { error: 'missing_fields', fields: missingFields });
      return;
    }

    if (!isValidEmail(submission.email)) {
      sendJson(res, 400, { error: 'invalid_email' });
      return;
    }

    await mkdir(dataDir, { recursive: true });
    await appendFile(submissionsFile, `${JSON.stringify(submission)}\n`, 'utf8');
    const emailSent = await sendSubmissionEmail(submission);

    sendJson(res, 201, {
      ok: true,
      id: submission.id,
      emailSent,
      message: 'Thank you. Your request was received.'
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      sendJson(res, 400, { error: 'invalid_json' });
      return;
    }

    console.error(error);
    sendJson(res, 500, { error: 'server_error' });
  }
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);
  const requestedPath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.normalize(path.join(root, requestedPath));

  if (!filePath.startsWith(root) || filePath.includes(`${path.sep}data${path.sep}`)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  try {
    const fileStat = await stat(filePath);

    if (!fileStat.isFile()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    const content = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': contentTypes[extension] || 'application/octet-stream',
      'Cache-Control': extension === '.html' ? 'no-store' : 'public, max-age=3600'
    });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}

const server = createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/api/assessments') {
    await handleAssessment(req, res);
    return;
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    await serveStatic(req, res);
    return;
  }

  res.writeHead(405, { Allow: 'GET, HEAD, POST' });
  res.end('Method not allowed');
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Try PORT=3001 npm start.`);
    process.exit(1);
  }

  console.error(error);
  process.exit(1);
});

server.listen(port, host, () => {
  console.log(`Quality Wellness Care site running at http://${host}:${port}`);
});
