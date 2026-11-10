import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { z } from 'zod';
import { nextId } from './db.js';
import { cleanText, HttpError, requireThat as check } from './domain.js';

const scrypt = promisify(scryptCb);
const TOKEN_DAYS = 14;

export const signupBody = z.object({
  name: cleanText(70, 2),
  email: z.string().trim().toLowerCase().pipe(z.email().max(120)),
  phone: z.string().trim().regex(/^(\+92|0)?3\d{9}$|^$/, 'Enter a Pakistani mobile number like 03XXXXXXXXX.').optional().default(''),
  password: z.string().min(8, 'Password must be at least 8 characters.').max(128),
  role: z.enum(['customer', 'worker'])
});
export const signinBody = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(120)),
  password: z.string().min(1).max(128)
});

async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize('NFKC'), salt, 64);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}
async function verifyPassword(password, stored) {
  const [kind, salt, hash] = String(stored || '').split('$');
  if (kind !== 'scrypt' || !salt || !hash) return false;
  const key = await scrypt(password.normalize('NFKC'), Buffer.from(salt, 'hex'), 64);
  const expected = Buffer.from(hash, 'hex');
  return key.length === expected.length && timingSafeEqual(key, expected);
}

const b64 = value => Buffer.from(value).toString('base64url');
function sign(payload, secret) {
  const body = b64(JSON.stringify(payload));
  return body + '.' + createHmac('sha256', secret).update(body).digest('base64url');
}
function unsign(token, secret, instant) {
  const [body, mac] = String(token || '').split('.');
  if (!body || !mac || String(token).split('.').length!==2) return null;
  const expected = createHmac('sha256', secret).update(body).digest();
  const given = Buffer.from(mac, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    return payload.exp > instant ? payload : null;
  } catch { return null; }
}

const publicUser = ({ _id, name, role, email, phone }) => ({ id: _id, name, role, email, phone: phone || '' });

export function authService(store, now = () => new Date()) {
  const { db } = store;
  const users = db.collection('users');
  const attempts = new Map(); // simple in-memory brute-force throttle: key -> {count, until}
  let secretPromise;
  // SESSION_SECRET wins; otherwise a random secret is generated once and kept in MongoDB so
  // sessions survive restarts and work across several server instances.
  function secret() {
    secretPromise ??= (async () => {
      if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
      const meta = db.collection('meta');
      await meta.updateOne({ _id: 'session-secret' }, { $setOnInsert: { value: randomBytes(32).toString('hex') } }, { upsert: true });
      return (await meta.findOne({ _id: 'session-secret' })).value;
    })();
    return secretPromise;
  }
  const issue = async user => sign({ uid: user._id, exp: now().getTime() + TOKEN_DAYS * 86400000 }, await secret());

  function throttle(key) {
    const row = attempts.get(key);
    check(!(row && row.count >= 8 && row.until > Date.now()), 429, 'Too many attempts. Please wait a few minutes and try again.');
  }
  function miss(key) {
    const row = attempts.get(key);
    attempts.set(key, { count: (row && row.until > Date.now() ? row.count : 0) + 1, until: Date.now() + 10 * 60000 });
  }

  async function signup(data) {
    check(!(await users.findOne({email:data.email},{projection:{_id:1}})),409,'An account with this email already exists. Please sign in.');
    // Seeded users already own ids 1..12, so keep the users counter ahead of them.
    const top = await users.find({}, { projection: { _id: 1 } }).sort({ _id: -1 }).limit(1).next();
    await db.collection('counters').updateOne({ _id: 'users' }, { $max: { value: top?._id ?? 0 } }, { upsert: true });
    const row = {
      _id: await nextId(db, 'users'), name: data.name, role: data.role, email: data.email, phone: data.phone,
      passwordHash: await hashPassword(data.password), createdAt: now().toISOString()
    };
    try { await users.insertOne(row); }
    catch (error) {
      if (error.code === 11000) throw new HttpError(409, 'An account with this email already exists. Please sign in.');
      throw error;
    }
    return { token: await issue(row), user: publicUser(row) };
  }

  async function signin(data, ip = '') {
    const key = ip + '|' + data.email;
    throttle(key);
    const row = await users.findOne({ email: data.email });
    // Always run a hash comparison so response time doesn't reveal whether the email exists.
    const ok = await verifyPassword(data.password, row?.passwordHash ?? 'scrypt$00$00');
    if (!row || !ok) { miss(key); throw new HttpError(401, 'Incorrect email or password.'); }
    attempts.delete(key);
    return { token: await issue(row), user: publicUser(row) };
  }

  // Returns the user for a Bearer token, or null when the token is missing/invalid.
  async function fromToken(header) {
    const token = /^Bearer (.+)$/.exec(header || '')?.[1];
    if (!token) return null;
    const payload = unsign(token, await secret(), now().getTime());
    if (!payload) return null;
    return await users.findOne({ _id: payload.uid, email: { $exists: true } }, { projection: { name: 1, role: 1, email: 1, phone: 1 } });
  }

  return { signup, signin, fromToken, publicUser };
}
