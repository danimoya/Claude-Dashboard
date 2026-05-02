/**
 * Two-Factor Authentication Service
 *
 * TOTP implementation per RFC 6238. We deliberately do NOT pull in `otplib` /
 * `speakeasy` — the Node `crypto` module gives us everything needed and keeps
 * the dependency surface small. base32 is implemented inline (RFC 4648).
 *
 * 2FA in this app gates access to /settings, where API keys and other
 * sensitive credentials live. It is independent of login.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import bcrypt from 'bcrypt';
import { AppDataSource } from '../config/database.js';
import { User } from '../entities/User.entity.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

const ISSUER = 'Claude Dashboard';
const PERIOD = 30;
const DIGITS = 6;
const BACKUP_CODES = 8;
const STEP_TOLERANCE = 1; // ±30s

// ── base32 (RFC 4648, no padding) ─────────────────────────────
const B32_ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32_ALPHA[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32_ALPHA[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(s: string): Buffer {
  const cleaned = s.replace(/=+$/, '').toUpperCase().replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of cleaned) {
    const idx = B32_ALPHA.indexOf(ch);
    if (idx < 0) throw new Error(`Invalid base32 char: ${ch}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

// ── HOTP / TOTP ────────────────────────────────────────────────
function hotp(secret: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  // 64-bit big-endian counter
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter & 0xffffffff, 4);
  const hmac = createHmac('sha1', secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (code % 10 ** DIGITS).toString().padStart(DIGITS, '0');
}

function totp(secret: Buffer, when = Date.now()): string {
  return hotp(secret, Math.floor(when / 1000 / PERIOD));
}

function totpVerify(secret: Buffer, token: string, when = Date.now()): boolean {
  const cleaned = (token || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleaned)) return false;
  const counter = Math.floor(when / 1000 / PERIOD);
  for (let i = -STEP_TOLERANCE; i <= STEP_TOLERANCE; i++) {
    const expected = hotp(secret, counter + i);
    // Constant-time compare
    const a = Buffer.from(cleaned);
    const b = Buffer.from(expected);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

// ── Service ────────────────────────────────────────────────────
export class TwoFAService {
  private userRepository = AppDataSource.getRepository(User);

  /**
   * Begin enrollment: generate a fresh TOTP secret for the user (NOT yet
   * persisted as enabled). Returns the secret, otpauth:// URI, and a list of
   * one-time backup codes (plaintext, shown to user once).
   */
  async beginEnrollment(userId: string): Promise<{
    secret: string;
    otpauthUrl: string;
    backupCodes: string[];
  }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw AppError.notFound('User not found');

    const raw = randomBytes(20); // 160 bits
    const secret = base32Encode(raw);
    const backupCodes = Array.from({ length: BACKUP_CODES }, () =>
      randomBytes(5).toString('hex').toUpperCase().match(/.{1,4}/g)!.join('-')
    );

    const hashed = await Promise.all(backupCodes.map((c) => bcrypt.hash(c, 10)));

    // Persist secret + backup hashes, but leave `twofaEnabled` false until
    // the user verifies a code.
    await this.userRepository.update(
      { id: userId },
      {
        twofaSecret: secret,
        twofaBackupCodes: hashed,
        twofaEnabled: false,
      }
    );

    const label = encodeURIComponent(`${ISSUER}:${user.username}`);
    const params = new URLSearchParams({
      secret,
      issuer: ISSUER,
      algorithm: 'SHA1',
      digits: String(DIGITS),
      period: String(PERIOD),
    });
    const otpauthUrl = `otpauth://totp/${label}?${params.toString()}`;

    return { secret, otpauthUrl, backupCodes };
  }

  /**
   * Confirm enrollment by verifying a freshly-generated TOTP code.
   * Flips `twofaEnabled = true` on success.
   */
  async confirmEnrollment(userId: string, token: string): Promise<void> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.twofaSecret')
      .where('user.id = :id', { id: userId })
      .getOne();

    if (!user || !user.twofaSecret) {
      throw AppError.badRequest('No pending enrollment');
    }
    if (!totpVerify(base32Decode(user.twofaSecret), token)) {
      throw AppError.badRequest('Invalid 2FA code');
    }
    await this.userRepository.update({ id: userId }, { twofaEnabled: true });
    logger.info(`2FA enabled for user ${userId}`);
  }

  /**
   * Verify a TOTP code (or one-time backup code) for an already-enrolled user.
   * Backup codes are consumed on use.
   */
  async verify(userId: string, token: string): Promise<boolean> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.twofaSecret')
      .addSelect('user.twofaBackupCodes')
      .where('user.id = :id', { id: userId })
      .getOne();

    if (!user || !user.twofaEnabled || !user.twofaSecret) return false;

    const cleaned = (token || '').replace(/\s+/g, '');

    // 6-digit TOTP path
    if (/^\d{6}$/.test(cleaned)) {
      return totpVerify(base32Decode(user.twofaSecret), cleaned);
    }

    // Backup code path (XXXX-XXXX format, hex)
    const codes = user.twofaBackupCodes || [];
    for (let i = 0; i < codes.length; i++) {
      if (await bcrypt.compare(cleaned.toUpperCase(), codes[i])) {
        // Consume the code
        const remaining = codes.slice();
        remaining.splice(i, 1);
        await this.userRepository.update({ id: userId }, { twofaBackupCodes: remaining });
        return true;
      }
    }
    return false;
  }

  /**
   * Disable 2FA for a user. Requires a valid current TOTP code OR is invoked
   * by the admin reset script (which calls `forceDisable`).
   */
  async disable(userId: string, token: string): Promise<void> {
    const ok = await this.verify(userId, token);
    if (!ok) throw AppError.unauthorized('Invalid 2FA code');
    await this.forceDisable(userId);
  }

  async forceDisable(userId: string): Promise<void> {
    await this.userRepository.update(
      { id: userId },
      { twofaEnabled: false, twofaSecret: null as any, twofaBackupCodes: null as any }
    );
    logger.info(`2FA disabled for user ${userId}`);
  }

  async isEnabled(userId: string): Promise<boolean> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    return !!user?.twofaEnabled;
  }
}

export const twofaService = new TwoFAService();

// Export primitives for the admin script
export const _internal = { totp, totpVerify, base32Decode, base32Encode };
