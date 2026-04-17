import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'

const VERTICALS = ['Med Spa','Weight Loss','Dental','Chiropractic','Roofing','HVAC','Legal Services','Real Estate','Fitness & Gym','Plastic Surgery','Other']
const HOOK_TACTICS = ['Bold Claim','Direct Address','Question','Problem/Solution','Relatable Scenario','Curiosity','Social Proof','Urgency']
const VISUAL_FORMATS = ['Talking Head','Text Overlay','Before/After','UGC','Screen Record','Carousel','Static Image','Animation']
const MESSAGING_ANGLES = ['Value Proposition','Pain Point','FOMO','Authority','Social Proof','Transformation','Curiosity','Offer']
const CTA_TYPES = ['Book Now','Learn More','Get Started','Claim Offer','Schedule Call','Apply Now','Shop Now','Download']
const VISUAL_STYLES = ['Professional/Polished','Raw/Authentic','Bold/Graphic','Minimal/Clean','Testimonial','Documentary']

const TAG_COLORS = {
  hookTactic: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  visualFormat: { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  messagingAngle: { bg: '#fefce8', text: '#a16207', border: '#fde68a' },
  ctaType: { bg: '#fdf4ff', text: '#7e22ce', border: '#e9d5ff' },
  visualStyle: { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' }
}

function s(obj) { return JSON.parse(JSON.stringify(obj)) }
function getBody(ad) { return ad?.snapshot?.body?.text || ad?.body || ad?.ad_creative_body || ad?.description || '' }
function getTitle(ad) { return ad?.snapshot?.title || ad?.title || ad?.ad_creative_link_title || '' }
function getImage(ad) { return ad?.snapshot?.images?.[0]?.originalImageUrl || ad?.snapshot?.cards?.[0]?.originalImageUrl || ad?.snapshot?.images?.[0]?.url || null }
function getVideo(ad) { return ad?.snapshot?.videos?.[0]?.videoHdUrl || ad?.snapshot?.videos?.[0]?.videoSdUrl || null }
function getSnap(ad) { return ad?.adArchiveID ? `https://www.facebook.com/ads/library/?id=${ad.adArchiveID}` : ad?.ad_snapshot_url || null }
function getCTA(ad) { return ad?.snapshot?.cta?.text || ad?.snapshot?.cards?.[0]?.ctaText || null }
function getFormat(ad) {
  if (ad?.snapshot?.videos?.length) return 'Video'
  if ((ad?.snapshot?.cards?.length || 0) > 1) return 'Carousel'
  if (ad?.snapshot?.images?.length) return 'Image'
  if (ad?.ad_creative_media_types?.includes('video')) return 'Video'
  return 'Image'
}
function daysRunning(ad) {
  const d = ad?.startDate || ad?.ad_delivery_start_time || ad?.startedRunningAt
  if (!d) return null
  return Math.floor((Date.now() - new Date(d)) / 86400000)
}
function startDate(ad) {
  const d = ad?.startDate || ad?.ad_delivery_start_time || ad?.startedRunningAt
  if (!d) return null
  return new Date(d).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })
}
function adScore(ad) {
  const imp = parseInt(ad?.impressionsUpperBound || ad?.impressionsLowerBound || 0)
  return imp + (daysRunning(ad) || 0) * 500
}
function adKey(ad) { return ad?.adArchiveID || ad?.id || Math.random().toString(36).slice(2) }

const pill = (label, color) => (
  <span key={label} style={{ fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 6, background: color.bg, color: color.text, border: `1px solid ${color.border}`, whiteSpace: 'nowrap' }}>{label}</span>
)

