// models/Page.js
// Pages are the structural building blocks of a System.
// They represent product surfaces: Dashboard, Analytics, Billing, etc.
// Pages are NOT published independently — they belong to a System.

import mongoose from 'mongoose'

const pageSchema = new mongoose.Schema(
  {
    systemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'System',
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Page name is required'],
      trim: true,
      maxlength: [100, 'Page name cannot exceed 100 characters'],
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
      maxlength: [300, 'Description cannot exceed 300 characters'],
    },
    // Controls sidebar/list ordering
    order: {
      type: Number,
      default: 0,
    },
    // For future nested pages (Dashboard > Revenue, Customers, etc.)
    parentPageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Page',
      default: null,
    },
    // Metadata for AI-assisted generation and export
    metadata: {
      icon: { type: String, default: '' },
      componentHints: [{ type: String }],
    },
  },
  {
    timestamps: true,
  }
)

// slug unique within a system
pageSchema.index({ systemId: 1, slug: 1 }, { unique: true })
pageSchema.index({ systemId: 1, order: 1 })

export default mongoose.model('Page', pageSchema)