// routes/systems.js
import express from 'express'
import { body, validationResult } from 'express-validator'
import System from '../models/System.js'
import Page from '../models/Page.js'
import Theme from '../models/Theme.js'
import Version from '../models/Version.js'
import Activity, { ActivityType } from '../models/Activity.js'
import { protect, optionalAuth } from '../middleware/auth.js'
import { slugify, uniqueSlug, successResponse, errorResponse } from '../utils/helpers.js'

const router = express.Router()

// ── POST /api/systems — Create a System ───────────────────────────────────
router.post(
  '/',
  protect,
  [
    body('name').trim().notEmpty().withMessage('System name is required').isLength({ max: 100 }),
    body('description').optional().isLength({ max: 500 }),
    body('category').optional().isIn([
      'crm','analytics','ecommerce','saas','portfolio',
      'fintech','healthcare','education','productivity','other',
    ]),
    body('visibility').optional().isIn(['private', 'unlisted', 'public']),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return errorResponse(res, errors.array()[0].msg)

      const { name, description = '', category = 'other', visibility = 'private', tags = [] } = req.body
      const user = req.user

      // Generate unique slug within this workspace
      const baseSlug = slugify(name)
      const slug = await uniqueSlug(baseSlug, (s) =>
        System.exists({ workspaceId: user.workspace, slug: s })
      )

      const system = await System.create({
        workspaceId: user.workspace,
        ownerId: user._id,
        name,
        slug,
        description,
        category,
        visibility,
        tags: tags.map((t) => t.toLowerCase().trim()).filter(Boolean),
      })

      // Auto-create a default theme for every new system
      await Theme.create({ systemId: system._id })

      // Log activity
      await Activity.create({
        systemId: system._id,
        actorId: user._id,
        type: ActivityType.SYSTEM_CREATED,
        metadata: { systemName: name },
      })

      successResponse(res, { system }, 201)
    } catch (error) {
      next(error)
    }
  }
)

