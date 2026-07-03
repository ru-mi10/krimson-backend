// routes/ai.js
// AI is an assistant. Not the product.
// Uses Groq (llama-3.1-8b-instant) — free tier: 14,400 req/day

import express from 'express'
import { body, validationResult } from 'express-validator'
import Groq from 'groq-sdk'
import rateLimit from 'express-rate-limit'
import { protect } from '../middleware/auth.js'
import { successResponse, errorResponse } from '../utils/helpers.js'

const router = express.Router()

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { success: false, message: 'AI request limit reached. Please wait a moment.' },
})

const getGroq = () => {
  if (!process.env.GROQ_API_KEY) return null
  return new Groq({ apiKey: process.env.GROQ_API_KEY })
}

const parseJSON = (text) => {
  const cleaned = text.replace(/```json|```/g, '').trim()
  return JSON.parse(cleaned)
}

const chat = async (groq, prompt) => {
  const res = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.4,
    max_tokens: 800,
  })
  return res.choices[0].message.content
}

// ── POST /api/ai/suggest-system ───────────────────────────────────────────
router.post(
  '/suggest-system',
  protect,
  aiLimiter,
  [body('prompt').trim().notEmpty().isLength({ max: 500 })],
  async (req, res, next) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return errorResponse(res, errors.array()[0].msg)

      const groq = getGroq()
      if (!groq) return errorResponse(res, 'AI features are not configured', 503)

      const prompt = `
You are a product architecture assistant. Suggest a UI System structure for: "${req.body.prompt}"

A UI System has pages (product surfaces like Dashboard, Analytics, Billing) — NOT components.

Respond ONLY with valid JSON, no markdown, no explanation:
{
  "name": "Product Name",
  "description": "One sentence description",
  "category": "one of: crm|analytics|ecommerce|saas|portfolio|fintech|healthcare|education|productivity|other",
  "tags": ["tag1", "tag2"],
  "pages": [
    { "name": "Page Name", "description": "One sentence", "icon": "LucideIconName" }
  ]
}

Rules: 4-8 pages. First page = Dashboard or Overview. Pages are surfaces, not components.
`
      const text = await chat(groq, prompt)
      const suggestion = parseJSON(text)
      if (!suggestion.name || !Array.isArray(suggestion.pages)) {
        return errorResponse(res, 'AI returned unexpected response. Try again.')
      }
      suggestion.pages = suggestion.pages.slice(0, 8)
      successResponse(res, { suggestion })
    } catch (e) {
      if (e instanceof SyntaxError) return errorResponse(res, 'AI returned unexpected response. Try again.')
      next(e)
    }
  }
)

// ── POST /api/ai/suggest-pages ────────────────────────────────────────────
router.post(
  '/suggest-pages',
  protect,
  aiLimiter,
  [
    body('systemName').trim().notEmpty().isLength({ max: 100 }),
    body('existingPages').isArray(),
    body('prompt').optional().isLength({ max: 300 }),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return errorResponse(res, errors.array()[0].msg)

      const groq = getGroq()
      if (!groq) return errorResponse(res, 'AI features are not configured', 503)

      const { systemName, existingPages = [], prompt = '' } = req.body

      const p = `
System: "${systemName}". Existing pages: ${existingPages.join(', ')}.
${prompt ? `User wants: "${prompt}"` : 'Suggest natural additions.'}

Respond ONLY with valid JSON, no markdown:
{ "pages": [{ "name": "string", "description": "string", "icon": "LucideIconName" }] }

Rules: 2-4 new pages only. No duplicates. Pages are surfaces, not components.
`
      const text = await chat(groq, p)
      const suggestion = parseJSON(text)
      if (!Array.isArray(suggestion.pages)) {
        return errorResponse(res, 'AI returned unexpected response. Try again.')
      }
      successResponse(res, { pages: suggestion.pages.slice(0, 4) })
    } catch (e) {
      if (e instanceof SyntaxError) return errorResponse(res, 'AI returned unexpected response. Try again.')
      next(e)
    }
  }
)

