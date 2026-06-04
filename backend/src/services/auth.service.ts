/**
 * Authentication Service
 * Handles user registration, login, and token management
 */

import jwt from 'jsonwebtoken';
import { AppDataSource } from '../config/database.js';
import { User } from '../entities/User.entity.js';
import { AppError } from '../utils/AppError.js';
import { config } from '../config/env.js';
import { TokenBlacklistService } from './tokenBlacklist.service.js';
import type { LoginDto } from '@shared/schemas';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: Omit<User, 'passwordHash' | 'password'>;
  tokens: AuthTokens;
}

export class AuthService {
  private userRepository = AppDataSource.getRepository(User);
  private tokenBlacklist = new TokenBlacklistService();

  /**
   * Register a new user
   */
  async register(username: string, password: string, email?: string): Promise<AuthResponse> {
    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: [{ username }, ...(email ? [{ email }] : [])],
    });

    if (existingUser) {
      throw AppError.conflict('User already exists');
    }

    // Create new user
    const user = this.userRepository.create({
      username,
      email,
    });
    user.password = password; // Set virtual field for @BeforeInsert hash hook

    await this.userRepository.save(user);

    // Generate tokens
    const tokens = this.generateTokens(user.id);

    return {
      user: user.toJSON() as any,
      tokens,
    };
  }

  /**
   * Login user
   */
  async login(credentials: LoginDto): Promise<AuthResponse> {
    // Find user with password hash
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.username = :username', { username: credentials.username })
      .getOne();

    if (!user) {
      throw AppError.unauthorized('Invalid credentials');
    }

    // Check if user is active
    if (!user.isActive) {
      throw AppError.forbidden('Account is deactivated');
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(credentials.password);
    if (!isPasswordValid) {
      throw AppError.unauthorized('Invalid credentials');
    }

    // Generate tokens
    const tokens = this.generateTokens(user.id);

    return {
      user: user.toJSON() as any,
      tokens,
    };
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
    try {
      // Verify refresh token
      const payload = jwt.verify(refreshToken, config.jwt.refreshSecret, {
        algorithms: ['HS256'],
      }) as {
        userId: string;
        exp?: number;
      };

      // Check if token is blacklisted. With rotation (below) a refresh token is
      // single-use: presenting an already-rotated (blacklisted) token is treated
      // as reuse and rejected here.
      if (await this.tokenBlacklist.isBlacklisted(refreshToken)) {
        throw AppError.unauthorized('Token has been revoked');
      }

      // Find user
      const user = await this.userRepository.findOne({ where: { id: payload.userId } });
      if (!user || !user.isActive) {
        throw AppError.unauthorized('Invalid refresh token');
      }

      // Rotate: invalidate the just-used refresh token so it cannot be replayed.
      // Blacklist it for its remaining lifetime so a leaked/stolen copy used
      // after the legitimate client has rotated is rejected as reuse.
      await this.blacklistToken(refreshToken);

      // Generate new tokens
      return this.generateTokens(user.id);
    } catch (error) {
      // Preserve explicit revocation/auth errors; otherwise treat as invalid.
      if (error instanceof AppError) {
        throw error;
      }
      throw AppError.unauthorized('Invalid refresh token');
    }
  }

  /**
   * Get current user by ID
   */
  async getCurrentUser(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw AppError.notFound('User not found');
    }

    return user;
  }

  /**
   * Blacklist a token (for logout)
   */
  async blacklistToken(token: string): Promise<void> {
    try {
      // Decode token to get expiry
      const decoded = jwt.decode(token) as { exp?: number };
      if (!decoded || !decoded.exp) {
        return;
      }

      // Calculate remaining TTL
      const now = Math.floor(Date.now() / 1000);
      const ttl = decoded.exp - now;

      if (ttl > 0) {
        await this.tokenBlacklist.addToken(token, ttl);
      }
    } catch (error) {
      // Ignore errors - token will expire naturally
    }
  }

  /**
   * Generate JWT tokens
   */
  private generateTokens(userId: string): AuthTokens {
    const accessToken = jwt.sign({ userId }, config.jwt.secret, {
      algorithm: 'HS256',
      expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
    });

    const refreshToken = jwt.sign({ userId }, config.jwt.refreshSecret, {
      algorithm: 'HS256',
      expiresIn: config.jwt.refreshExpiresIn as jwt.SignOptions['expiresIn'],
    });

    return { accessToken, refreshToken };
  }

  /**
   * Verify access token
   */
  verifyAccessToken(token: string): { userId: string } {
    try {
      return jwt.verify(token, config.jwt.secret, {
        algorithms: ['HS256'],
      }) as { userId: string };
    } catch (error) {
      throw AppError.unauthorized('Invalid or expired token');
    }
  }
}
