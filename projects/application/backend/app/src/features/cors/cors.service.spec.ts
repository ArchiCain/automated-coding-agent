/**
 * Unit test for CorsService
 * Tests CORS configuration logic
 */

import { CorsService } from './cors.service';

describe('CorsService (Unit)', () => {
  let service: CorsService;

  beforeEach(() => {
    // Set valid CORS_ORIGINS for tests
    process.env.CORS_ORIGINS = 'http://localhost:3000,http://localhost:3001';
  });

  afterEach(() => {
    delete process.env.CORS_ORIGINS;
  });

  describe('initialization', () => {
    it('should initialize with valid CORS_ORIGINS', () => {
      // Act
      service = new CorsService();

      // Assert
      expect(service).toBeDefined();
      const config = service.getCorsConfig();
      expect(config).toBeDefined();
      expect(config.credentials).toBe(true);
    });

    it('should throw error for invalid CORS_ORIGINS format', () => {
      // Arrange
      console.log('→ Testing error state: Invalid CORS_ORIGINS format');
      process.env.CORS_ORIGINS = 'invalid-url-format';

      // Act & Assert
      expect(() => new CorsService()).toThrow('Invalid CORS_ORIGINS');
    });
  });

  describe('getCorsConfig', () => {
    beforeEach(() => {
      service = new CorsService();
    });

    it('should return CORS configuration', () => {
      // Act
      const config = service.getCorsConfig();

      // Assert
      expect(config).toBeDefined();
      expect(config.origin).toBeDefined();
      expect(config.credentials).toBe(true);
      expect(config.methods).toBeDefined();
    });
  });

  describe('isOriginAllowed', () => {
    beforeEach(() => {
      process.env.CORS_ORIGINS = 'http://localhost:3000,http://localhost:3001';
      service = new CorsService();
    });

    it('should return true for allowed origin', () => {
      // Act
      const allowed = service.isOriginAllowed('http://localhost:3000');

      // Assert
      expect(allowed).toBe(true);
    });

    it('should return false for disallowed origin', () => {
      // Act
      const allowed = service.isOriginAllowed('http://evil.com');

      // Assert
      expect(allowed).toBe(false);
    });
  });

  describe('getAllowedOrigins', () => {
    beforeEach(() => {
      process.env.CORS_ORIGINS = 'http://localhost:3000,http://localhost:3001';
      service = new CorsService();
    });

    it('should return array of allowed origins', () => {
      // Act
      const origins = service.getAllowedOrigins();

      // Assert
      expect(origins).toBeInstanceOf(Array);
      expect(origins.length).toBeGreaterThan(0);
      expect(origins).toContain('http://localhost:3000');
    });
  });

  describe('refreshConfig', () => {
    beforeEach(() => {
      process.env.CORS_ORIGINS = 'http://localhost:3000';
      service = new CorsService();
    });

    it('should reload configuration from environment', () => {
      // Arrange
      const originalOrigins = service.getAllowedOrigins();

      // Act - change env and refresh
      process.env.CORS_ORIGINS = 'http://localhost:4000';
      service.refreshConfig();

      // Assert
      const newOrigins = service.getAllowedOrigins();
      expect(newOrigins).not.toEqual(originalOrigins);
      expect(newOrigins).toContain('http://localhost:4000');
    });
  });
});
