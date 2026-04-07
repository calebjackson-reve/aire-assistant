import { PrismaClient, Tier, TransactionStatus } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding AIRE dev database...')

  // 1. Create dev user (Caleb)
  const user = await prisma.user.upsert({
    where: { clerkId: 'user_3BPsxwC2Ahn17KlWwzHwsYaWLJY' },
    update: {},
    create: {
      clerkId: 'user_3BPsxwC2Ahn17KlWwzHwsYaWLJY',
      email: 'caleb.jackson@reverealtors.com',
      firstName: 'Caleb',
      lastName: 'Jackson',
      tier: Tier.INVESTOR,
    },
  })
  console.log(`✅ User: ${user.firstName} ${user.lastName} (${user.tier})`)

  // 2. Create sample transactions (skip if address already exists for this user)
  const existingTxns = await prisma.transaction.findMany({
    where: { userId: user.id },
    select: { propertyAddress: true },
  })
  const existingAddresses = new Set(existingTxns.map(t => t.propertyAddress))

  const txnDataList = [
    {
      userId: user.id,
      propertyAddress: '5834 Guice Dr',
      propertyCity: 'Baton Rouge',
      propertyState: 'LA',
      propertyZip: '70811',
      propertyType: 'residential',
      mlsNumber: 'MLS-2026-001',
      listPrice: 165000,
      offerPrice: 160000,
      acceptedPrice: 160000,
      status: TransactionStatus.CLOSED,
      buyerName: 'Marcus Williams',
      buyerEmail: 'marcus@example.com',
      sellerName: 'James Carter',
      sellerEmail: 'james@example.com',
      lenderName: 'First Guaranty Bank',
      titleCompany: 'Red Stick Title',
      contractDate: new Date('2026-01-15'),
      inspectionDeadline: new Date('2026-01-25'),
      appraisalDeadline: new Date('2026-02-05'),
      financingDeadline: new Date('2026-02-10'),
      closingDate: new Date('2026-02-18'),
    },
    {
      userId: user.id,
      propertyAddress: '1422 Convention St',
      propertyCity: 'Baton Rouge',
      propertyState: 'LA',
      propertyZip: '70802',
      propertyType: 'residential',
      mlsNumber: 'MLS-2026-042',
      listPrice: 289000,
      offerPrice: 275000,
      acceptedPrice: 280000,
      status: TransactionStatus.PENDING_INSPECTION,
      buyerName: 'Sarah Mitchell',
      buyerEmail: 'sarah@example.com',
      sellerName: 'Robert Lewis',
      sellerEmail: 'robert@example.com',
      lenderName: 'GMFS Mortgage',
      titleCompany: 'Louisiana Title',
      contractDate: new Date('2026-03-28'),
      inspectionDeadline: new Date('2026-04-10'),
      appraisalDeadline: new Date('2026-04-18'),
      financingDeadline: new Date('2026-04-22'),
      closingDate: new Date('2026-04-30'),
    },
    {
      userId: user.id,
      propertyAddress: '8901 Highland Rd',
      propertyCity: 'Baton Rouge',
      propertyState: 'LA',
      propertyZip: '70808',
      propertyType: 'residential',
      mlsNumber: 'MLS-2026-067',
      listPrice: 425000,
      status: TransactionStatus.ACTIVE,
      sellerName: 'Patricia Green',
      sellerEmail: 'patricia@example.com',
      titleCompany: 'Pelican Title',
    },
  ]

  const txns = []
  for (const data of txnDataList) {
    if (existingAddresses.has(data.propertyAddress)) {
      console.log(`⏭️  Skipping ${data.propertyAddress} (already exists)`)
      const existing = await prisma.transaction.findFirst({
        where: { userId: user.id, propertyAddress: data.propertyAddress },
      })
      if (existing) txns.push(existing)
      continue
    }
    const txn = await prisma.transaction.create({ data })
    txns.push(txn)
  }
  console.log(`✅ Transactions: ${txns.length} total (new + existing)`)

  // 3. Create deadlines for Convention St (pending inspection) — skip if already has deadlines
  const conventionTxn = txns.find(t => t.propertyAddress === '1422 Convention St')
  if (conventionTxn) {
    const existingDeadlines = await prisma.deadline.count({
      where: { transactionId: conventionTxn.id },
    })
    if (existingDeadlines === 0) {
      const deadlines = await Promise.all([
        prisma.deadline.create({
          data: {
            userId: user.id,
            transactionId: conventionTxn.id,
            name: 'Inspection Deadline',
            dueDate: new Date('2026-04-10'),
          },
        }),
        prisma.deadline.create({
          data: {
            userId: user.id,
            transactionId: conventionTxn.id,
            name: 'Appraisal Deadline',
            dueDate: new Date('2026-04-18'),
          },
        }),
        prisma.deadline.create({
          data: {
            userId: user.id,
            transactionId: conventionTxn.id,
            name: 'Financing Contingency',
            dueDate: new Date('2026-04-22'),
          },
        }),
        prisma.deadline.create({
          data: {
            userId: user.id,
            transactionId: conventionTxn.id,
            name: 'Closing Date',
            dueDate: new Date('2026-04-30'),
          },
        }),
      ])
      console.log(`✅ Deadlines: ${deadlines.length} created`)
    } else {
      console.log(`⏭️  Deadlines already exist for Convention St (${existingDeadlines})`)
    }
  }

  // 4. Create sample contacts (skip if email already exists)
  const contactDataList = [
    {
      agentId: user.id,
      firstName: 'Marcus',
      lastName: 'Williams',
      email: 'marcus@example.com',
      phone: '225-555-0101',
      type: 'PAST_CLIENT',
      source: 'referral',
      neighborhood: 'Scotlandville',
      parish: 'East Baton Rouge',
      relationshipScore: 85,
      lastContactedAt: new Date('2026-03-15'),
      contactCount: 12,
      responseCount: 10,
    },
    {
      agentId: user.id,
      firstName: 'Sarah',
      lastName: 'Mitchell',
      email: 'sarah@example.com',
      phone: '225-555-0202',
      type: 'BUYER',
      source: 'zillow',
      neighborhood: 'Downtown',
      parish: 'East Baton Rouge',
      priceRange: '$250K-$300K',
      timeline: '30-60 days',
      relationshipScore: 72,
      lastContactedAt: new Date('2026-03-28'),
      contactCount: 6,
      responseCount: 5,
    },
    {
      agentId: user.id,
      firstName: 'David',
      lastName: 'Thompson',
      email: 'david@example.com',
      phone: '225-555-0303',
      type: 'LEAD',
      source: 'open_house',
      neighborhood: 'University Area',
      parish: 'East Baton Rouge',
      priceRange: '$400K-$500K',
      timeline: 'just looking',
      relationshipScore: 35,
      lastContactedAt: new Date('2026-02-20'),
      contactCount: 2,
      responseCount: 1,
    },
  ]

  let contactsCreated = 0
  for (const data of contactDataList) {
    const exists = await prisma.contact.findFirst({
      where: { agentId: user.id, email: data.email },
    })
    if (!exists) {
      await prisma.contact.create({ data })
      contactsCreated++
    }
  }
  console.log(`✅ Contacts: ${contactsCreated} created (${contactDataList.length - contactsCreated} skipped)`)

  // 5. Create a morning brief (skip if one exists for this date)
  const existingBrief = await prisma.morningBrief.findFirst({
    where: { userId: user.id, briefDate: new Date('2026-04-04') },
  })
  if (!existingBrief) {
    await prisma.morningBrief.create({
      data: {
        userId: user.id,
        briefDate: new Date('2026-04-04'),
        status: 'approved',
        summary: 'Good morning, Caleb. You have 2 active transactions and 1 deadline this week. Convention St inspection is due April 10. Highland Rd listing needs pricing review.',
        actionItems: JSON.parse(JSON.stringify([
          { label: 'Schedule Convention St inspection', priority: 'high', type: 'deadline' },
          { label: 'Review Highland Rd CMA', priority: 'medium', type: 'intelligence' },
          { label: 'Follow up with David Thompson', priority: 'low', type: 'relationship' },
        ])),
        deadlineData: JSON.parse(JSON.stringify({ upcoming: 4, overdue: 0 })),
        pipelineData: JSON.parse(JSON.stringify({ active: 2, totalValue: 705000 })),
        approvedAt: new Date(),
        approvedBy: 'dev_caleb',
      },
    })
    console.log('✅ Morning Brief: 1 created')
  } else {
    console.log('⏭️  Morning Brief already exists for 2026-04-04')
  }

  console.log('\n🎉 Seed complete!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
