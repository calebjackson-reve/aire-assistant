'use client'

import { useState, useRef, useCallback } from 'react'

interface DealData {
  status: string
  price: string
  address: string
  specs: string
  equityShow: boolean
  equityValue: string
  equityLabel: string
  clientName: string
  headline: string[]
  stat1Val: string
  stat1Lbl: string
  stat2Val: string
  stat2Lbl: string
  stat3Val: string
  stat3Lbl: string
}

interface Result {
  slide1: string
  slide2: string
  caption: string
  hashtags: string
}

const DEFAULT: DealData = {
  status: 'Just Sold',
  price: '$220,000',
  address: '4353 Pasture Clear Ct · Zachary, LA',
  specs: '3 Bed · 2 Bath · 1,591 SqFt · Ravenwood',
  equityShow: true,
  equityValue: '$35K+',
  equityLabel: 'Instant Equity',
  clientName: 'The Summers Family',
  headline: ['First home.', 'First keys.', 'First chapter.'],
  stat1Val: '$220K',
  stat1Lbl: 'Purchase Price',
  stat2Val: '$35K+',
  stat2Lbl: 'Day 1 Equity',
  stat3Val: 'Zachary',
  stat3Lbl: 'Louisiana',
}

const GOLD  = '#D4AF72'
const NAVY  = '#0A1628'
const NAVYM = '#0F1F3A'
const WARM  = '#F0E8DA'
const MUTED = '#B8A98A'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 12, fontWeight: 300,
  background: 'rgba(6,14,26,0.7)', border: '0.5px solid rgba(212,175,114,0.2)',
  borderRadius: 2, color: WARM, outline: 'none', boxSizing: 'border-box',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase',
        color: MUTED, marginBottom: 5, fontWeight: 300 }}>{label}</div>
      {children}
    </div>
  )
}

function Inp({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <input value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} style={inputStyle} />
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 9, letterSpacing: '0.3em', textTransform: 'uppercase',
          color: GOLD, fontWeight: 300 }}>{title}</span>
        <div style={{ flex: 1, height: 0.5, background: 'rgba(212,175,114,0.15)' }} />
      </div>
      {children}
    </div>
  )
}

