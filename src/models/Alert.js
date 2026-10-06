const mongoose = require('mongoose');

const issueSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true },
    detail: { type: String, required: true },
  },
  { _id: false }
);

const alertSchema = new mongoose.Schema(
  {
    apiName: { type: String, required: true, index: true },
    fingerprint: { type: String, required: true },
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true },
    severityRank: { type: Number, required: true },
    issues: { type: [issueSchema], required: true },
    metrics: {
      responseTimeMs: mongoose.Schema.Types.Mixed,
      statusCode: mongoose.Schema.Types.Mixed,
      recordsReturned: mongoose.Schema.Types.Mixed,
    },
    message: { type: String, required: true },
    messageSource: { type: String, enum: ['ai', 'fallback'], required: true },
    status: { type: String, enum: ['active', 'resolved'], default: 'active' },
    occurrences: { type: Number, default: 1 },
    lastSeenAt: { type: Date, default: Date.now },
    resolvedAt: Date,
  },
  { timestamps: true }
);

alertSchema.index({ status: 1, severityRank: -1, lastSeenAt: -1 });
alertSchema.index({ fingerprint: 1, status: 1 });

module.exports = mongoose.model('Alert', alertSchema);
