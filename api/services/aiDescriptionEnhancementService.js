const axios = require('axios')

function getOpenAiKey() {
  return process.env.OPENAI_API_KEY || ''
}

async function enhanceListingDescription({ title, description, category } = {}) {
  const apiKey = getOpenAiKey()
  if (!apiKey) throw new Error('OpenAI API key not configured')

  const safeTitle = title ? String(title).trim() : ''
  const safeDescription = description ? String(description).trim() : ''
  if (!safeDescription) throw new Error('Description is required')

  const categoryContext = category ? `Category context: ${category}` : 'Category context: Not specified'

  const prompt = `You are a marketplace listing copywriter.
${categoryContext}

Rewrite the listing description to be:
- Concise (150-250 words)
- Engaging and conversion-focused
- Clear and specific
- No URLs, no phone numbers, no emails
- Avoid ALL CAPS spam
- Keep the same key facts from the original.

Title (may help context): "${safeTitle}"
Original description:
"""
${safeDescription}
"""

Return ONLY the final rewritten description text (no JSON, no markdown).`

  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You rewrite marketplace listing descriptions. Output only plain text.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 700,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 120000,
    },
  )

  const text = response?.data?.choices?.[0]?.message?.content
  if (!text || !String(text).trim()) throw new Error('AI returned empty description')
  return String(text).trim()
}

module.exports = { enhanceListingDescription }

