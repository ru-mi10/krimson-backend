// routes/versions.js
import express from 'express'
import { body, validationResult } from 'express-validator'
import System from '../models/System.js'
import Page from '../models/Page.js'
import Theme from '../models/Theme.js'
import Version from '../models/Version.js'
import Activity, { ActivityType } from '../models/Activity.js'
import { protect, optionalAuth } from '../middleware/auth.js'
import { successResponse, errorResponse } from '../utils/helpers.js'

const router = express.Router()

// ── POST /api/systems/:slug/versions — Create a Version (snapshot) ────────
router.post(
  '/:slug/versions',
  protect,
  [
    body('name').trim().notEmpty().withMessage('Version name is required').isLength({ max: 100 }),
    body('description').optional().isLength({ max: 500 }),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return errorResponse(res, errors.array()[0].msg)

      const system = await System.findOne({ slug: req.params.slug, ownerId: req.user._id })
      if (!system) return errorResponse(res, 'System not found', 404)

      const { name, description = '' } = req.body

      // Capture the current state as an immutable snapshot
      const [pages, theme] = await Promise.all([
        Page.find({ systemId: system._id }).sort({ order: 1 }).lean(),
        Theme.findOne({ systemId: system._id }).lean(),
      ])

      if (pages.length === 0) {
        return errorResponse(res, 'Add at least one page before creating a version')
      }

      // Find the most recent version to set as parent
      const lastVersion = await Version.findOne({ systemId: system._id })
        .sort({ createdAt: -1 })
        .select('_id')

      const version = await Version.create({
        systemId: system._id,
        createdBy: req.user._id,
        name,
        description,
        parentVersionId: lastVersion?._id || null,
        snapshot: {
          systemName: system.name,
          systemDescription: system.description,
          pages: pages.map((p) => ({
            name: p.name,
            slug: p.slug,
            description: p.description,
            order: p.order,
            icon: p.metadata?.icon || '',
          })),
          themeTokens: theme?.tokens || {},
        },
      })

      // Update system's published version reference
      system.publishedVersionId = version._id
      await system.save()

      await Activity.create({
        systemId: system._id,
        actorId: req.user._id,
        type: ActivityType.VERSION_CREATED,
        metadata: { versionName: name, versionId: version._id },
      })

      successResponse(res, { version }, 201)
    } catch (error) {
      next(error)
    }
  }
)

// ── GET /api/systems/:slug/versions — List all Versions ───────────────────
router.get('/:slug/versions', optionalAuth, async (req, res, next) => {
  try {
    const system = await System.findOne({ slug: req.params.slug })
    if (!system) return errorResponse(res, 'System not found', 404)

    const isOwner = req.user && system.ownerId.toString() === req.user._id.toString()
    if (system.visibility === 'private' && !isOwner) {
      return errorResponse(res, 'System not found', 404)
    }

    const versions = await Version.find({ systemId: system._id })
      .populate('createdBy', 'username avatar')
      .sort({ createdAt: -1 })

    successResponse(res, { versions })
  } catch (error) {
    next(error)
  }
})

// ── GET /api/systems/:slug/versions/:versionId — Get a single Version ─────
router.get('/:slug/versions/:versionId', optionalAuth, async (req, res, next) => {
  try {
    const system = await System.findOne({ slug: req.params.slug })
    if (!system) return errorResponse(res, 'System not found', 404)

    const isOwner = req.user && system.ownerId.toString() === req.user._id.toString()
    if (system.visibility === 'private' && !isOwner) {
      return errorResponse(res, 'System not found', 404)
    }

    const version = await Version.findOne({
      _id: req.params.versionId,
      systemId: system._id,
    }).populate('createdBy', 'username avatar')

    if (!version) return errorResponse(res, 'Version not found', 404)

    successResponse(res, { version })
  } catch (error) {
    next(error)
  }
})

// ── POST /api/systems/:slug/versions/:versionId/restore — Restore a Version
// Restores the live System state to match a snapshot.
// Does NOT delete existing versions — creates a new restore point.
router.post('/:slug/versions/:versionId/restore', protect, async (req, res, next) => {
  try {
    const system = await System.findOne({ slug: req.params.slug, ownerId: req.user._id })
    if (!system) return errorResponse(res, 'System not found', 404)

    const version = await Version.findOne({
      _id: req.params.versionId,
      systemId: system._id,
    })
    if (!version) return errorResponse(res, 'Version not found', 404)

    const { snapshot } = version

    // Restore system name and description
    system.name = snapshot.systemName
    system.description = snapshot.systemDescription
    await system.save()

    // Replace pages with snapshot pages
    await Page.deleteMany({ systemId: system._id })
    if (snapshot.pages.length > 0) {
      await Page.insertMany(
        snapshot.pages.map((p) => ({
          systemId: system._id,
          name: p.name,
          slug: p.slug,
          description: p.description,
          order: p.order,
          metadata: { icon: p.icon || '' },
        }))
      )
    }

    // Restore theme tokens
    await Theme.findOneAndUpdate(
      { systemId: system._id },
      { tokens: snapshot.themeTokens },
      { upsert: true }
    )

    await Activity.create({
      systemId: system._id,
      actorId: req.user._id,
      type: ActivityType.VERSION_CREATED,
      metadata: {
        versionName: `Restored from "${version.name}"`,
        restoredFromVersionId: version._id,
      },
    })

    const [pages, theme] = await Promise.all([
      Page.find({ systemId: system._id }).sort({ order: 1 }),
      Theme.findOne({ systemId: system._id }),
    ])

    successResponse(res, { system, pages, theme })
  } catch (error) {
    next(error)
  }
})

export default router