// ── GET /api/systems — List current user's Systems ────────────────────────
router.get('/', protect, async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query
    const query = { ownerId: req.user._id }
    if (status) query.status = status

    const systems = await System.find(query)
      .sort({ updatedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)

    const total = await System.countDocuments(query)

    successResponse(res, {
      systems,
      pagination: { total, page: +page, limit: +limit, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    next(error)
  }
})

// ── GET /api/systems/:slug — Get a single System ──────────────────────────
router.get('/:slug', optionalAuth, async (req, res, next) => {
  try {
    const system = await System.findOne({ slug: req.params.slug })
      .populate('ownerId', 'username fullName avatar')

    if (!system) return errorResponse(res, 'System not found', 404)

    // Private systems are only visible to their owner
    const isOwner = req.user && system.ownerId._id.toString() === req.user._id.toString()
    if (system.visibility === 'private' && !isOwner) {
      return errorResponse(res, 'System not found', 404)
    }

    // Increment view count without a blocking write
    if (!isOwner) {
      System.findByIdAndUpdate(system._id, { $inc: { 'stats.viewCount': 1 } }).exec()
    }

    // Fetch pages and theme alongside
    const [pages, theme] = await Promise.all([
      Page.find({ systemId: system._id }).sort({ order: 1 }),
      Theme.findOne({ systemId: system._id }),
    ])

    successResponse(res, { system, pages, theme, isOwner: !!isOwner })
  } catch (error) {
    next(error)
  }
})

// ── PUT /api/systems/:slug — Update a System ──────────────────────────────
router.put(
  '/:slug',
  protect,
  [
    body('name').optional().trim().notEmpty().isLength({ max: 100 }),
    body('description').optional().isLength({ max: 500 }),
    body('visibility').optional().isIn(['private', 'unlisted', 'public']),
    body('category').optional().isIn([
      'crm','analytics','ecommerce','saas','portfolio',
      'fintech','healthcare','education','productivity','other',
    ]),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return errorResponse(res, errors.array()[0].msg)

      const system = await System.findOne({ slug: req.params.slug, ownerId: req.user._id })
      if (!system) return errorResponse(res, 'System not found', 404)

      const allowedFields = ['name', 'description', 'visibility', 'category', 'tags']
      allowedFields.forEach((field) => {
        if (req.body[field] !== undefined) system[field] = req.body[field]
      })

      await system.save()

      await Activity.create({
        systemId: system._id,
        actorId: req.user._id,
        type: ActivityType.SYSTEM_UPDATED,
        metadata: {},
      })

      successResponse(res, { system })
    } catch (error) {
      next(error)
    }
  }
)

// ── POST /api/systems/:slug/publish — Publish a System ───────────────────
router.post('/:slug/publish', protect, async (req, res, next) => {
  try {
    const system = await System.findOne({ slug: req.params.slug, ownerId: req.user._id })
    if (!system) return errorResponse(res, 'System not found', 404)

    const pageCount = await Page.countDocuments({ systemId: system._id })
    if (pageCount === 0) {
      return errorResponse(res, 'Add at least one page before publishing')
    }

    system.status = 'published'
    system.visibility = 'public'
    await system.save()

    await Activity.create({
      systemId: system._id,
      actorId: req.user._id,
      type: ActivityType.SYSTEM_PUBLISHED,
      metadata: {},
    })

    successResponse(res, { system })
  } catch (error) {
    next(error)
  }
})

// ── POST /api/systems/:slug/fork — Fork a System ─────────────────────────
router.post('/:slug/fork', protect, async (req, res, next) => {
  try {
    const source = await System.findOne({ slug: req.params.slug })
      .populate('ownerId', 'username')

    if (!source) return errorResponse(res, 'System not found', 404)
    if (source.visibility !== 'public') return errorResponse(res, 'Cannot fork a private system', 403)
    if (source.ownerId._id.toString() === req.user._id.toString()) {
      return errorResponse(res, 'You cannot fork your own System')
    }

    // Build the fork name
    const forkName = req.body.name || `${source.name} (Fork)`
    const baseSlug = slugify(forkName)
    const slug = await uniqueSlug(baseSlug, (s) =>
      System.exists({ workspaceId: req.user.workspace, slug: s })
    )

    // Get source pages and theme to copy
    const [sourcePages, sourceTheme] = await Promise.all([
      Page.find({ systemId: source._id }).sort({ order: 1 }),
      Theme.findOne({ systemId: source._id }),
    ])

    // Create the forked System
    const fork = await System.create({
      workspaceId: req.user.workspace,
      ownerId: req.user._id,
      name: forkName,
      slug,
      description: source.description,
      category: source.category,
      tags: source.tags,
      status: 'draft',
      visibility: 'private',
      forkedFrom: {
        systemId: source._id,
        systemName: source.name,
        ownerUsername: source.ownerId.username,
      },
    })

    // Copy pages into the fork
    const pageCopies = sourcePages.map((p) => ({
      systemId: fork._id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      order: p.order,
      metadata: p.metadata,
    }))
    if (pageCopies.length > 0) await Page.insertMany(pageCopies)

    // Copy theme into the fork
    await Theme.create({
      systemId: fork._id,
      name: sourceTheme?.name || 'Default',
      tokens: sourceTheme?.tokens || {},
    })

    // Increment source fork count
    await System.findByIdAndUpdate(source._id, { $inc: { 'stats.forkCount': 1 } })

    // Activity on source system
    await Activity.create({
      systemId: source._id,
      actorId: req.user._id,
      type: ActivityType.SYSTEM_FORKED,
      metadata: { forkedByUsername: req.user.username, newSystemName: forkName },
    })

    // Activity on the new fork
    await Activity.create({
      systemId: fork._id,
      actorId: req.user._id,
      type: ActivityType.FORKED_FROM,
      metadata: { sourceSystemName: source.name, sourceOwnerUsername: source.ownerId.username },
    })

    successResponse(res, { system: fork }, 201)
  } catch (error) {
    next(error)
  }
})

// ── DELETE /api/systems/:slug — Delete a System ───────────────────────────
router.delete('/:slug', protect, async (req, res, next) => {
  try {
    const system = await System.findOneAndDelete({ slug: req.params.slug, ownerId: req.user._id })
    if (!system) return errorResponse(res, 'System not found', 404)

    // Clean up related data
    await Promise.all([
      Page.deleteMany({ systemId: system._id }),
      Theme.deleteOne({ systemId: system._id }),
      Version.deleteMany({ systemId: system._id }),
      Activity.deleteMany({ systemId: system._id }),
    ])

    successResponse(res, { message: 'System deleted' })
  } catch (error) {
    next(error)
  }
})

// ── GET /api/systems/:slug/activity — System activity feed ────────────────
router.get('/:slug/activity', optionalAuth, async (req, res, next) => {
  try {
    const system = await System.findOne({ slug: req.params.slug })
    if (!system) return errorResponse(res, 'System not found', 404)

    const isOwner = req.user && system.ownerId.toString() === req.user._id.toString()
    if (system.visibility === 'private' && !isOwner) {
      return errorResponse(res, 'System not found', 404)
    }

    const activity = await Activity.find({ systemId: system._id })
      .populate('actorId', 'username avatar')
      .sort({ createdAt: -1 })
      .limit(50)

    successResponse(res, { activity })
  } catch (error) {
    next(error)
  }
})

export default router