export default function ContentPage() {
  const [deal, setDeal]           = useState<DealData>(DEFAULT)
  const [propFile, setPropFile]   = useState<File | null>(null)
  const [closeFile, setCloseFile] = useState<File | null>(null)
  const [propPrev, setPropPrev]   = useState<string | null>(null)
  const [closePrev, setClosePrev] = useState<string | null>(null)
  const [result, setResult]       = useState<Result | null>(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [copied, setCopied]       = useState(false)
  const prop1Ref = useRef<HTMLInputElement>(null)
  const prop2Ref = useRef<HTMLInputElement>(null)

  const set = useCallback((key: keyof DealData, value: unknown) => {
    setDeal(prev => ({ ...prev, [key]: value }))
  }, [])

  const handleFile = (file: File, type: 'prop' | 'close') => {
    const reader = new FileReader()
    reader.onload = e => {
      const url = e.target?.result as string
      if (type === 'prop') { setPropFile(file); setPropPrev(url) }
      else { setCloseFile(file); setClosePrev(url) }
    }
    reader.readAsDataURL(file)
  }

  const generate = async () => {
    if (!propFile || !closeFile) { setError('Upload both photos first'); return }
    setLoading(true); setError(null); setResult(null)
    try {
      const form = new FormData()
      form.append('propertyImage', propFile)
      form.append('closingImage', closeFile)
      form.append('deal', JSON.stringify(deal))
      form.append('caption', JSON.stringify({
        hook: deal.headline[0] || '',
        clientDescription: `Meet ${deal.clientName}.`,
        price: deal.price,
        address: deal.address,
        specs: deal.specs,
        equityValue: deal.equityShow ? deal.equityValue : undefined,
        milestone: deal.headline[deal.headline.length - 1] || '',
        closingNote: 'This is what real estate looks like when the work actually means something.',
        clientFirstName: deal.clientName.split(' ')[1] || deal.clientName,
      }))
      const res = await fetch('/api/content/generate-post', { method: 'POST', body: form })
      if (!res.ok) throw new Error(await res.text())
      setResult(await res.json())
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  const download = (b64: string, name: string) => {
    const a = document.createElement('a')
    a.href = `data:image/png;base64,${b64}`
    a.download = `caleb_jackson_${name}.png`
    a.click()
  }

  const copyAll = () => {
    if (!result) return
    navigator.clipboard.writeText(result.caption + '\n\n' + result.hashtags)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden',
      fontFamily: 'system-ui, sans-serif', background: '#060E1A', color: '#fff' }}>

      {/* LEFT PANEL */}
      <div style={{ width: 300, flexShrink: 0, overflowY: 'auto', padding: 24,
        background: NAVYM, borderRight: '0.5px solid rgba(212,175,114,0.12)' }}>

        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 9, letterSpacing: '0.4em', textTransform: 'uppercase',
            color: GOLD, marginBottom: 4 }}>AIRE Intelligence</div>
          <div style={{ fontSize: 20, fontWeight: 300 }}>Content Engine</div>
          <div style={{ fontSize: 11, color: MUTED, marginTop: 2, fontWeight: 300 }}>
            Caleb Jackson · REALTOR®
          </div>
        </div>

        <Section title="Deal Info">
          <Field label="Status">
            <select value={deal.status} onChange={e => set('status', e.target.value)}
              style={inputStyle}>
              {['Just Sold','Now Pending','Just Listed','Closing Day'].map(s =>
                <option key={s} value={s} style={{ background: NAVY }}>{s}</option>
              )}
            </select>
          </Field>
          <Field label="Sale Price">
            <Inp value={deal.price} onChange={v => set('price', v)} />
          </Field>
          <Field label="Address">
            <Inp value={deal.address} onChange={v => set('address', v)} />
          </Field>
          <Field label="Specs (Bed · Bath · SqFt · Area)">
            <Inp value={deal.specs} onChange={v => set('specs', v)} />
          </Field>
        </Section>

        <Section title="Equity Badge">
          <div style={{ display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase',
              color: MUTED, fontWeight: 300 }}>Show Badge</span>
            <div onClick={() => set('equityShow', !deal.equityShow)}
              style={{ width: 36, height: 18, borderRadius: 9, cursor: 'pointer',
                background: deal.equityShow ? 'rgba(212,175,114,0.25)' : 'rgba(6,14,26,0.8)',
                border: `0.5px solid ${deal.equityShow ? GOLD : 'rgba(212,175,114,0.3)'}`,
                position: 'relative', transition: 'all 0.2s' }}>
              <div style={{ position: 'absolute', top: 2, width: 12, height: 12,
                borderRadius: '50%', transition: 'all 0.2s',
                left: deal.equityShow ? 20 : 2,
                background: deal.equityShow ? GOLD : MUTED }} />
            </div>
          </div>
          {deal.equityShow && (
            <Field label="Amount">
              <Inp value={deal.equityValue} onChange={v => set('equityValue', v)} />
            </Field>
          )}
        </Section>

        <Section title="Client Story">
          <Field label="Client Name">
            <Inp value={deal.clientName} onChange={v => set('clientName', v)} />
          </Field>
          <Field label="Headline Line 1">
            <Inp value={deal.headline[0]||''} onChange={v =>
              set('headline',[v, deal.headline[1]||'', deal.headline[2]||''])} />
          </Field>
          <Field label="Headline Line 2 — italic gold">
            <Inp value={deal.headline[1]||''} onChange={v =>
              set('headline',[deal.headline[0]||'', v, deal.headline[2]||''])} />
          </Field>
          <Field label="Headline Line 3">
            <Inp value={deal.headline[2]||''} onChange={v =>
              set('headline',[deal.headline[0]||'', deal.headline[1]||'', v])} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Field label="Stat 1 Value"><Inp value={deal.stat1Val} onChange={v => set('stat1Val',v)} /></Field>
            <Field label="Stat 1 Label"><Inp value={deal.stat1Lbl} onChange={v => set('stat1Lbl',v)} /></Field>
            <Field label="Stat 2 Value"><Inp value={deal.stat2Val} onChange={v => set('stat2Val',v)} /></Field>
            <Field label="Stat 2 Label"><Inp value={deal.stat2Lbl} onChange={v => set('stat2Lbl',v)} /></Field>
            <Field label="Stat 3 Value"><Inp value={deal.stat3Val} onChange={v => set('stat3Val',v)} /></Field>
            <Field label="Stat 3 Label"><Inp value={deal.stat3Lbl} onChange={v => set('stat3Lbl',v)} /></Field>
          </div>
        </Section>

        <Section title="Photos">
          <input ref={prop1Ref} type="file" accept="image/*" style={{ display:'none' }}
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0], 'prop')} />
          <input ref={prop2Ref} type="file" accept="image/*" style={{ display:'none' }}
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0], 'close')} />
          {(['prop','close'] as const).map(type => {
            const ref   = type === 'prop' ? prop1Ref : prop2Ref
            const label = type === 'prop' ? '🏡  Property Photo' : '🤝  Closing Photo'
            const name  = type === 'prop' ? propFile?.name : closeFile?.name
            return (
              <div key={type} onClick={() => ref.current?.click()}
                style={{ border: `0.5px dashed ${name ? 'rgba(212,175,114,0.6)' : 'rgba(212,175,114,0.25)'}`,
                  borderRadius: 2, padding: '12px 10px', textAlign: 'center',
                  cursor: 'pointer', marginBottom: 10 }}>
                <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
                  color: MUTED, fontWeight: 300 }}>{label}</div>
                {name && <div style={{ fontSize: 10, color: GOLD, marginTop: 4,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>}
              </div>
            )
          })}
        </Section>

        <button onClick={generate} disabled={loading}
          style={{ width: '100%', padding: '11px 0',
            background: 'rgba(212,175,114,0.15)', border: `0.5px solid ${GOLD}`,
            borderRadius: 2, color: GOLD, cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase',
            fontWeight: 500, opacity: loading ? 0.5 : 1 }}>
          {loading ? '⟳  Generating...' : '⬡  Generate Both Slides'}
        </button>

        {error && (
          <p style={{ color: '#f87171', fontSize: 11, textAlign: 'center', marginTop: 10 }}>
            {error}
          </p>
        )}
      </div>

      {/* RIGHT PANEL */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 40,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32 }}>

        <div style={{ fontSize: 9, letterSpacing: '0.35em', textTransform: 'uppercase',
          color: GOLD }}>
          {result ? 'Ready to Download' : 'Upload photos and generate'}
        </div>

        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
          {(['slide1','slide2'] as const).map((key, i) => {
            const label   = i === 0 ? 'Slide 1 · Property' : 'Slide 2 · Client'
            const preview = i === 0 ? propPrev : closePrev
            const fname   = i === 0 ? 'slide1_property' : 'slide2_client'
            return (
              <div key={key} style={{ display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 9, letterSpacing: '0.2em',
                  textTransform: 'uppercase', color: MUTED }}>{label}</span>
                <div style={{ width: 260, height: 260, borderRadius: 2,
                  overflow: 'hidden', border: '0.5px solid rgba(212,175,114,0.2)',
                  background: NAVY, position: 'relative', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>
                  {result ? (
                    <img src={`data:image/png;base64,${result[key]}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      alt={label} />
                  ) : preview ? (
                    <img src={preview} style={{ width: '100%', height: '100%',
                      objectFit: 'cover', opacity: 0.4 }} alt="preview" />
                  ) : (
                    <span>{i === 0 ? '🏡' : '🤝'}</span>
                  )}
                  {result && (
                    <button onClick={() => download(result[key], fname)}
                      style={{ position: 'absolute', bottom: 8, left: 8, right: 8,
                        padding: '8px 0', background: 'rgba(6,14,26,0.88)',
                        border: `0.5px solid ${GOLD}`, borderRadius: 2, color: GOLD,
                        cursor: 'pointer', fontSize: 10, letterSpacing: '0.18em',
                        textTransform: 'uppercase' }}>
                      ⬇ Download PNG
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {result && (
          <button onClick={() => {
            download(result.slide1, 'slide1_property')
            setTimeout(() => download(result.slide2, 'slide2_client'), 500)
          }} style={{ padding: '12px 32px', background: 'rgba(212,175,114,0.2)',
            border: `0.5px solid ${GOLD}`, borderRadius: 2, color: GOLD,
            cursor: 'pointer', fontSize: 10, letterSpacing: '0.25em',
            textTransform: 'uppercase', fontWeight: 500 }}>
            ⬇ Download Both Slides
          </button>
        )}

        {result?.caption && (
          <div style={{ width: '100%', maxWidth: 560, borderRadius: 2,
            border: '0.5px solid rgba(212,175,114,0.2)', background: NAVYM,
            overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', padding: '14px 20px',
              borderBottom: '0.5px solid rgba(212,175,114,0.12)' }}>
              <span style={{ fontSize: 9, letterSpacing: '0.3em',
                textTransform: 'uppercase', color: GOLD }}>
                Caption · Copy/Paste Ready
              </span>
              <button onClick={copyAll}
                style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase',
                  padding: '5px 12px', border: '0.5px solid rgba(212,175,114,0.3)',
                  borderRadius: 2, background: 'transparent',
                  color: copied ? GOLD : MUTED, cursor: 'pointer' }}>
                {copied ? '✓ Copied' : 'Copy All'}
              </button>
            </div>
            <div style={{ padding: 20 }}>
              <pre style={{ fontSize: 13, fontWeight: 300, whiteSpace: 'pre-wrap',
                lineHeight: 1.8, color: WARM, fontFamily: 'inherit' }}>
                {result.caption}
              </pre>
              <p style={{ fontSize: 11, color: MUTED, marginTop: 14, lineHeight: 1.8 }}>
                {result.hashtags}
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}