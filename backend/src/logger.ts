import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOG_DIR = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    new winston.transports.File({ filename: path.join(LOG_DIR, 'error.log'), level: 'error', maxsize: 5242880, maxFiles: 10 }),
    new winston.transports.File({ filename: path.join(LOG_DIR, 'combined.log'), maxsize: 5242880, maxFiles: 20 }),
    new winston.transports.File({ filename: path.join(LOG_DIR, 'requests.log'), level: 'http', maxsize: 5242880, maxFiles: 10 }),
    new winston.transports.File({ filename: path.join(LOG_DIR, 'security.log'), level: 'warn', maxsize: 5242880, maxFiles: 10 })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(winston.format.colorize(), winston.format.simple())
  }));
}

export function logSecurity(event: string, details: any): void {
  logger.warn('[SECURITY] ' + event, { security: true, ...details });
}

export function logAction(userId: number | string, action: string, details: any): void {
  logger.info('[ACTION] User ' + userId + ' ' + action, { action: true, userId, ...details });
}

export function logError(context: string, error: any): void {
  logger.error('[' + context + '] ' + (error?.message || error), { context, stack: error?.stack });
}