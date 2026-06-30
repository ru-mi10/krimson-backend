// models/Theme.js
// One Theme per System.
// A Theme change should affect the entire System — never individual pages.
// Theme tokens are design decisions, not CSS properties.

import mongoose from 'mongoose'

const themeSchema = new mongoose.Schema(
  {
    systemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'System',
      required: true,
      unique: true, // one theme per system
    },
    name: {
      type: String,
      default: 'Default',
      trim: true,
    },

    // Design tokens — these drive the entire System's visual identity
    tokens: {
      // Color
      appearance: {
        type: String,
        enum: ['dark', 'light'],
        default: 'dark',
      },
      accentColor: {
        type: String,
        default: '#DC2626', // Krimson red — can be overridden
      },
      backgroundColor: {
        type: String,
        default: '#09090B',
      },
      surfaceColor: {
        type: String,
        default: '#111113',
      },
      borderColor: {
        type: String,
        default: '#27272A',
      },
      primaryTextColor: {
        type: String,
        default: '#FAFAFA',
      },
      secondaryTextColor: {
        type: String,
        default: '#A1A1AA',
      },

      // Typography
      fontFamily: {
        type: String,
        enum: ['Inter', 'Geist', 'Space Grotesk', 'Outfit', 'Plus Jakarta Sans'],
        default: 'Inter',
      },
      fontSize: {
        type: String,
        enum: ['compact', 'default', 'comfortable'],
        default: 'default',
      },

      // Shape
      borderRadius: {
        type: String,
        enum: ['none', 'subtle', 'default', 'rounded'],
        default: 'default',
      },

      // Motion
      motion: {
        type: String,
        enum: ['none', 'subtle', 'default'],
        default: 'subtle',
      },
    },
  },
  {
    timestamps: true,
  }
)

export default mongoose.model('Theme', themeSchema)
