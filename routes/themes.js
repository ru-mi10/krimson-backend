// routes/themes.js
import express from 'express'
import { body, validationResult } from 'express-validator'
import System from '../models/System.js'
import Theme from '../models/Theme.js'
import Activity, { ActivityType } from '../models/Activity.js'
import { protect, optionalAuth } from '../middleware/auth.js'
import { successResponse, errorResponse } from '../utils/helpers.js'

const router = express.Router()

// ── GET /api/systems/:slug/theme — Get System theme ───────────────────────
router.get('/:slug/theme', optionalAuth, async (req, res, next) => {
  try {
    const system = await System.findOne({ slug: req.params.slug })
    if (!system) return errorResponse(res, 'System not found', 404)

    const isOwner = req.user && system.ownerId.toString() === req.user._id.toString()
    if (system.visibility === 'private' && !isOwner) {
      return errorResponse(res, 'System not found', 404)
    }

    const theme = await Theme.findOne({ systemId: system._id })
    if (!theme) return errorResponse(res, 'Theme not found', 404)

    successResponse(res, { theme })
  } catch (error) {
    next(error)
  }
})

// ── PUT /api/systems/:slug/theme — Update System theme ────────────────────
router.put(
  '/:slug/theme',
  protect,
  [
    body('tokens.appearance').optional().isIn(['dark', 'light']),
    body('tokens.accentColor').optional().matches(/^#([0-9A-F]{3}){1,2}$/i).withMessage('Invalid hex color'),
    body('tokens.backgroundColor').optional().matches(/^#([0-9A-F]{3}){1,2}$/i),
    body('tokens.surfaceColor').optional().matches(/^#([0-9A-F]{3}){1,2}$/i),
    body('tokens.borderColor').optional().matches(/^#([0-9A-F]{3}){1,2}$/i),
    body('tokens.primaryTextColor').optional().matches(/^#([0-9A-F]{3}){1,2}$/i),
    body('tokens.secondaryTextColor').optional().matches(/^#([0-9A-F]{3}){1,2}$/i),
    body('tokens.fontFamily').optional().isIn(['Inter', 'Geist', 'Space Grotesk', 'Outfit', 'Plus Jakarta Sans']),
    body('tokens.fontSize').optional().isIn(['compact', 'default', 'comfortable']),
    body('tokens.borderRadius').optional().isIn(['none', 'subtle', 'default', 'rounded']),
    body('tokens.motion').optional().isIn(['none', 'subtle', 'default']),
    body('name').optional().isString().isLength({ max: 100 }),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return errorResponse(res, errors.array()[0].msg)

      const system = await System.findOne({ slug: req.params.slug, ownerId: req.user._id })
      if (!system) return errorResponse(res, 'System not found', 404)

      const theme = await Theme.findOne({ systemId: system._id })
      if (!theme) return errorResponse(res, 'Theme not found', 404)

      // Merge incoming token updates — only update what's provided
      if (req.body.tokens) {
        Object.assign(theme.tokens, req.body.tokens)
        theme.markModified('tokens')
      }
      if (req.body.name) theme.name = req.body.name

      await theme.save()

      await Activity.create({
        systemId: system._id,
        actorId: req.user._id,
        type: ActivityType.THEME_UPDATED,
        metadata: { themeName: theme.name },
      })

      successResponse(res, { theme })
    } catch (error) {
      next(error)
    }
  }
)

export default router