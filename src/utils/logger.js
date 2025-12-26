/**
 * Toggleable Logger Utility
 * Logs are enabled in development, disabled in production
 * 
 * Usage:
 * import logger from '../utils/logger.js';
 * logger.log('message');        // General logs
 * logger.debug('message');      // Debug info
 * logger.warn('message');       // Warnings
 * logger.error('message');      // Always logs (even in production)
 */

const isProduction = process.env.NODE_ENV === 'production';

const logger = {
  /**
   * General log - disabled in production
   */
  log: (...args) => {
    if (!isProduction) {
      console.log('[LOG]', ...args);
    }
  },

  /**
   * Debug log - disabled in production
   */
  debug: (...args) => {
    if (!isProduction) {
      console.log('[DEBUG]', ...args);
    }
  },

  /**
   * Warning log - disabled in production
   */
  warn: (...args) => {
    if (!isProduction) {
      console.warn('[WARN]', ...args);
    }
  },

  /**
   * Error log - ALWAYS enabled (even in production)
   * But sanitizes sensitive data
   */
  error: (...args) => {
    // Sanitize potential sensitive data
    const sanitized = args.map(arg => {
      if (typeof arg === 'string') {
        // Mask email addresses
        arg = arg.replace(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi, '[EMAIL]');
        // Mask tokens/passwords if accidentally logged
        arg = arg.replace(/(Bearer\s+)[^\s]+/gi, '$1[TOKEN]');
        arg = arg.replace(/(password['":\s]*)[^\s,}'"]+/gi, '$1[REDACTED]');
      }
      return arg;
    });
    console.error('[ERROR]', ...sanitized);
  },

  /**
   * Info log for important events - only in production
   * Use sparingly for critical events like server start
   */
  info: (...args) => {
    console.log('[INFO]', ...args);
  }
};

export default logger;