// ── POST /api/ai/suggest-theme ────────────────────────────────────────────
router.post(
  '/suggest-theme',
  protect,
  aiLimiter,
  [
    body('systemName').trim().notEmpty().isLength({ max: 100 }),
    body('category').optional().isString(),
    body('appearance').optional().isIn(['dark', 'light']),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return errorResponse(res, errors.array()[0].msg)

      const groq = getGroq()
      if (!groq) return errorResponse(res, 'AI features are not configured', 503)

      const { systemName, category = 'other', appearance = 'dark' } = req.body

      const p = `
Suggest professional design tokens for UI System "${systemName}" (${category}, ${appearance} mode).

Respond ONLY with valid JSON, no markdown:
{
  "name": "Theme name",
  "tokens": {
    "appearance": "${appearance}",
    "accentColor": "#hex",
    "fontFamily": "one of: Inter|Geist|Space Grotesk|Outfit|Plus Jakarta Sans",
    "borderRadius": "one of: none|subtle|default|rounded",
    "motion": "one of: none|subtle|default"
  },
  "reasoning": "one sentence"
}

Rules: professional not trendy, valid hex for accentColor, no neon.
`
      const text = await chat(groq, p)
      const suggestion = parseJSON(text)
      if (!suggestion.tokens) return errorResponse(res, 'AI returned unexpected response. Try again.')
      successResponse(res, { suggestion })
    } catch (e) {
      if (e instanceof SyntaxError) return errorResponse(res, 'AI returned unexpected response. Try again.')
      next(e)
    }
  }
)

// ── POST /api/ai/generate-page-code — Generate real React component for a page
// Input: { pageName, pageDescription, systemName, themeTokens }
// Output: { code: "...jsx string..." }
router.post(
  '/generate-page-code',
  protect,
  aiLimiter,
  [
    body('pageName').trim().notEmpty().isLength({ max: 100 }),
    body('pageDescription').optional().isLength({ max: 300 }),
    body('systemName').optional().isLength({ max: 100 }),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return errorResponse(res, errors.array()[0].msg)

      const groq = getGroq()
      if (!groq) return errorResponse(res, 'AI features are not configured', 503)

      const { pageName, pageDescription = '', systemName = '', themeTokens = {} } = req.body

      const p = `
You are an expert React UI developer. Generate a single stunning, professional React component for a "${pageName}" page.

System name: "${systemName}"
Page purpose: ${pageDescription || pageName}

MANDATORY THEME - use EXACTLY these colors via inline style objects:
- Page background: ${themeTokens.backgroundColor || '#09090B'}
- Card/surface background: ${themeTokens.surfaceColor || '#111113'}  
- Border color: ${themeTokens.borderColor || '#27272A'}
- Accent/highlight color: ${themeTokens.accentColor || '#DC2626'}
- Primary text: ${themeTokens.primaryTextColor || '#FAFAFA'}
- Secondary text: ${themeTokens.secondaryTextColor || '#A1A1AA'}

STRICT OUTPUT RULES:
- Output ONLY raw JavaScript/JSX code. Zero markdown. Zero backticks. Zero comments. Zero explanation.
- First line must be: function GeneratedPage() {
- Last line must be: (end of function, no export statement)
- Never write "export", "import", or "require" — React and useState are already globally available.
- ALL styling via inline style={{}} only. Never use className for visual styles.
- Use padding: '24px' on the root div with backgroundColor set to the page background color.
- Every card must use the surface background color and border color.
- Make it visually impressive with realistic data for "${systemName}".
- Include at minimum: a header row with title + action button, metric cards row, and a data table or list.
`

      const result = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: p }],
        temperature: 0.3,
        max_tokens: 3000,
      })

      let code = result.choices[0].message.content
      code = code.replace(/```jsx|```javascript|```js|```/g, '').trim()

      if (!code.includes('GeneratedPage')) {
        return errorResponse(res, 'AI returned unexpected code. Please try again.')
      }

      successResponse(res, { code })
    } catch (e) {
      next(e)
    }
  }
)

// ── POST /api/ai/modify-page-code ─────────────────────────────────────────
router.post(
  '/modify-page-code',
  protect,
  aiLimiter,
  [
    body('currentCode').notEmpty(),
    body('instruction').trim().notEmpty().isLength({ max: 300 }),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return errorResponse(res, errors.array()[0].msg)

      const groq = getGroq()
      if (!groq) return errorResponse(res, 'AI features are not configured', 503)

      const { currentCode, instruction, themeTokens = {} } = req.body

      const p = `
Here is an existing React component:

${currentCode}

Apply this change: "${instruction}"

Rules:
- Output ONLY the complete updated JSX code, no markdown fences, no explanation.
- Keep the component named "GeneratedPage" with "export default function GeneratedPage() {...}".
- Use only inline style objects, no Tailwind, no external imports (React is globally available).
- Preserve the existing theme colors unless the instruction explicitly asks to change them.
- Preserve everything unrelated to the requested change.
- Code must be complete and directly renderable, no placeholders.
`
      const result = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: p }],
        temperature: 0.4,
        max_tokens: 2000,
      })

      let code = result.choices[0].message.content
      code = code.replace(/```jsx|```javascript|```js|```/g, '').trim()

      if (!code.includes('GeneratedPage')) {
        return errorResponse(res, 'AI returned unexpected code. Please try again.')
      }

      successResponse(res, { code })
    } catch (e) {
      next(e)
    }
  }
)

export default router