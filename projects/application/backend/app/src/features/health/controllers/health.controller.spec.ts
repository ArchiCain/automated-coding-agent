/**
 * Unit test for HealthController
 * Tests controller logic in isolation (no HTTP, no dependencies)
 */

import { HealthController } from './health.controller';

describe('HealthController (Unit)', () => {
  let controller: HealthController;

  beforeEach(() => {
    controller = new HealthController();
  });

  describe('check', () => {
    it('should return health status object', () => {
      // Act
      const result = controller.check();

      // Assert
      expect(result).toBeDefined();
      expect(result.status).toBe('ok');
      expect(result.service).toBe('backend');
      expect(result.timestamp).toBeDefined();
    });

    it('should return valid ISO timestamp', () => {
      // Act
      const result = controller.check();

      // Assert
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      const date = new Date(result.timestamp);
      expect(date).toBeInstanceOf(Date);
      expect(date.toString()).not.toBe('Invalid Date');
    });

    it('should return current timestamp each time it is called', () => {
      // Act
      const result1 = controller.check();
      const result2 = controller.check();

      // Assert
      const time1 = new Date(result1.timestamp).getTime();
      const time2 = new Date(result2.timestamp).getTime();
      expect(time2).toBeGreaterThanOrEqual(time1);
    });
  });
});
