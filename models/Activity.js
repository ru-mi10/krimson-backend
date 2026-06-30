// models/Activity.js
// Activity records the meaningful evolution history of a System.
// This becomes visible in the System Explorer's Activity section.
// Every important action should create an Activity entry.

import mongoose from 'mongoose'

// All possible activity event types
export const ActivityType = {
  // System lifecycle
  SYSTEM_CREATED: 'system_created',
  SYSTEM_UPDATED: 'system_updated',
  SYSTEM_PUBLISHED: 'system_published',
  SYSTEM_ARCHIVED: 'system_archived',

  // Pages
  PAGE_CREATED: 'page_created',
  PAGE_UPDATED: 'page_updated',
  PAGE_DELETED: 'page_deleted',
  PAGE_REORDERED: 'page_reordered',

  // Theme
  THEME_UPDATED: 'theme_updated',

  // Versions
  VERSION_CREATED: 'version_created',

  // Forks
  SYSTEM_FORKED: 'system_forked',       // This system was forked by someone
  FORKED_FROM: 'forked_from',           // This system was created as a fork
}

const activitySchema = new mongoose.Schema(
  {
    systemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'System',
      required: true,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(ActivityType),
      required: true,
    },
    // Flexible metadata — varies by activity type
    // Examples:
    //   PAGE_CREATED: { pageName: 'Dashboard' }
    //   VERSION_CREATED: { versionName: 'v1.0', versionId: '...' }
    //   SYSTEM_FORKED: { forkedByUsername: 'builder_b', newSystemName: 'Healthcare CRM' }
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
)

activitySchema.index({ systemId: 1, createdAt: -1 })

export default mongoose.model('Activity', activitySchema)