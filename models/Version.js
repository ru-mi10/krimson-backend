// models/Version.js
// A Version is a frozen snapshot of a System at a point in time.
// Versions enable evolution tracking and are one of Krimson's core differentiators.
// The snapshot captures the System structure + pages + theme tokens at creation time.

import mongoose from 'mongoose'

const versionSchema = new mongoose.Schema(
  {
    systemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'System',
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Human-readable version name
    name: {
      type: String,
      required: [true, 'Version name is required'],
      trim: true,
      maxlength: [100, 'Version name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      default: '',
      maxlength: [500, 'Version description cannot exceed 500 characters'],
    },

    // Snapshot — what the System looked like when this version was created
    // Stored as plain objects so versions remain immutable even if the live data changes
    snapshot: {
      systemName: { type: String, required: true },
      systemDescription: { type: String, default: '' },
      pages: [
        {
          name: String,
          slug: String,
          description: String,
          order: Number,
          icon: String,
        },
      ],
      themeTokens: { type: mongoose.Schema.Types.Mixed, default: {} },
    },

    // For future branching support
    parentVersionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Version',
      default: null,
    },
  },
  {
    timestamps: true,
  }
)

versionSchema.index({ systemId: 1, createdAt: -1 })

export default mongoose.model('Version', versionSchema)