const winston = require('winston');
const config = require('../config');

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  defaultMeta: { 
    service: 'pathfinder-api',
    environment: config.environment 
  },
  transports: [
    new winston.transports.Console({
      format: consoleFormat
    })
  ]
});

// Add file transport in production
if (config.environment === 'production' && config.logging.logFile) {
  logger.add(new winston.transports.File({
    filename: config.logging.logFile,
    maxsize: 10485760, // 10MB
    maxFiles: 5,
    tailable: true
  }));
}

// Create child loggers for specific modules
logger.child = function(meta) {
  return winston.createLogger({
    level: config.logging.level,
    format: logFormat,
    defaultMeta: { 
      ...this.defaultMeta,
      ...meta
    },
    transports: this.transports
  });
};

module.exports = logger;