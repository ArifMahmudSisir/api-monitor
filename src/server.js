const mongoose = require('mongoose');
const app = require('./app');
const config = require('./config');
const logger = require('./logger');

async function main() {
  await mongoose.connect(config.mongoUri);
  logger.info('MongoDB connected');
  const server = app.listen(config.port, () => logger.info(`Server running on http://localhost:${config.port}`));

  const shutdown = async (sig) => {
    logger.info(`${sig} received, shutting down`);
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  };
  ['SIGINT', 'SIGTERM'].forEach((s) => process.on(s, () => shutdown(s)));
}

process.on('unhandledRejection', (e) => logger.error(e));
main().catch((e) => {
  logger.error(e);
  process.exit(1);
});
