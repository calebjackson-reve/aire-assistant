/**
 * AirSign End-to-End Test
 * Tests the core signing flow without a running server.
 * Run: npx tsx scripts/test-airsign-flow.ts
 */

import 'dotenv/config'

// Dynamic import to handle Prisma client
async function main() {
  const { default: prisma } = await import('../lib/prisma')
  const { sealPdf } = await import('../lib/airsign/seal-pdf')

  let passed = 0
  let failed = 0
  const cleanup: string[] = [] // IDs to clean up

  function test(name: string, fn: () => Promise<void>) {
    return fn().then(() => {
      console.log(`  ✓ ${name}`)
      passed++
    }).catch((e) => {
      console.log(`  ✗ ${name} — ${e instanceof Error ? e.message : e}`)
      failed++
    })
  }

  function assert(cond: boolean, msg: string) {
    if (!cond) throw new Error(msg)
  }

  console.log('\n═══ AirSign End-to-End Test ═══\n')

  // Need a test user
  let testUser = await prisma.user.findFirst({ orderBy: { createdAt: 'desc' } })
  if (!testUser) {
    console.log('  ⚠ No users in database — creating test user')
    testUser = await prisma.user.create({
      data: { clerkId: 'test_airsign_user', email: 'test@aireintel.org', firstName: 'Test', lastName: 'Agent' },
    })
    cleanup.push(`user:${testUser.id}`)
  }

  let envelopeId: string | null = null
  let signer1Token: string | null = null
  let signer2Token: string | null = null

  // Test 1: Create envelope
  await test('Create test envelope', async () => {
    const env = await prisma.airSignEnvelope.create({
      data: {
        userId: testUser!.id,
        name: 'Test Purchase Agreement — 123 Main St',
        status: 'DRAFT',
        documentUrl: 'https://placehold.co/600x800.pdf', // placeholder
        pageCount: 2,
      },
    })
    envelopeId = env.id
    cleanup.push(`envelope:${env.id}`)
    assert(env.status === 'DRAFT', 'should be DRAFT')
  })

  // Test 2: Add signers
  await test('Add two signers with unique tokens', async () => {
    const s1 = await prisma.airSignSigner.create({
      data: { envelopeId: envelopeId!, name: 'John Buyer', email: 'buyer@test.com', role: 'SIGNER', order: 1 },
    })
    const s2 = await prisma.airSignSigner.create({
      data: { envelopeId: envelopeId!, name: 'Jane Seller', email: 'seller@test.com', role: 'SIGNER', order: 2 },
    })
    signer1Token = s1.token
    signer2Token = s2.token
    assert(s1.token !== s2.token, 'tokens must be unique')
    assert(s1.token.length > 10, 'token should be a cuid')
  })

  // Test 3: Add fields
  await test('Place signature fields on envelope', async () => {
    await prisma.airSignField.createMany({
      data: [
        { envelopeId: envelopeId!, signerId: (await prisma.airSignSigner.findFirst({ where: { envelopeId: envelopeId!, order: 1 } }))!.id, type: 'SIGNATURE', required: true, page: 1, xPercent: 10, yPercent: 80, widthPercent: 30, heightPercent: 5 },
        { envelopeId: envelopeId!, signerId: (await prisma.airSignSigner.findFirst({ where: { envelopeId: envelopeId!, order: 2 } }))!.id, type: 'SIGNATURE', required: true, page: 1, xPercent: 60, yPercent: 80, widthPercent: 30, heightPercent: 5 },
        { envelopeId: envelopeId!, type: 'DATE', required: true, page: 1, xPercent: 10, yPercent: 88, widthPercent: 15, heightPercent: 3 },
      ],
    })
    const fields = await prisma.airSignField.findMany({ where: { envelopeId: envelopeId! } })
    assert(fields.length === 3, `expected 3 fields, got ${fields.length}`)
  })

  // Test 4: Verify signing token lookup
  await test('Look up signer by token', async () => {
    const signer = await prisma.airSignSigner.findUnique({ where: { token: signer1Token! }, include: { envelope: true } })
    assert(signer !== null, 'signer should exist')
    assert(signer!.name === 'John Buyer', 'wrong signer name')
    assert(signer!.envelope.id === envelopeId, 'wrong envelope')
  })

  // Test 5: Simulate signing
  await test('Sign as signer 1 (buyer)', async () => {
    const signer = await prisma.airSignSigner.findUnique({ where: { token: signer1Token! } })
    await prisma.airSignSigner.update({
      where: { id: signer!.id },
      data: { signedAt: new Date(), ipAddress: '127.0.0.1', userAgent: 'test-script' },
    })

    // Fill fields assigned to this signer
    const signerFields = await prisma.airSignField.findMany({
      where: { envelopeId: envelopeId!, signerId: signer!.id },
    })
    for (const f of signerFields) {
      await prisma.airSignField.update({
        where: { id: f.id },
        data: { value: 'John Buyer', filledAt: new Date() },
      })
    }

    const updated = await prisma.airSignSigner.findUnique({ where: { token: signer1Token! } })
    assert(updated!.signedAt !== null, 'signedAt should be set')
  })

  // Test 6: Verify seal function works
  await test('Seal PDF produces non-empty buffer', async () => {
    // Create a minimal test PDF
    const { PDFDocument } = await import('pdf-lib')
    const pdfDoc = await PDFDocument.create()
    pdfDoc.addPage([612, 792])
    const testPdfBytes = await pdfDoc.save()
    const testBuffer = Buffer.from(testPdfBytes)

    const sealed = await sealPdf(
      new Uint8Array(testPdfBytes),
      [],  // no fields in this test
      [
        { action: 'signed', signerName: 'John Buyer', timestamp: new Date().toISOString(), ipAddress: '127.0.0.1' },
        { action: 'signed', signerName: 'Jane Seller', timestamp: new Date().toISOString(), ipAddress: '192.168.1.1' },
      ],
      'Test Agreement'
    )
    assert(sealed.length > testBuffer.length, `sealed (${sealed.length}) should be larger than original (${testBuffer.length})`)
  })

  // Test 7: Audit event creation
  await test('Create audit event', async () => {
    await prisma.airSignAuditEvent.create({
      data: {
        envelopeId: envelopeId!,
        action: 'test_event',
        metadata: { test: true },
      },
    })
    const events = await prisma.airSignAuditEvent.findMany({ where: { envelopeId: envelopeId! } })
    assert(events.length >= 1, 'should have at least 1 event')
  })

  // Cleanup
  console.log('\n  Cleaning up test data...')
  if (envelopeId) {
    await prisma.airSignAuditEvent.deleteMany({ where: { envelopeId } })
    await prisma.airSignField.deleteMany({ where: { envelopeId } })
    await prisma.airSignSigner.deleteMany({ where: { envelopeId } })
    await prisma.airSignEnvelope.delete({ where: { id: envelopeId } })
  }
  for (const item of cleanup) {
    const [type, id] = item.split(':')
    if (type === 'user') await prisma.user.delete({ where: { id } }).catch(() => {})
  }

  console.log(`\n═══ Results: ${passed} passed, ${failed} failed ═══\n`)
  await prisma.$disconnect()
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(console.error)
