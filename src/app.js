const express = require('express');
const path = require('path');
const logger = require('./logger');
const { notFound, errorHandler } = require('./middleware/errors');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`));
  next();
});
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));
app.use('/monitor', require('./routes/monitor'));
app.use('/alerts', require('./routes/alerts'));
app.use(notFound);
app.use(errorHandler);

module.exports = app;
