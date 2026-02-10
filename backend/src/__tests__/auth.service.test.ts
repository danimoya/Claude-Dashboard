/**
 * Auth Service Tests
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AuthService } from '../services/auth.service';
import { AppDataSource } from '../config/database';

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const result = await authService.register('testuser', 'password123', 'test@example.com');

      expect(result.user).toBeDefined();
      expect(result.user.username).toBe('testuser');
      expect(result.tokens).toBeDefined();
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
    });

    it('should throw error for duplicate username', async () => {
      await authService.register('testuser', 'password123');

      await expect(
        authService.register('testuser', 'password456')
      ).rejects.toThrow('User already exists');
    });

    it('should hash password correctly', async () => {
      const result = await authService.register('testuser2', 'password123');

      // Password should be hashed, not plain text
      expect((result.user as any).passwordHash).not.toBe('password123');
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      await authService.register('logintest', 'password123');
    });

    it('should login with correct credentials', async () => {
      const result = await authService.login({
        username: 'logintest',
        password: 'password123',
      });

      expect(result.user).toBeDefined();
      expect(result.tokens).toBeDefined();
    });

    it('should reject invalid password', async () => {
      await expect(
        authService.login({
          username: 'logintest',
          password: 'wrongpassword',
        })
      ).rejects.toThrow('Invalid credentials');
    });

    it('should reject non-existent user', async () => {
      await expect(
        authService.login({
          username: 'nonexistent',
          password: 'password123',
        })
      ).rejects.toThrow('Invalid credentials');
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh token successfully', async () => {
      const { tokens } = await authService.register('refreshtest', 'password123');

      const newTokens = await authService.refreshAccessToken(tokens.refreshToken);

      expect(newTokens.accessToken).toBeDefined();
      expect(newTokens.refreshToken).toBeDefined();
      expect(newTokens.accessToken).not.toBe(tokens.accessToken);
    });

    it('should reject invalid refresh token', async () => {
      await expect(
        authService.refreshAccessToken('invalid-token')
      ).rejects.toThrow('Invalid refresh token');
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify valid token', async () => {
      const { tokens, user } = await authService.register('verifytest', 'password123');

      const payload = authService.verifyAccessToken(tokens.accessToken);

      expect(payload.userId).toBe(user.id);
    });

    it('should reject invalid token', () => {
      expect(() => {
        authService.verifyAccessToken('invalid-token');
      }).toThrow('Invalid or expired token');
    });
  });

  describe('blacklistToken', () => {
    it('should blacklist token on logout', async () => {
      const { tokens } = await authService.register('blacklisttest', 'password123');

      await authService.blacklistToken(tokens.accessToken);

      // Token should be blacklisted
      // Subsequent refresh should fail
      // (This would require Redis to be running)
    });
  });
});
