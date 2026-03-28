import { NextRequest, NextResponse } from 'next/server'
import { generatePostSlides, DealData } from '@/lib/postGenerator'
import { generateCaption, generateHashtags, CaptionInput } from '@/lib/captionGenerator'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()

    const propertyFile = formData.get('propertyImage') as File | null
    const closingFile  = formData.get('closingImage')  as File | null
    const dealJson     = formData.get('deal')          as string | null
    const captionJson  = formData.get('caption')       as string | null

    if (!propertyFile || !closingFile || !dealJson) {
      return NextResponse.json(
        { error: 'Missing required fields: propertyImage, closingImage, deal' },
        { status: 400 }
      )
    }

    let deal: DealData
    try {
      deal = JSON.parse(dealJson)
    } catch {
      return NextResponse.json({ error: 'Invalid deal JSON' }, { status: 400 })
    }

    const propBuffer  = Buffer.from(await propertyFile.arrayBuffer())
    const closeBuffer = Buffer.from(await closingFile.arrayBuffer())

    const { slide1, slide2 } = await generatePostSlides(propBuffer, closeBuffer, deal)

    let caption  = ''
    let hashtags = ''

    if (captionJson) {
      try {
        const captionInput: CaptionInput = JSON.parse(captionJson)
        caption  = generateCaption(captionInput)
        hashtags = generateHashtags(
          deal.address.split('·')[1]?.trim() || 'Baton Rouge',
          deal.status
        )
      } catch {
        // caption generation is non-critical, keep going
      }
    }

    return NextResponse.json({
      success:  true,
      slide1:   slide1.toString('base64'),
      slide2:   slide2.toString('base64'),
      caption,
      hashtags,
      metadata: {
        size:      '1080x1080',
        format:    'PNG',
        deal:      deal.price,
        address:   deal.address,
        generated: new Date().toISOString(),
      }
    })

  } catch (err) {
    console.error('[generate-post] Error:', err)
    return NextResponse.json(
      { error: 'Image generation failed', detail: String(err) },
      { status: 500 }
    )
  }
}