const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const config = require('../config');
const { AppError, wrap } = require('../middleware/errors');
const { processBatch } = require('../services/monitorService');

const router = express.Router();

function extractEntries(body) {
  const entries = Array.isArray(body) ? body : Array.isArray(body?.apis) ? body.apis : body && typeof body === 'object' ? [body] : null;
  if (!entries || !entries.length) throw new AppError(400, 'Body must be a non-empty JSON array of API responses');
  if (entries.length > config.maxBatchSize) throw new AppError(413, `Batch too large (max ${config.maxBatchSize})`);
  return entries;
}

const wantsEmail = (req) => req.query.email === 'true';
const getRecipient = (req) => req.query.recipient;

router.post('/', wrap(async (req, res) => {
  res.status(201).json(await processBatch(extractEntries(req.body), { sendEmail: wantsEmail(req), recipient: getRecipient(req) }));
}));

router.post('/sample', wrap(async (req, res) => {
  const raw = await fs.readFile(path.join(__dirname, '..', '..', 'data', 'sample.json'), 'utf8');
  res.status(201).json(await processBatch(extractEntries(JSON.parse(raw)), { sendEmail: wantsEmail(req), recipient: getRecipient(req) }));
}));

module.exports = router;
