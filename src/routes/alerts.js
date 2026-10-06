const express = require('express');
const mongoose = require('mongoose');
const Alert = require('../models/Alert');
const { AppError, wrap } = require('../middleware/errors');

const router = express.Router();
const SEVERITIES = ['low', 'medium', 'high', 'critical'];

// GET /alerts?status=active|resolved|all&severity=&apiName=&page=&limit=
router.get('/', wrap(async (req, res) => {
  const { status = 'active', severity, apiName } = req.query;
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);

  const filter = {};
  if (status !== 'all') {
    if (!['active', 'resolved'].includes(status)) throw new AppError(400, 'status must be active, resolved or all');
    filter.status = status;
  }
  if (severity) {
    if (!SEVERITIES.includes(severity)) throw new AppError(400, `severity must be one of ${SEVERITIES.join(', ')}`);
    filter.severity = severity;
  }
  if (apiName) filter.apiName = String(apiName);

  const [alerts, total] = await Promise.all([
    Alert.find(filter).sort({ severityRank: -1, lastSeenAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Alert.countDocuments(filter),
  ]);
  res.json({ total, page, limit, count: alerts.length, alerts });
}));

// GET /alerts/stats : active alerts per severity
router.get('/stats', wrap(async (req, res) => {
  const rows = await Alert.aggregate([{ $match: { status: 'active' } }, { $group: { _id: '$severity', n: { $sum: 1 } } }]);
  const stats = { critical: 0, high: 0, medium: 0, low: 0, total: 0 };
  rows.forEach((r) => { stats[r._id] = r.n; stats.total += r.n; });
  res.json(stats);
}));

router.patch('/:id/resolve', wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new AppError(400, 'Invalid alert id');
  const alert = await Alert.findByIdAndUpdate(
    req.params.id,
    { status: 'resolved', resolvedAt: new Date() },
    { new: true }
  ).lean();
  if (!alert) throw new AppError(404, 'Alert not found');
  res.json(alert);
}));

module.exports = router;
