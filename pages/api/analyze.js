export const config = { api: { bodyParser: true } }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { adCopy, transcript, headline } = req.body
  const content = [headline, adCopy, transcript].filter(Boolean).join('\n\n')
  if (!content) return res.status(400).json({ error: 'No content to analyze' })
  const KEY = process.env.ANTHROPIC_API_KEY
  if (!KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        system: `You are an expert direct response ad analyst. Analyze the ad content and return ONLY valid JSON with these exact keys:
- hookTactic: one of [Bold Claim, Direct Address, Question, Problem/Solution, Relatable Scenario, Curiosity, Social Proof, Urgency]
- visualFormat: one of [Talking Head, Text Overlay, Before/After, UGC, Screen Record, Carousel, Static Image, Animation]
- messagingAngle: one of [Value Proposition, Pain Point, FOMO, Authority, Social Proof, Transformation, Curiosity, Offer]
- ctaType: one of [Book Now, Learn More, Get Started, Claim Offer, Schedule Call, Apply Now, Shop Now, Download]
- visualStyle: one of [Professional/Polished, Raw/Authentic, Bold/Graphic, Minimal/Clean, Testimonial, Documentary]
Return ONLY the JSON object. No markdown, no explanation.`,
        messages: [{ role: 'user', content }]
      })
    })
    const data = await resp.json()
    const text = data?.content?.[0]?.text || '{}'
    const clean = text.replace(/```json|```/g, '').trim()
    return res.status(200).json({ tags: JSON.parse(clean) })
  } catch(e) {
    return res.status(500).json({ error: e.message })
  }
}
