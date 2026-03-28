import sharp from 'sharp'
import { createCanvas, loadImage } from 'canvas'

export const BRAND = {
  SIZE: 1080,
  MARGIN: 56,
  NAVY_DEEP:  '#060E1A',
  NAVY:       '#0A1628',
  GOLD:       '#D4AF72',
  GOLD_LIGHT: '#E8CFA0',
  WHITE:      '#FFFFFF',
  WARM:       '#F0E8DA',
  MUTED:      '#B8A98A',
  SIGNATURE:  'Caleb Jackson  ·  REALTOR®  ·  Rêve Realtors  ·  (225) 747-0303',
  HANDLE:     '@calebjackson_24',
}

export interface DealData {
  status:      string
  price:       string
  address:     string
  specs:       string
  equityShow:  boolean
  equityValue: string
  equityLabel: string
  clientName:  string
  headline:    string[]
  stat1Val:    string
  stat1Lbl:    string
  stat2Val:    string
  stat2Lbl:    string
  stat3Val:    string
  stat3Lbl:    string
}

export interface SlideBuffers {
  slide1: Buffer
  slide2: Buffer
}

function applyGradient(ctx: any, size: number, mode: 'property' | 'closing') {
  const grad = ctx.createLinearGradient(0, 0, 0, size)
  if (mode === 'property') {
    grad.addColorStop(0,    'rgba(6,14,26,0.15)')
    grad.addColorStop(0.35, 'rgba(6,14,26,0.05)')
    grad.addColorStop(0.55, 'rgba(6,14,26,0.55)')
    grad.addColorStop(0.78, 'rgba(6,14,26,0.92)')
    grad.addColorStop(1.0,  'rgba(6,14,26,0.98)')
  } else {
    grad.addColorStop(0,    'rgba(6,14,26,0.08)')
    grad.addColorStop(0.28, 'rgba(6,14,26,0.08)')
    grad.addColorStop(0.52, 'rgba(6,14,26,0.50)')
    grad.addColorStop(0.72, 'rgba(6,14,26,0.94)')
    grad.addColorStop(1.0,  'rgba(6,14,26,0.99)')
  }
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
}

function drawGoldRule(ctx: any, y: number, margin: number, size: number) {
  const grad = ctx.createLinearGradient(margin, y, size - margin, y)
  grad.addColorStop(0,    'rgba(212,175,114,0)')
  grad.addColorStop(0.15, 'rgba(212,175,114,0.55)')
  grad.addColorStop(0.85, 'rgba(212,175,114,0.55)')
  grad.addColorStop(1.0,  'rgba(212,175,114,0)')
  ctx.strokeStyle = grad
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(margin, y)
  ctx.lineTo(size - margin, y)
  ctx.stroke()
}