export default function Home() {
  const [companies, setCompanies] = useState([])
  const [ads, setAds] = useState({})
  const [bookmarks, setBookmarks] = useState([])
  const [transcripts, setTranscripts] = useState({})
  const [aiTags, setAiTags] = useState({})
  const [collapsed, setCollapsed] = useState({})
  const [view, setView] = useState('vault')
  const [selectedAd, setSelectedAd] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showDeleteId, setShowDeleteId] = useState(null)
  const [showScrapeConfirm, setShowScrapeConfirm] = useState(false)
  const [showAiTagsDropdown, setShowAiTagsDropdown] = useState(false)
  const [scraping, setScraping] = useState({})
  const [transcribing, setTranscribing] = useState({})
  const [analyzing, setAnalyzing] = useState({})
  const [statusMsg, setStatusMsg] = useState('')
  const [filter, setFilter] = useState({ company: 'all', media: 'all', sort: 'longest', aiTag: {} })
  const [newComp, setNewComp] = useState({ name:'', url:'', vertical:'', website:'', instagram:'', facebook:'', trustpilot:'', youtube:'', linkedin:'' })
  const aiTagRef = useRef(null)

  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem('pnm_spy') || '{}')
      if (d.companies) setCompanies(d.companies)
      if (d.ads) setAds(d.ads)
      if (d.bookmarks) setBookmarks(d.bookmarks)
      if (d.transcripts) setTranscripts(d.transcripts)
      if (d.aiTags) setAiTags(d.aiTags)
    } catch(e) {}
  }, [])

  const persist = (c, a, b, t, g) => {
    try { localStorage.setItem('pnm_spy', JSON.stringify({ companies: c, ads: a, bookmarks: b, transcripts: t, aiTags: g })) } catch(e) {}
  }

  useEffect(() => {
    const handler = (e) => { if (aiTagRef.current && !aiTagRef.current.contains(e.target)) setShowAiTagsDropdown(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const addCompany = () => {
    if (!newComp.name.trim() || !newComp.url.trim()) return
    const c = [...companies, { ...newComp, id: Date.now().toString(), lastScraped: null }]
    setCompanies(c); persist(c, ads, bookmarks, transcripts, aiTags)
    setNewComp({ name:'', url:'', vertical:'', website:'', instagram:'', facebook:'', trustpilot:'', youtube:'', linkedin:'' })
    setShowAdd(false)
  }

  const deleteCompany = (id) => {
    const c = companies.filter(x => x.id !== id)
    const a = { ...ads }; delete a[id]
    setCompanies(c); setAds(a); persist(c, a, bookmarks, transcripts, aiTags)
    setShowDeleteId(null)
    if (selectedAd?._compId === id) setSelectedAd(null)
  }

  const scrapeOne = async (comp) => {
    setScraping(s => ({ ...s, [comp.id]: true }))
    setStatusMsg(`Scraping ${comp.name}...`)
    try {
      const r = await fetch('/api/scrape', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ url: comp.url }) })
      const d = await r.json()
      const compAds = (d.ads || []).map(ad => ({ ...ad, _compId: comp.id, _compName: comp.name, _vertical: comp.vertical }))
      const newAds = { ...ads, [comp.id]: compAds }
      const newComps = companies.map(c => c.id === comp.id ? { ...c, lastScraped: new Date().toISOString() } : c)
      setAds(newAds); setCompanies(newComps)
      persist(newComps, newAds, bookmarks, transcripts, aiTags)
      setStatusMsg(`${comp.name}: ${compAds.length} ads found`)
    } catch(e) { setStatusMsg(`Error: ${e.message}`) }
    setScraping(s => ({ ...s, [comp.id]: false }))
  }

  const scrapeAll = async () => {
    setShowScrapeConfirm(false)
    for (const c of companies) await scrapeOne(c)
    setStatusMsg('All done.')
  }

  const extractTranscript = async (ad) => {
    const vid = getVideo(ad); if (!vid) return alert('No video URL available for this ad.')
    const k = adKey(ad)
    setTranscribing(t => ({ ...t, [k]: true }))
    try {
      const r = await fetch('/api/transcript', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ videoUrl: vid }) })
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      const newT = { ...transcripts, [k]: d.transcript }
      setTranscripts(newT); persist(companies, ads, bookmarks, newT, aiTags)
    } catch(e) { alert('Transcript failed: ' + e.message) }
    setTranscribing(t => ({ ...t, [k]: false }))
  }

  const analyzeAd = async (ad) => {
    const k = adKey(ad)
    setAnalyzing(a => ({ ...a, [k]: true }))
    try {
      const r = await fetch('/api/analyze', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ headline: getTitle(ad), adCopy: getBody(ad), transcript: transcripts[k] || '' }) })
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      const newG = { ...aiTags, [k]: d.tags }
      setAiTags(newG); persist(companies, ads, bookmarks, transcripts, newG)
      if (selectedAd && adKey(selectedAd) === k) setSelectedAd({ ...selectedAd, _tags: d.tags })
    } catch(e) { alert('Analysis failed: ' + e.message) }
    setAnalyzing(a => ({ ...a, [k]: false }))
  }

  const toggleBookmark = (ad) => {
    const k = adKey(ad)
    const exists = bookmarks.some(b => adKey(b) === k)
    const newB = exists ? bookmarks.filter(b => adKey(b) !== k) : [...bookmarks, ad]
    setBookmarks(newB); persist(companies, ads, newB, transcripts, aiTags)
  }

  const isBookmarked = (ad) => bookmarks.some(b => adKey(b) === adKey(ad))
  const toggleCollapse = (id) => setCollapsed(c => ({ ...c, [id]: !c[id] }))

  const setAiTagFilter = (cat, val) => {
    setFilter(f => ({ ...f, aiTag: { ...f.aiTag, [cat]: f.aiTag[cat] === val ? '' : val } }))
  }

  const getFilteredAds = (companyId) => {
    let result = (ads[companyId] || [])
    if (filter.media !== 'all') result = result.filter(a => getFormat(a) === filter.media)
    Object.entries(filter.aiTag).forEach(([cat, val]) => {
      if (!val) return
      result = result.filter(a => {
        const tags = aiTags[adKey(a)]
        return tags && tags[cat] === val
      })
    })
    if (filter.sort === 'longest') result = [...result].sort((a, b) => (daysRunning(b) || 0) - (daysRunning(a) || 0))
    else if (filter.sort === 'newest') result = [...result].sort((a, b) => new Date(b.startDate || 0) - new Date(a.startDate || 0))
    else if (filter.sort === 'ranked') result = [...result].sort((a, b) => adScore(b) - adScore(a))
    return result
  }

  const displayCompanies = filter.company === 'all' ? companies : companies.filter(c => c.id === filter.company)
  const totalAds = Object.values(ads).flat().length
  const bookmarkCount = bookmarks.length
  const activeAiFilters = Object.values(filter.aiTag).filter(Boolean).length

  const copy = async (text) => { try { await navigator.clipboard.writeText(text) } catch(e) {} }

  const Tag = ({ label, colorKey }) => {
    const c = TAG_COLORS[colorKey] || TAG_COLORS.hookTactic
    return <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20, background: c.bg, color: c.text, border: `1px solid ${c.border}`, whiteSpace: 'nowrap' }}>{label}</span>
  }

  const AdCard = ({ ad, rank }) => {
    const k = adKey(ad)
    const img = getImage(ad)
    const fmt = getFormat(ad)
    const days = daysRunning(ad)
    const title = getTitle(ad)
    const body = getBody(ad)
    const tags = aiTags[k]
    const bookmarked = isBookmarked(ad)

    return (
      <div onClick={() => setSelectedAd({ ...ad, _tags: tags })} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', flexDirection: 'column' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(59,130,246,0.1)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none' }}>
        <div style={{ position: 'relative', height: 160, background: '#f1f5f9', overflow: 'hidden' }}>
          {img ? <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display='none'} /> : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'#94a3b8', fontSize:12 }}>No preview</div>}
          <div style={{ position:'absolute', top:8, left:8, display:'flex', gap:4 }}>
            <span style={{ fontSize:10, fontWeight:600, padding:'2px 7px', borderRadius:20, background: fmt==='Video' ? '#1d4ed8' : '#0f172a', color:'#fff' }}>{fmt}</span>
          </div>
          <div style={{ position:'absolute', top:8, right:8, display:'flex', gap:4, alignItems:'center' }}>
            <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:20, background:'rgba(0,0,0,0.6)', color:'#fff' }}>#{rank}</span>
            <button onClick={e => { e.stopPropagation(); toggleBookmark(ad) }} style={{ width:28, height:28, borderRadius:'50%', background:'rgba(255,255,255,0.9)', border:'none', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, color: bookmarked ? '#f59e0b' : '#94a3b8' }}>
              {bookmarked ? '★' : '☆'}
            </button>
          </div>
          {days !== null && <div style={{ position:'absolute', bottom:8, left:8 }}>
            <span style={{ fontSize:10, fontWeight:600, padding:'2px 7px', borderRadius:20, background: days>30?'#dcfce7':'rgba(0,0,0,0.5)', color: days>30?'#15803d':'#fff' }}>{days}d</span>
          </div>}
        </div>
        <div style={{ padding:'12px 14px', flex:1, display:'flex', flexDirection:'column', gap:6 }}>
          <div style={{ fontSize:11, color:'#64748b', fontWeight:500 }}>{ad._compName}</div>
          {title && <div style={{ fontSize:13, fontWeight:600, color:'#0f172a', lineHeight:1.3, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{title}</div>}
          {body && !title && <div style={{ fontSize:12, color:'#475569', lineHeight:1.4, display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{body}</div>}
          {tags && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:4 }}>
              {tags.hookTactic && <Tag label={tags.hookTactic} colorKey="hookTactic" />}
              {tags.visualFormat && <Tag label={tags.visualFormat} colorKey="visualFormat" />}
              {tags.messagingAngle && <Tag label={tags.messagingAngle} colorKey="messagingAngle" />}
            </div>
          )}
        </div>
      </div>
    )
  }

  const DetailPanel = ({ ad }) => {
    const k = adKey(ad)
    const img = getImage(ad)
    const vid = getVideo(ad)
    const snap = getSnap(ad)
    const fmt = getFormat(ad)
    const days = daysRunning(ad)
    const sd = startDate(ad)
    const title = getTitle(ad)
    const body = getBody(ad)
    const cta = getCTA(ad)
    const tags = aiTags[k] || ad._tags
    const transcript = transcripts[k]
    const bookmarked = isBookmarked(ad)
    const [expanded, setExpanded] = useState(false)
    const [copiedCopy, setCopiedCopy] = useState(false)
    const [copiedT, setCopiedT] = useState(false)

    const doCopy = (text, setCopied) => { copy(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }

    return (
      <div style={{ position:'fixed', top:0, right:0, width:460, height:'100vh', background:'#fff', borderLeft:'1px solid #e2e8f0', overflowY:'auto', zIndex:50, display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid #e2e8f0', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, background:'#fff', zIndex:1 }}>
          <div>
            <div style={{ fontSize:13, fontWeight:600, color:'#0f172a' }}>Ad Details</div>
            <div style={{ fontSize:11, color:'#64748b' }}>{ad._compName} {ad._vertical && `· ${ad._vertical}`} · Rank #{ad._rank || '—'}</div>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <button onClick={() => toggleBookmark(ad)} style={{ background:'none', border:'none', fontSize:20, color: bookmarked ? '#f59e0b' : '#cbd5e1', padding:4 }}>{bookmarked ? '★' : '☆'}</button>
            <button onClick={() => setSelectedAd(null)} style={{ background:'none', border:'none', fontSize:22, color:'#64748b', padding:4, lineHeight:1 }}>×</button>
          </div>
        </div>

        <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:16 }}>
          {img && <img src={img} alt="" style={{ width:'100%', borderRadius:10, objectFit:'cover', maxHeight:200 }} onError={e => e.target.style.display='none'} />}

          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            <span style={{ fontSize:11, padding:'4px 10px', borderRadius:6, background:'#eff6ff', color:'#1d4ed8', border:'1px solid #bfdbfe', fontWeight:500 }}>{fmt}</span>
            {cta && <span style={{ fontSize:11, padding:'4px 10px', borderRadius:6, background:'#f8fafc', color:'#475569', border:'1px solid #e2e8f0', fontWeight:500 }}>{cta}</span>}
            {snap && <a href={snap} target="_blank" rel="noreferrer" style={{ fontSize:11, padding:'4px 10px', borderRadius:6, background:'#eff6ff', color:'#1d4ed8', border:'1px solid #bfdbfe', fontWeight:500 }}>View in Ad Library</a>}
            {vid && <a href={vid} target="_blank" rel="noreferrer" style={{ fontSize:11, padding:'4px 10px', borderRadius:6, background:'#f0fdf4', color:'#15803d', border:'1px solid #bbf7d0', fontWeight:500 }}>Watch Video</a>}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div style={{ background:'#f8fafc', borderRadius:8, padding:'10px 14px' }}>
              <div style={{ fontSize:10, color:'#94a3b8', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>Running Since</div>
              <div style={{ fontSize:13, fontWeight:600, color:'#0f172a' }}>{sd || '—'}</div>
            </div>
            <div style={{ background:'#f8fafc', borderRadius:8, padding:'10px 14px' }}>
              <div style={{ fontSize:10, color:'#94a3b8', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>Running For</div>
              <div style={{ fontSize:13, fontWeight:600, color:'#0f172a' }}>{days !== null ? `${days} days` : '—'}</div>
            </div>
          </div>

          {title && (
            <div>
              <div style={{ fontSize:11, fontWeight:600, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>Headline</div>
              <div style={{ fontSize:14, fontWeight:700, color:'#0f172a', lineHeight:1.4 }}>{title}</div>
            </div>
          )}

          {body && (
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                <div style={{ fontSize:11, fontWeight:600, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.06em' }}>Ad Copy</div>
                <button onClick={() => doCopy(body, setCopiedCopy)} style={{ fontSize:11, padding:'3px 10px', borderRadius:6, border:'1px solid #e2e8f0', background: copiedCopy?'#f0fdf4':'#fff', color: copiedCopy?'#15803d':'#475569', fontWeight:500 }}>
                  {copiedCopy ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div style={{ fontSize:13, color:'#374151', lineHeight:1.7, whiteSpace:'pre-wrap', background:'#f8fafc', borderRadius:8, padding:'10px 12px', ...(expanded?{}:{display:'-webkit-box', WebkitLineClamp:6, WebkitBoxOrient:'vertical', overflow:'hidden'}) }}>{body}</div>
              {body.length > 300 && <button onClick={() => setExpanded(e => !e)} style={{ fontSize:12, color:'#3b82f6', background:'none', border:'none', padding:'4px 0', marginTop:4 }}>{expanded ? 'View less' : 'View more'}</button>}
            </div>
          )}

          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <div style={{ fontSize:11, fontWeight:600, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.06em', display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ color:'#3b82f6' }}>◆</span> AI Tags
              </div>
              <button onClick={() => analyzeAd(ad)} disabled={analyzing[k]} style={{ fontSize:11, padding:'4px 12px', borderRadius:6, border:'1px solid #e2e8f0', background:'#fff', color:'#374151', fontWeight:500, opacity: analyzing[k]?0.6:1, display:'flex', alignItems:'center', gap:4 }}>
                {analyzing[k] ? 'Analyzing...' : <><span style={{ fontSize:10 }}>↻</span> {tags ? 'Re-analyze' : 'Analyze'}</>}
              </button>
            </div>
            {tags ? (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {[['hookTactic','Hook Tactic'],['visualFormat','Visual Format'],['messagingAngle','Messaging Angle'],['ctaType','CTA Type'],['visualStyle','Visual Style']].map(([key, label]) => tags[key] && (
                  <div key={key} style={{ background:'#f8fafc', borderRadius:8, padding:'10px 12px' }}>
                    <div style={{ fontSize:10, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>{label}</div>
                    <Tag label={tags[key]} colorKey={key} />
                  </div>
                ))}
              </div>
            ) : <div style={{ fontSize:12, color:'#94a3b8', background:'#f8fafc', borderRadius:8, padding:'10px 12px' }}>Click Analyze to generate AI tags for this ad</div>}
          </div>

          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <div style={{ fontSize:11, fontWeight:600, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.06em', display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ color:'#3b82f6' }}>◉</span> Video Transcript
              </div>
              <div style={{ display:'flex', gap:6 }}>
                {transcript && <button onClick={() => doCopy(transcript, setCopiedT)} style={{ fontSize:11, padding:'4px 10px', borderRadius:6, border:'1px solid #e2e8f0', background: copiedT?'#f0fdf4':'#fff', color: copiedT?'#15803d':'#475569', fontWeight:500 }}>{copiedT?'Copied!':'Copy'}</button>}
                <button onClick={() => extractTranscript(ad)} disabled={transcribing[k]} style={{ fontSize:11, padding:'4px 12px', borderRadius:6, border:'1px solid #bfdbfe', background:'#eff6ff', color:'#1d4ed8', fontWeight:500, opacity: transcribing[k]?0.6:1 }}>
                  {transcribing[k] ? 'Extracting...' : transcript ? 'Re-extract' : 'Extract Transcript'}
                </button>
              </div>
            </div>
            <div style={{ fontSize:12, color: transcript?'#374151':'#94a3b8', lineHeight:1.7, whiteSpace:'pre-wrap', background:'#f8fafc', borderRadius:8, padding:'10px 12px', minHeight:60, maxHeight:280, overflowY:'auto' }}>
              {transcript || (fmt !== 'Video' ? 'Not a video ad' : 'Click "Extract Transcript" to generate a transcript from the video audio.')}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <Head><title>PNM Ad Spy</title><meta name="viewport" content="width=device-width,initial-scale=1" /></Head>

      <div style={{ minHeight:'100vh', background:'#f8fafc', paddingRight: selectedAd ? 460 : 0, transition:'padding-right 0.2s' }}>

        <nav style={{ background:'#fff', borderBottom:'1px solid #e2e8f0', height:56, display:'flex', alignItems:'center', padding:'0 24px', gap:24, position:'sticky', top:0, zIndex:40 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:28, height:28, borderRadius:8, background:'#3b82f6', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <span style={{ color:'#fff', fontSize:14 }}>◎</span>
            </div>
            <span style={{ fontWeight:700, fontSize:15, color:'#0f172a', letterSpacing:'-0.02em' }}>PNM Ad Spy</span>
          </div>

          <div style={{ display:'flex', gap:2 }}>
            {[['vault','Ad Vault'],['companies','Companies'],['bookmarks',`Bookmarks`]].map(([v,l]) => (
              <button key={v} onClick={() => setView(v)} style={{ padding:'6px 14px', borderRadius:8, border:'none', background: view===v?'#eff6ff':'transparent', color: view===v?'#1d4ed8':'#64748b', fontWeight: view===v?600:400, fontSize:13 }}>
                {l}{v==='bookmarks'&&bookmarkCount>0?` (${bookmarkCount})`:''}
              </button>
            ))}
          </div>

          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:10 }}>
            {statusMsg && <span style={{ fontSize:11, color:'#64748b', maxWidth:240, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{statusMsg}</span>}
            <span style={{ fontSize:12, color:'#94a3b8', background:'#f1f5f9', padding:'4px 10px', borderRadius:20 }}>{companies.length} co · {totalAds} ads</span>
            <button onClick={() => setShowAdd(true)} style={{ padding:'7px 14px', borderRadius:8, border:'1px solid #e2e8f0', background:'#fff', color:'#0f172a', fontSize:13, fontWeight:500 }}>+ Add Company</button>
            <button onClick={() => setShowScrapeConfirm(true)} style={{ padding:'7px 16px', borderRadius:8, border:'none', background:'#3b82f6', color:'#fff', fontSize:13, fontWeight:600 }}>↺ Scrape All</button>
          </div>
        </nav>

        {view === 'vault' && (
          <div style={{ padding:'20px 24px' }}>
            <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap', alignItems:'center' }}>
              <select value={filter.company} onChange={e => setFilter(f => ({ ...f, company: e.target.value }))} style={{ padding:'7px 12px', borderRadius:8, border:'1px solid #e2e8f0', fontSize:13, background:'#fff', color:'#0f172a', minWidth:180 }}>
                <option value="all">All Companies</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>

              <div style={{ display:'flex', gap:4 }}>
                {[['all','All Media'],['Video','Video'],['Image','Image'],['Carousel','Carousel']].map(([v,l]) => (
                  <button key={v} onClick={() => setFilter(f => ({ ...f, media: v }))} style={{ padding:'6px 14px', borderRadius:8, border:`1px solid ${filter.media===v?'#3b82f6':'#e2e8f0'}`, background: filter.media===v?'#eff6ff':'#fff', color: filter.media===v?'#1d4ed8':'#475569', fontSize:12, fontWeight: filter.media===v?600:400 }}>{l}</button>
                ))}
              </div>

              <div style={{ display:'flex', gap:4 }}>
                {[['longest','Running Longest'],['ranked','Top Ranked'],['newest','Newest']].map(([v,l]) => (
                  <button key={v} onClick={() => setFilter(f => ({ ...f, sort: v }))} style={{ padding:'6px 14px', borderRadius:8, border:`1px solid ${filter.sort===v?'#3b82f6':'#e2e8f0'}`, background: filter.sort===v?'#eff6ff':'#fff', color: filter.sort===v?'#1d4ed8':'#475569', fontSize:12, fontWeight: filter.sort===v?600:400 }}>{l}</button>
                ))}
              </div>

              <div ref={aiTagRef} style={{ position:'relative' }}>
                <button onClick={() => setShowAiTagsDropdown(d => !d)} style={{ padding:'6px 14px', borderRadius:8, border:`1px solid ${activeAiFilters>0?'#3b82f6':'#e2e8f0'}`, background: activeAiFilters>0?'#eff6ff':'#fff', color: activeAiFilters>0?'#1d4ed8':'#475569', fontSize:12, fontWeight: activeAiFilters>0?600:400, display:'flex', alignItems:'center', gap:6 }}>
                  ◆ AI Tags {activeAiFilters>0&&<span style={{ background:'#3b82f6', color:'#fff', borderRadius:20, fontSize:10, padding:'1px 6px' }}>{activeAiFilters}</span>} ▾
                </button>
                {showAiTagsDropdown && (
                  <div style={{ position:'absolute', top:'calc(100% + 6px)', left:0, background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:16, zIndex:100, minWidth:320, boxShadow:'0 8px 24px rgba(0,0,0,0.08)' }}>
                    {[['hookTactic','Hook Tactic', HOOK_TACTICS],['visualFormat','Visual Format', VISUAL_FORMATS],['messagingAngle','Messaging Angle', MESSAGING_ANGLES],['ctaType','CTA Type', CTA_TYPES],['visualStyle','Visual Style', VISUAL_STYLES]].map(([key, label, options]) => (
                      <div key={key} style={{ marginBottom:12 }}>
                        <div style={{ fontSize:11, fontWeight:600, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>{label}</div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                          {options.map(o => {
                            const active = filter.aiTag[key] === o
                            const c = TAG_COLORS[key] || TAG_COLORS.hookTactic
                            return <button key={o} onClick={() => setAiTagFilter(key, o)} style={{ fontSize:11, padding:'3px 8px', borderRadius:20, border:`1px solid ${active?c.border:'#e2e8f0'}`, background: active?c.bg:'#fff', color: active?c.text:'#64748b', fontWeight: active?600:400 }}>{o}</button>
                          })}
                        </div>
                      </div>
                    ))}
                    {activeAiFilters > 0 && <button onClick={() => setFilter(f => ({ ...f, aiTag: {} }))} style={{ fontSize:12, color:'#ef4444', background:'none', border:'none', padding:'4px 0', marginTop:4 }}>Clear all filters</button>}
                  </div>
                )}
              </div>
            </div>

            {displayCompanies.length === 0 ? (
              <div style={{ textAlign:'center', padding:'5rem', color:'#94a3b8' }}>
                <div style={{ fontSize:40, marginBottom:12 }}>📭</div>
                <div style={{ fontSize:16, fontWeight:600, color:'#64748b', marginBottom:8 }}>No ads yet</div>
                <div style={{ fontSize:13, marginBottom:16 }}>Add companies and run a scrape to populate the vault</div>
                <button onClick={() => setShowAdd(true)} style={{ padding:'8px 20px', borderRadius:8, border:'none', background:'#3b82f6', color:'#fff', fontSize:13, fontWeight:600 }}>Add First Company</button>
              </div>
            ) : displayCompanies.map(comp => {
              const filteredAds = getFilteredAds(comp.id)
              const isCollapsed = collapsed[comp.id]
              return (
                <div key={comp.id} style={{ marginBottom:24 }}>
                  <div onClick={() => toggleCollapse(comp.id)} style={{ display:'flex', alignItems:'center', gap:10, marginBottom: isCollapsed?0:14, cursor:'pointer', userSelect:'none' }}>
                    <span style={{ fontSize:14, color:'#94a3b8', transition:'transform 0.15s', display:'inline-block', transform: isCollapsed?'rotate(-90deg)':'rotate(0deg)' }}>▾</span>
                    <span style={{ fontSize:15, fontWeight:700, color:'#0f172a' }}>{comp.name}</span>
                    <span style={{ fontSize:12, fontWeight:600, padding:'2px 10px', borderRadius:20, background:'#eff6ff', color:'#1d4ed8', border:'1px solid #bfdbfe' }}>{filteredAds.length} ads</span>
                    <span style={{ fontSize:11, color:'#94a3b8', marginLeft:'auto' }}>Click to {isCollapsed?'expand':'collapse'}</span>
                  </div>
                  {!isCollapsed && (
                    filteredAds.length === 0 ? (
                      <div style={{ textAlign:'center', padding:'2rem', color:'#94a3b8', background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', fontSize:13 }}>
                        No ads found. {(ads[comp.id]||[]).length===0?'Run a scrape to pull ads.':'Try adjusting your filters.'}
                      </div>
                    ) : (
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:14 }}>
                        {filteredAds.map((ad, i) => <AdCard key={adKey(ad)} ad={{ ...ad, _rank: i+1 }} rank={i+1} />)}
                      </div>
                    )
                  )}
                </div>
              )
            })}
          </div>
        )}

        {view === 'companies' && (
          <div style={{ padding:'20px 24px' }}>
            <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, overflow:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr style={{ background:'#f8fafc', borderBottom:'1px solid #e2e8f0' }}>
                    {['Company','Vertical','Ads','Last Scraped','Actions'].map(h => (
                      <th key={h} style={{ padding:'10px 16px', textAlign:'left', fontWeight:600, color:'#64748b', fontSize:11, textTransform:'uppercase', letterSpacing:'0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {companies.length === 0 ? (
                    <tr><td colSpan={5} style={{ padding:'3rem', textAlign:'center', color:'#94a3b8' }}>No companies added yet</td></tr>
                  ) : companies.map((comp, i) => (
                    <tr key={comp.id} style={{ borderBottom: i<companies.length-1?'1px solid #f1f5f9':'none' }}>
                      <td style={{ padding:'12px 16px' }}>
                        <div style={{ fontWeight:600, color:'#0f172a' }}>{comp.name}</div>
                        <div style={{ fontSize:11, color:'#94a3b8', marginTop:2, maxWidth:280, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{comp.url}</div>
                      </td>
                      <td style={{ padding:'12px 16px', color:'#64748b' }}>{comp.vertical||'—'}</td>
                      <td style={{ padding:'12px 16px' }}>
                        <span style={{ fontSize:12, fontWeight:600, padding:'3px 10px', borderRadius:20, background:(ads[comp.id]?.length||0)>0?'#f0fdf4':'#f8fafc', color:(ads[comp.id]?.length||0)>0?'#15803d':'#94a3b8', border:`1px solid ${(ads[comp.id]?.length||0)>0?'#bbf7d0':'#e2e8f0'}` }}>
                          {ads[comp.id]?.length||0}
                        </span>
                      </td>
                      <td style={{ padding:'12px 16px', color:'#64748b', fontSize:12 }}>{comp.lastScraped?new Date(comp.lastScraped).toLocaleDateString():'Never'}</td>
                      <td style={{ padding:'12px 16px' }}>
                        <div style={{ display:'flex', gap:6 }}>
                          <button onClick={() => scrapeOne(comp)} disabled={scraping[comp.id]} style={{ fontSize:11, padding:'5px 12px', borderRadius:6, border:'1px solid #e2e8f0', background:'#fff', color:'#374151', fontWeight:500, opacity:scraping[comp.id]?0.5:1 }}>
                            {scraping[comp.id]?'Scraping...':'Scrape'}
                          </button>
                          <button onClick={() => setShowDeleteId(comp.id)} style={{ fontSize:11, padding:'5px 12px', borderRadius:6, border:'1px solid #fecaca', background:'#fff', color:'#dc2626', fontWeight:500 }}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {view === 'bookmarks' && (
          <div style={{ padding:'20px 24px' }}>
            {bookmarks.length === 0 ? (
              <div style={{ textAlign:'center', padding:'5rem', color:'#94a3b8' }}>
                <div style={{ fontSize:40, marginBottom:12 }}>☆</div>
                <div style={{ fontSize:16, fontWeight:600, color:'#64748b', marginBottom:8 }}>No bookmarks yet</div>
                <div style={{ fontSize:13 }}>Star any ad to save it here</div>
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:14 }}>
                {bookmarks.map((ad, i) => <AdCard key={adKey(ad)} ad={ad} rank={i+1} />)}
              </div>
            )}
          </div>
        )}
      </div>

      {selectedAd && <DetailPanel ad={selectedAd} />}

      {showAdd && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:60 }}>
          <div style={{ background:'#fff', borderRadius:16, padding:'24px', width:520, maxWidth:'90vw', maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <div style={{ fontSize:16, fontWeight:700, color:'#0f172a' }}>Add Company</div>
              <button onClick={() => setShowAdd(false)} style={{ background:'none', border:'none', fontSize:22, color:'#94a3b8', lineHeight:1 }}>×</button>
            </div>

            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:11, fontWeight:600, color:'#3b82f6', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:12 }}>Basic Information</div>
              {[['Company Name *','name','text','e.g. Patient Profit Funnel'],['Ad Library URL *','url','text','https://www.facebook.com/ads/library/...']].map(([label,key,type,ph]) => (
                <div key={key} style={{ marginBottom:12 }}>
                  <label style={{ display:'block', fontSize:12, fontWeight:500, color:'#374151', marginBottom:5 }}>{label}</label>
                  <input value={newComp[key]} onChange={e => setNewComp(c => ({ ...c, [key]: e.target.value }))} placeholder={ph} style={{ width:'100%', padding:'8px 12px', borderRadius:8, border:'1px solid #e2e8f0', fontSize:13, outline:'none', color:'#0f172a' }} />
                  {key==='url'&&<div style={{ fontSize:11, color:'#94a3b8', marginTop:4 }}>Go to Meta Ad Library, find the company, paste the URL here.</div>}
                </div>
              ))}
              <div style={{ marginBottom:12 }}>
                <label style={{ display:'block', fontSize:12, fontWeight:500, color:'#374151', marginBottom:5 }}>Vertical (optional)</label>
                <select value={newComp.vertical} onChange={e => setNewComp(c => ({ ...c, vertical: e.target.value }))} style={{ width:'100%', padding:'8px 12px', borderRadius:8, border:'1px solid #e2e8f0', fontSize:13, background:'#fff', color:'#0f172a', outline:'none' }}>
                  <option value="">Select vertical...</option>
                  {VERTICALS.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom:20 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                <div style={{ fontSize:11, fontWeight:600, color:'#3b82f6', textTransform:'uppercase', letterSpacing:'0.06em' }}>Competitive Intelligence</div>
                <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, background:'#f1f5f9', color:'#94a3b8', fontWeight:500 }}>Coming Soon</span>
              </div>
              <div style={{ fontSize:12, color:'#94a3b8', marginBottom:10 }}>Track competitor presence across platforms for deeper analysis.</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                {[['website','Website / Funnel URL','https://competitor.com'],['instagram','Instagram Page','https://instagram.com/competitor'],['facebook','Facebook Page','https://facebook.com/competitor'],['trustpilot','TrustPilot URL','https://trustpilot.com/review/...'],['youtube','YouTube Channel','https://youtube.com/@competitor'],['linkedin','LinkedIn Page','https://linkedin.com/company/...']].map(([key,label,ph]) => (
                  <div key={key}>
                    <label style={{ display:'block', fontSize:11, fontWeight:500, color:'#94a3b8', marginBottom:4 }}>{label}</label>
                    <input value={newComp[key]||''} onChange={e => setNewComp(c => ({ ...c, [key]: e.target.value }))} placeholder={ph} style={{ width:'100%', padding:'7px 10px', borderRadius:8, border:'1px solid #e2e8f0', fontSize:12, outline:'none', color:'#0f172a', background:'#f8fafc' }} />
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={() => setShowAdd(false)} style={{ padding:'8px 18px', borderRadius:8, border:'1px solid #e2e8f0', background:'#fff', color:'#374151', fontSize:13, fontWeight:500 }}>Cancel</button>
              <button onClick={addCompany} style={{ padding:'8px 20px', borderRadius:8, border:'none', background:'#3b82f6', color:'#fff', fontSize:13, fontWeight:600 }}>Save Company</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteId && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:60 }}>
          <div style={{ background:'#fff', borderRadius:16, padding:'24px', width:360 }}>
            <div style={{ fontSize:16, fontWeight:700, color:'#0f172a', marginBottom:8 }}>Delete Company</div>
            <div style={{ fontSize:13, color:'#64748b', marginBottom:20 }}>Are you sure? This will also remove all associated ads.</div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={() => setShowDeleteId(null)} style={{ padding:'8px 16px', borderRadius:8, border:'1px solid #e2e8f0', background:'#fff', color:'#374151', fontSize:13 }}>Cancel</button>
              <button onClick={() => deleteCompany(showDeleteId)} style={{ padding:'8px 16px', borderRadius:8, border:'none', background:'#ef4444', color:'#fff', fontSize:13, fontWeight:600 }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {showScrapeConfirm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:60 }}>
          <div style={{ background:'#fff', borderRadius:16, padding:'24px', width:380 }}>
            <div style={{ fontSize:16, fontWeight:700, color:'#0f172a', marginBottom:8 }}>Scrape All Companies</div>
            <div style={{ fontSize:13, color:'#64748b', marginBottom:20 }}>This will scrape active ads for all {companies.length} companies. May take several minutes and use Apify credits.</div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={() => setShowScrapeConfirm(false)} style={{ padding:'8px 16px', borderRadius:8, border:'1px solid #e2e8f0', background:'#fff', color:'#374151', fontSize:13 }}>Cancel</button>
              <button onClick={scrapeAll} style={{ padding:'8px 20px', borderRadius:8, border:'none', background:'#3b82f6', color:'#fff', fontSize:13, fontWeight:600 }}>Scrape All</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
