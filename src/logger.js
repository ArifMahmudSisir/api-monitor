const winston = require('winston');
const config = require('./config');

const line = winston.format.printf(
  ({ timestamp, level, message, stack }) => `${timestamp} ${level}: ${stack || message}`
);

module.exports = winston.createLogger({
  level: config.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    line
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.timestamp(), line),
    }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});
