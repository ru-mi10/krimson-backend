// models/System.js
// THE primary entity in Krimson.
// Everything else (Pages, Themes, Versions, Forks) belongs to a System.

import mongoose from 'mongoose'
import { nanoid } from 'nanoid'

const systemSchema = new mongoose.Schema(
  {
    // Identity
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: [true, 'System name is required'],
      trim: true,
      maxlength: [100, 'System name cannot exceed 100 characters'],
    },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },

    // Discovery
    tags: [
      {
        type: String,
        lowercase: true,
        trim: true,
      },
    ],
    category: {
      type: String,
      enum: [
        'crm',
        'analytics',
        'ecommerce',
        'saas',
        'portfolio',
        'fintech',
        'healthcare',
        'education',
        'productivity',
        'other',
      ],
      default: 'other',
    },

    // Lifecycle
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
    },
    visibility: {
      type: String,
      enum: ['private', 'unlisted', 'public'],
      default: 'private',
    },

    // Fork tracking
    forkedFrom: {
      systemId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'System',
        default: null,
      },
      systemName: {
        type: String,
        default: null,
      },
      ownerUsername: {
        type: String,
        default: null,
      },
    },

    // Stats (lightweight counters — no arrays of user IDs)
    stats: {
      forkCount: { type: Number, default: 0 },
      viewCount: { type: Number, default: 0 },
    },

    // Current published version snapshot reference
    publishedVersionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Version',
      default: null,
    },
  },
  {
    timestamps: true,
  }
)

// Compound index: slug must be unique per workspace
systemSchema.index({ workspaceId: 1, slug: 1 }, { unique: true })
systemSchema.index({ ownerId: 1, status: 1 })
systemSchema.index({ status: 1, visibility: 1, createdAt: -1 })
systemSchema.index({ tags: 1 })
systemSchema.index({ category: 1, status: 1 })

export default mongoose.model('System', systemSchema)