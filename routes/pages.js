// routes/pages.js
import express from 'express'
import { body, validationResult } from 'express-validator'
import System from '../models/System.js'
import Page from '../models/Page.js'
import Activity, { ActivityType } from '../models/Activity.js'
import { protect } from '../middleware/auth.js'
import { slugify, uniqueSlug, successResponse, errorResponse } from '../utils/helpers.js'

const router = express.Router()

// Helper — verify system ownership before any page operation
const getOwnedSystem = async (systemSlug, userId, res) => {
  const system = await System.findOne({ slug: systemSlug, ownerId: userId })
  if (!system) {
    errorResponse(res, 'System not found', 404)
    return null
  }
  return system
}

// ── POST /api/systems/:slug/pages — Add a Page ────────────────────────────
router.post(
  '/:slug/pages',
  protect,
  [
    body('name').trim().notEmpty().withMessage('Page name is required').isLength({ max: 100 }),
    body('description').optional().isLength({ max: 300 }),
    body('icon').optional().isString(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return errorResponse(res, errors.array()[0].msg)

      const system = await getOwnedSystem(req.params.slug, req.user._id, res)
      if (!system) return

      const { name, description = '', icon = '' } = req.body

      // Slug unique within this system
      const baseSlug = slugify(name)
      const slug = await uniqueSlug(baseSlug, (s) =>
        Page.exists({ systemId: system._id, slug: s })
      )

      // Place at end of current page list
      const maxOrder = await Page.findOne({ systemId: system._id })
        .sort({ order: -1 })
        .select('order')
      const order = maxOrder ? maxOrder.order + 1 : 0

      const page = await Page.create({
        systemId: system._id,
        name,
        slug,
        description,
        order,
        metadata: { icon },
      })

      await Activity.create({
        systemId: system._id,
        actorId: req.user._id,
        type: ActivityType.PAGE_CREATED,
        metadata: { pageName: name },
      })

      successResponse(res, { page }, 201)
    } catch (error) {
      next(error)
    }
  }
)

// ── GET /api/systems/:slug/pages — List all Pages in a System ────────────
router.get('/:slug/pages', protect, async (req, res, next) => {
  try {
    const system = await System.findOne({
      slug: req.params.slug,
      ownerId: req.user._id,
    })
    if (!system) return errorResponse(res, 'System not found', 404)

    const pages = await Page.find({ systemId: system._id }).sort({ order: 1 })
    successResponse(res, { pages })
  } catch (error) {
    next(error)
  }
})

// ── PUT /api/systems/:slug/pages/:pageSlug — Update a Page ───────────────
router.put(
  '/:slug/pages/:pageSlug',
  protect,
  [
    body('name').optional().trim().notEmpty().isLength({ max: 100 }),
    body('description').optional().isLength({ max: 300 }),
    body('icon').optional().isString(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return errorResponse(res, errors.array()[0].msg)

      const system = await getOwnedSystem(req.params.slug, req.user._id, res)
      if (!system) return

      const page = await Page.findOne({ systemId: system._id, slug: req.params.pageSlug })
      if (!page) return errorResponse(res, 'Page not found', 404)

      if (req.body.name) page.name = req.body.name
      if (req.body.description !== undefined) page.description = req.body.description
      if (req.body.icon !== undefined) page.metadata.icon = req.body.icon

      await page.save()

      await Activity.create({
        systemId: system._id,
        actorId: req.user._id,
        type: ActivityType.PAGE_UPDATED,
        metadata: { pageName: page.name },
      })

      successResponse(res, { page })
    } catch (error) {
      next(error)
    }
  }
)

// ── PUT /api/systems/:slug/pages/reorder — Reorder Pages ─────────────────
// Body: { pages: [{ _id, order }] }
router.put('/:slug/pages/reorder', protect, async (req, res, next) => {
  try {
    const system = await getOwnedSystem(req.params.slug, req.user._id, res)
    if (!system) return

    const { pages } = req.body
    if (!Array.isArray(pages)) return errorResponse(res, 'pages must be an array')

    // Bulk update orders
    const updates = pages.map(({ _id, order }) =>
      Page.findOneAndUpdate(
        { _id, systemId: system._id },
        { order },
        { new: true }
      )
    )
    await Promise.all(updates)

    await Activity.create({
      systemId: system._id,
      actorId: req.user._id,
      type: ActivityType.PAGE_REORDERED,
      metadata: {},
    })

    const updated = await Page.find({ systemId: system._id }).sort({ order: 1 })
    successResponse(res, { pages: updated })
  } catch (error) {
    next(error)
  }
})

// ── DELETE /api/systems/:slug/pages/:pageSlug — Delete a Page ────────────
router.delete('/:slug/pages/:pageSlug', protect, async (req, res, next) => {
  try {
    const system = await getOwnedSystem(req.params.slug, req.user._id, res)
    if (!system) return

    const page = await Page.findOneAndDelete({
      systemId: system._id,
      slug: req.params.pageSlug,
    })
    if (!page) return errorResponse(res, 'Page not found', 404)

    await Activity.create({
      systemId: system._id,
      actorId: req.user._id,
      type: ActivityType.PAGE_DELETED,
      metadata: { pageName: page.name },
    })

    successResponse(res, { message: 'Page deleted' })
  } catch (error) {
    next(error)
  }
})

export default router

// ── PUT /api/systems/:slug/pages/:pageSlug/code — Save generated code ──────
router.put('/:slug/pages/:pageSlug/code', protect, async (req, res, next) => {
  try {
    const system = await getOwnedSystem(req.params.slug, req.user._id, res)
    if (!system) return

    const page = await Page.findOne({ systemId: system._id, slug: req.params.pageSlug })
    if (!page) return errorResponse(res, 'Page not found', 404)

    if (typeof req.body.code !== 'string') return errorResponse(res, 'code must be a string')

    page.generatedCode = req.body.code
    page.codeGeneratedAt = new Date()
    await page.save()

    successResponse(res, { page })
  } catch (error) {
    next(error)
  }
})