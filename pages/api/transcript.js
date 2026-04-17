export const config = { api: { bodyParser: true } }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { videoUrl } = req.body
  if (!videoUrl) return res.status(400).json({ error: 'No video URL' })
  const KEY = process.env.ASSEMBLYAI_KEY
  if (!KEY) return res.status(500).json({ error: 'ASSEMBLYAI_KEY not configured' })

  try {
    const sub = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: { 'Authorization': KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio_url: videoUrl })
    })
    const subData = await sub.json()
    const id = subData.id
    if (!id) return res.status(500).json({ error: 'No transcript ID returned' })

    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 3000))
      const poll = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
        headers: { 'Authorization': KEY }
      })
      const pollData = await poll.json()
      if (pollData.status === 'completed') return res.status(200).json({ transcript: pollData.text })
      if (pollData.status === 'error') return res.status(500).json({ error: pollData.error })
    }
    return res.status(500).json({ error: 'Transcript timed out' })
  } catch(e) {
    return res.status(500).json({ error: e.message })
  }
}
