/**
 * Unit test for MastraAgentsController
 * Tests controller logic in isolation
 */

import { MastraAgentsController } from './mastra-agents.controller';

describe('MastraAgentsController (Unit)', () => {
  let controller: MastraAgentsController;

  beforeEach(() => {
    controller = new MastraAgentsController();
  });

  describe('getStartupMessage', () => {
    it('should return startup message object', () => {
      // Act
      const result = controller.getStartupMessage();

      // Assert
      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
      expect(typeof result.text).toBe('string');
    });

    it('should return welcome message for Conversational AI', () => {
      // Act
      const result = controller.getStartupMessage();

      // Assert
      expect(result.text).toContain('Conversational AI');
      expect(result.text).toContain('help');
    });

    it('should return consistent message on multiple calls', () => {
      // Act
      const result1 = controller.getStartupMessage();
      const result2 = controller.getStartupMessage();

      // Assert
      expect(result1.text).toBe(result2.text);
    });
  });
});
