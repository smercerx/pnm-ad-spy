export const config = { api: { bodyParser: true } }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { url } = req.body
  if (!url) return res.status(400).json({ error: 'No URL provided' })
  const TOKEN = process.env.APIFY_TOKEN
  if (!TOKEN) return res.status(500).json({ error: 'APIFY_TOKEN not configured' })

  const ACTORS = [
    'curious_coder~facebook-ads-library-scraper',
    'apify~facebook-ads-library-scraper',
    'webdatalabs~meta-ad-library-scraper-pro'
  ]

  for (const actor of ACTORS) {
    try {
      const runResp = await fetch(
        `https://api.apify.com/v2/acts/${actor}/runs?token=${TOKEN}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            startUrls: [{ url }],
            activeStatus: 'ACTIVE',
            adType: 'ALL',
            count: 50,
            maxItems: 50
          })
        }
      )
      if (!runResp.ok) continue
      const runData = await runResp.json()
      const runId = runData?.data?.id
      if (!runId) continue

      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 4000))
        const sr = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${TOKEN}`)
        const sd = await sr.json()
        const status = sd?.data?.status
        if (status === 'SUCCEEDED') {
          const dsId = sd.data.defaultDatasetId
          const ir = await fetch(`https://api.apify.com/v2/datasets/${dsId}/items?token=${TOKEN}&limit=100`)
          const items = await ir.json()
          const ads = Array.isArray(items) ? items : []
          if (ads.length > 0) return res.status(200).json({ ads, actor })
          break
        }
        if (['FAILED','ABORTED','TIMED-OUT'].includes(status)) break
      }
    } catch(e) { continue }
  }

  return res.status(200).json({ ads: [], error: 'No ads found across all actors. The page may have no active ads or the URL format may need adjustment.' })
}