function drawStatusPill(ctx: any, x: number, y: number, text: string) {
  ctx.font = '500 24px sans-serif'
  const tw = ctx.measureText(text).width
  const pw = tw + 60, ph = 44
  ctx.fillStyle = 'rgba(6,14,26,0.65)'
  ctx.fillRect(x, y, pw, ph)
  ctx.strokeStyle = 'rgba(212,175,114,0.45)'
  ctx.lineWidth = 1
  ctx.strokeRect(x, y, pw, ph)
  ctx.fillStyle = BRAND.GOLD
  ctx.beginPath()
  ctx.arc(x + 20, y + ph / 2, 5, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = BRAND.GOLD
  ctx.font = '400 20px sans-serif'
  ctx.fillText(text.toUpperCase(), x + 34, y + ph / 2 + 7)
}

function drawSlideNum(ctx: any, text: string, margin: number, size: number) {
  ctx.font = '300 22px sans-serif'
  ctx.fillStyle = 'rgba(184,169,138,0.8)'
  const w = ctx.measureText(text).width
  ctx.fillText(text, size - margin - w, 72)
}

function drawSigStrip(ctx: any, y: number, margin: number, size: number) {
  const lineGrad = ctx.createLinearGradient(margin, y - 10, size - margin, y - 10)
  lineGrad.addColorStop(0,   'rgba(212,175,114,0)')
  lineGrad.addColorStop(0.1, 'rgba(212,175,114,0.2)')
  lineGrad.addColorStop(0.9, 'rgba(212,175,114,0.2)')
  lineGrad.addColorStop(1,   'rgba(212,175,114,0)')
  ctx.strokeStyle = lineGrad
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(margin, y - 10)
  ctx.lineTo(size - margin, y - 10)
  ctx.stroke()
  ctx.font = '300 20px sans-serif'
  ctx.fillStyle = 'rgba(184,169,138,0.85)'
  ctx.fillText(BRAND.SIGNATURE, margin, y + 16)
  ctx.fillStyle = 'rgba(212,175,114,0.85)'
  const hw = ctx.measureText(BRAND.HANDLE).width
  ctx.fillText(BRAND.HANDLE, size - margin - hw, y + 16)
}

export async function generatePostSlides(
  propertyImageBuffer: Buffer,
  closingImageBuffer: Buffer,
  deal: DealData
): Promise<SlideBuffers> {
  const S = BRAND.SIZE
  const M = BRAND.MARGIN

  // ── SLIDE 1: PROPERTY ──
  const s1 = createCanvas(S, S)
  const ctx1 = s1.getContext('2d')

  const propProcessed = await sharp(propertyImageBuffer)
    .resize(S, S, { fit: 'cover', position: 'centre' })
    .modulate({ brightness: 0.72, saturation: 0.80 })
    .toBuffer()
  const propImg = await loadImage(propProcessed)
  ctx1.drawImage(propImg, 0, 0, S, S)

  applyGradient(ctx1, S, 'property')
  drawStatusPill(ctx1, M - 4, M - 4, deal.status)
  drawSlideNum(ctx1, '1 / 2  →', M, S)
  drawGoldRule(ctx1, S - 315, M, S)

  // Price
  ctx1.font = '300 108px Georgia, serif'
  ctx1.fillStyle = BRAND.WHITE
  ctx1.shadowColor = 'rgba(6,14,26,0.6)'
  ctx1.shadowBlur = 8
  ctx1.fillText(deal.price, M, S - 195)
  ctx1.shadowBlur = 0

  // Address
  ctx1.font = '300 28px sans-serif'
  ctx1.fillStyle = 'rgba(240,232,218,0.88)'
  ctx1.fillText(deal.address.toUpperCase(), M, S - 148)

  // Specs
  const specParts = deal.specs.split('·').map((s: string) => s.trim())
  let specX = M
  ctx1.font = '300 26px sans-serif'
  specParts.forEach((part: string, i: number) => {
    ctx1.fillStyle = 'rgba(184,169,138,0.85)'
    ctx1.fillText(part, specX, S - 106)
    specX += ctx1.measureText(part).width
    if (i < specParts.length - 1) {
      ctx1.fillStyle = 'rgba(212,175,114,0.6)'
      ctx1.fillText('  ·  ', specX, S - 106)
      specX += ctx1.measureText('  ·  ').width
    }
  })

  // Equity badge
  if (deal.equityShow) {
    const eqX = S - 236, eqY = S - 262
    ctx1.fillStyle = 'rgba(6,14,26,0.55)'
    ctx1.fillRect(eqX, eqY, 180, 88)
    ctx1.strokeStyle = 'rgba(212,175,114,0.45)'
    ctx1.lineWidth = 1
    ctx1.strokeRect(eqX, eqY, 180, 88)
    ctx1.font = '300 52px Georgia, serif'
    ctx1.fillStyle = BRAND.GOLD
    ctx1.fillText(deal.equityValue, eqX + 14, eqY + 56)
    ctx1.font = '300 18px sans-serif'
    ctx1.fillStyle = 'rgba(184,169,138,0.85)'
    ctx1.fillText(deal.equityLabel.toUpperCase(), eqX + 14, eqY + 78)
  }

  drawSigStrip(ctx1, S - 58, M, S)
  const slide1 = s1.toBuffer('image/png')

  // ── SLIDE 2: CLIENT ──
  const s2 = createCanvas(S, S)
  const ctx2 = s2.getContext('2d')

  const closeProcessed = await sharp(closingImageBuffer)
    .resize(S, S, { fit: 'cover', position: 'top' })
    .modulate({ brightness: 0.68, saturation: 0.85 })
    .toBuffer()
  const closeImg = await loadImage(closeProcessed)
  ctx2.drawImage(closeImg, 0, 0, S, S)

  applyGradient(ctx2, S, 'closing')
  drawStatusPill(ctx2, M - 4, M - 4, deal.status)
  drawSlideNum(ctx2, '2 / 2', M, S)
  drawGoldRule(ctx2, S - 335, M, S)

  // Client name
  ctx2.font = '500 24px sans-serif'
  ctx2.fillStyle = 'rgba(212,175,114,0.85)'
  ctx2.fillText(deal.clientName.toUpperCase(), M, S - 326)

  // Headline
  const hlY = S - 300
  deal.headline.forEach((line: string, i: number) => {
    if (i === 1) {
      ctx2.font = 'italic 300 72px Georgia, serif'
      ctx2.fillStyle = BRAND.GOLD_LIGHT
    } else {
      ctx2.font = '300 72px Georgia, serif'
      ctx2.fillStyle = BRAND.WHITE
    }
    ctx2.fillText(line, M, hlY + i * 80)
  })

  // Stats row
  const statsY = S - 148
  const colW = (S - M * 2) / 3

  ctx2.strokeStyle = 'rgba(212,175,114,0.35)'
  ctx2.lineWidth = 1
  ctx2.beginPath(); ctx2.moveTo(M, statsY - 8); ctx2.lineTo(S - M, statsY - 8); ctx2.stroke()
  ctx2.beginPath(); ctx2.moveTo(M, statsY + 88); ctx2.lineTo(S - M, statsY + 88); ctx2.stroke()
  ctx2.strokeStyle = 'rgba(212,175,114,0.2)'
  ctx2.beginPath(); ctx2.moveTo(M + colW, statsY + 8); ctx2.lineTo(M + colW, statsY + 78); ctx2.stroke()
  ctx2.beginPath(); ctx2.moveTo(M + colW * 2, statsY + 8); ctx2.lineTo(M + colW * 2, statsY + 78); ctx2.stroke()

  const stats = [
    { val: deal.stat1Val, lbl: deal.stat1Lbl },
    { val: deal.stat2Val, lbl: deal.stat2Lbl },
    { val: deal.stat3Val, lbl: deal.stat3Lbl },
  ]
  stats.forEach(({ val, lbl }, i) => {
    const cx = M + colW * i + colW / 2
    ctx2.font = '300 56px Georgia, serif'
    ctx2.fillStyle = BRAND.GOLD
    const vw = ctx2.measureText(val).width
    ctx2.fillText(val, cx - vw / 2, statsY + 54)
    ctx2.font = '300 20px sans-serif'
    ctx2.fillStyle = 'rgba(184,169,138,0.8)'
    const lw = ctx2.measureText(lbl.toUpperCase()).width
    ctx2.fillText(lbl.toUpperCase(), cx - lw / 2, statsY + 80)
  })

  drawSigStrip(ctx2, S - 58, M, S)
  const slide2 = s2.toBuffer('image/png')

  return { slide1, slide2 }
}