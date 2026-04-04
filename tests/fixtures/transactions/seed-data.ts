/**
 * AIRE Test Data — 10 Louisiana Transactions
 * Real addresses, realistic parties, proper LREC timelines.
 * Run with: npx tsx tests/fixtures/transactions/seed-data.ts
 */

import { PrismaClient, TransactionStatus, Tier } from "@prisma/client";

const prisma = new PrismaClient();

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

const TEST_USER = {
  clerkId: "test_clerk_qa_001",
  email: "caleb@aireintel.org",
  firstName: "Caleb",
  lastName: "Jackson",
  tier: Tier.PRO,
};

interface TxFixture {
  propertyAddress: string;
  propertyCity: string;
  propertyZip: string;
  propertyType: string;
  mlsNumber: string;
  listPrice: number;
  offerPrice: number;
  acceptedPrice: number;
  status: TransactionStatus;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  sellerName: string;
  sellerEmail: string;
  sellerPhone: string;
  lenderName: string;
  titleCompany: string;
  contractDate: Date;
  inspectionDeadline: Date;
  appraisalDeadline: Date;
  financingDeadline: Date;
  closingDate: Date;
}

const TRANSACTIONS: TxFixture[] = [
  {
    propertyAddress: "1532 Walnut Street",
    propertyCity: "Jackson",
    propertyZip: "70748",
    propertyType: "residential",
    mlsNumber: "2026-BR-10441",
    listPrice: 170000,
    offerPrice: 165000,
    acceptedPrice: 168000,
    status: TransactionStatus.ACTIVE,
    buyerName: "Haley Courtney & Michael Courtney",
    buyerEmail: "hcourtney@gmail.com",
    buyerPhone: "225-555-0101",
    sellerName: "Estate of Margaret Henderson",
    sellerEmail: "henderson.estate@gmail.com",
    sellerPhone: "225-555-0102",
    lenderName: "GMFS Mortgage",
    titleCompany: "Ironclad Title, LLC",
    contractDate: new Date(),
    inspectionDeadline: daysFromNow(10),
    appraisalDeadline: daysFromNow(18),
    financingDeadline: daysFromNow(21),
    closingDate: daysFromNow(45),
  },
  {
    propertyAddress: "8421 Highland Road",
    propertyCity: "Baton Rouge",
    propertyZip: "70808",
    propertyType: "residential",
    mlsNumber: "2026-BR-10502",
    listPrice: 285000,
    offerPrice: 280000,
    acceptedPrice: 282000,
    status: TransactionStatus.PENDING_INSPECTION,
    buyerName: "David Tran",
    buyerEmail: "dtran.br@gmail.com",
    buyerPhone: "225-555-0201",
    sellerName: "Patricia & Robert Fontenot",
    sellerEmail: "fontenot.pr@gmail.com",
    sellerPhone: "225-555-0202",
    lenderName: "Assurance Financial",
    titleCompany: "First American Title",
    contractDate: daysFromNow(-5),
    inspectionDeadline: daysFromNow(5),
    appraisalDeadline: daysFromNow(13),
    financingDeadline: daysFromNow(16),
    closingDate: daysFromNow(40),
  },
  {
    propertyAddress: "2200 Perkins Road",
    propertyCity: "Baton Rouge",
    propertyZip: "70808",
    propertyType: "residential",
    mlsNumber: "2026-BR-10389",
    listPrice: 425000,
    offerPrice: 415000,
    acceptedPrice: 420000,
    status: TransactionStatus.PENDING_APPRAISAL,
    buyerName: "Jennifer Arceneaux",
    buyerEmail: "j.arceneaux@outlook.com",
    buyerPhone: "225-555-0301",
    sellerName: "Thomas & Linda Boudreaux",
    sellerEmail: "boudreaux.tl@gmail.com",
    sellerPhone: "225-555-0302",
    lenderName: "Origin Bank",
    titleCompany: "Stewart Title Guaranty",
    contractDate: daysFromNow(-12),
    inspectionDeadline: daysFromNow(-2),
    appraisalDeadline: daysFromNow(3),
    financingDeadline: daysFromNow(9),
    closingDate: daysFromNow(33),
  },
  {
    propertyAddress: "5834 Guice Drive",
    propertyCity: "Baton Rouge",
    propertyZip: "70811",
    propertyType: "residential",
    mlsNumber: "2026-BR-09987",
    listPrice: 160000,
    offerPrice: 160000,
    acceptedPrice: 160000,
    status: TransactionStatus.CLOSED,
    buyerName: "Marcus Williams",
    buyerEmail: "mwilliams.br@gmail.com",
    buyerPhone: "225-555-0401",
    sellerName: "Cynthia Mays",
    sellerEmail: "cmays@yahoo.com",
    sellerPhone: "225-555-0402",
    lenderName: "Red River Bank",
    titleCompany: "Ironclad Title, LLC",
    contractDate: daysFromNow(-60),
    inspectionDeadline: daysFromNow(-50),
    appraisalDeadline: daysFromNow(-42),
    financingDeadline: daysFromNow(-39),
    closingDate: daysFromNow(-15),
  },
  {
    propertyAddress: "1010 Convention Street",
    propertyCity: "Baton Rouge",
    propertyZip: "70802",
    propertyType: "commercial",
    mlsNumber: "2026-BR-10601",
    listPrice: 550000,
    offerPrice: 520000,
    acceptedPrice: 535000,
    status: TransactionStatus.PENDING_FINANCING,
    buyerName: "Bayou Capital Partners, LLC",
    buyerEmail: "acquisitions@bayoucap.com",
    buyerPhone: "225-555-0501",
    sellerName: "DG Commercial Holdings",
    sellerEmail: "dispositions@dgcommercial.com",
    sellerPhone: "225-555-0502",
    lenderName: "b1BANK",
    titleCompany: "Fidelity National Title",
    contractDate: daysFromNow(-15),
    inspectionDeadline: daysFromNow(-5),
    appraisalDeadline: daysFromNow(0),
    financingDeadline: daysFromNow(6),
    closingDate: daysFromNow(30),
  },
  {
    propertyAddress: "4715 Bluebonnet Boulevard",
    propertyCity: "Baton Rouge",
    propertyZip: "70809",
    propertyType: "residential",
    mlsNumber: "2026-BR-10722",
    listPrice: 315000,
    offerPrice: 310000,
    acceptedPrice: 312000,
    status: TransactionStatus.DRAFT,
    buyerName: "Ashley & Ryan Guidry",
    buyerEmail: "guidry.ar@gmail.com",
    buyerPhone: "225-555-0601",
    sellerName: "Jerome Landry",
    sellerEmail: "jlandry55@gmail.com",
    sellerPhone: "225-555-0602",
    lenderName: "GMFS Mortgage",
    titleCompany: "Ironclad Title, LLC",
    contractDate: daysFromNow(0),
    inspectionDeadline: daysFromNow(10),
    appraisalDeadline: daysFromNow(18),
    financingDeadline: daysFromNow(21),
    closingDate: daysFromNow(45),
  },
  {
    propertyAddress: "742 Steele Boulevard",
    propertyCity: "Baton Rouge",
    propertyZip: "70806",
    propertyType: "residential",
    mlsNumber: "2026-BR-10288",
    listPrice: 195000,
    offerPrice: 192000,
    acceptedPrice: 193500,
    status: TransactionStatus.CLOSING,
    buyerName: "Natasha Pierre",
    buyerEmail: "n.pierre@outlook.com",
    buyerPhone: "225-555-0701",
    sellerName: "William & Donna Hebert",
    sellerEmail: "hebert.wd@gmail.com",
    sellerPhone: "225-555-0702",
    lenderName: "Assurance Financial",
    titleCompany: "First American Title",
    contractDate: daysFromNow(-35),
    inspectionDeadline: daysFromNow(-25),
    appraisalDeadline: daysFromNow(-17),
    financingDeadline: daysFromNow(-14),
    closingDate: daysFromNow(3),
  },
  {
    propertyAddress: "15620 Old Hammond Highway",
    propertyCity: "Baton Rouge",
    propertyZip: "70816",
    propertyType: "residential",
    mlsNumber: "2026-BR-10855",
    listPrice: 230000,
    offerPrice: 225000,
    acceptedPrice: 227500,
    status: TransactionStatus.ACTIVE,
    buyerName: "Christopher & Amanda Dugas",
    buyerEmail: "dugas.ca@gmail.com",
    buyerPhone: "225-555-0801",
    sellerName: "Estate of Roland Comeaux",
    sellerEmail: "comeaux.estate@gmail.com",
    sellerPhone: "225-555-0802",
    lenderName: "Origin Bank",
    titleCompany: "Stewart Title Guaranty",
    contractDate: daysFromNow(-2),
    inspectionDeadline: daysFromNow(8),
    appraisalDeadline: daysFromNow(16),
    financingDeadline: daysFromNow(19),
    closingDate: daysFromNow(43),
  },
  {
    propertyAddress: "3344 Dalrymple Drive",
    propertyCity: "Baton Rouge",
    propertyZip: "70802",
    propertyType: "residential",
    mlsNumber: "2026-BR-10190",
    listPrice: 475000,
    offerPrice: 460000,
    acceptedPrice: 468000,
    status: TransactionStatus.PENDING_INSPECTION,
    buyerName: "Dr. Simone Baptiste",
    buyerEmail: "sbaptiste@lsu.edu",
    buyerPhone: "225-555-0901",
    sellerName: "Katherine & Paul Mouton",
    sellerEmail: "mouton.kp@gmail.com",
    sellerPhone: "225-555-0902",
    lenderName: "Red River Bank",
    titleCompany: "Fidelity National Title",
    contractDate: daysFromNow(-3),
    inspectionDeadline: daysFromNow(7),
    appraisalDeadline: daysFromNow(15),
    financingDeadline: daysFromNow(18),
    closingDate: daysFromNow(42),
  },
  {
    propertyAddress: "901 Lobdell Avenue",
    propertyCity: "Baton Rouge",
    propertyZip: "70806",
    propertyType: "residential",
    mlsNumber: "2026-BR-10033",
    listPrice: 140000,
    offerPrice: 138000,
    acceptedPrice: 139000,
    status: TransactionStatus.CANCELLED,
    buyerName: "Derek Johnson",
    buyerEmail: "djohnson.br@gmail.com",
    buyerPhone: "225-555-1001",
    sellerName: "Angela & Charles Broussard",
    sellerEmail: "broussard.ac@gmail.com",
    sellerPhone: "225-555-1002",
    lenderName: "GMFS Mortgage",
    titleCompany: "Ironclad Title, LLC",
    contractDate: daysFromNow(-45),
    inspectionDeadline: daysFromNow(-35),
    appraisalDeadline: daysFromNow(-27),
    financingDeadline: daysFromNow(-24),
    closingDate: daysFromNow(-5),
  },
];

const DEADLINES_PER_TX = [
  { name: "Inspection Deadline", field: "inspectionDeadline" as const },
  { name: "Appraisal Deadline", field: "appraisalDeadline" as const },
  { name: "Financing Contingency", field: "financingDeadline" as const },
  { name: "Closing Date", field: "closingDate" as const },
];

const DOCUMENTS_TX1 = [
  { name: "LREC 101 - Purchase Agreement - 1532 Walnut St.pdf", type: "purchase_agreement", category: "mandatory" },
  { name: "LREC 102 - Addendum - Repair Request.pdf", type: "inspection_response", category: "addendum" },
  { name: "Inspection Report - 1532 Walnut St.pdf", type: "inspection_response", category: "addendum" },
  { name: "Appraisal Report - 1532 Walnut St.pdf", type: "other", category: "additional" },
  { name: "Clear to Close - Courtney.pdf", type: "other", category: "additional" },
  { name: "Act of Sale - 1532 Walnut St.pdf", type: "contract", category: "mandatory" },
  { name: "Property Disclosure - Henderson Estate.pdf", type: "property_disclosure", category: "mandatory" },
  { name: "Agency Disclosure - AIRE Realtors.pdf", type: "agency_disclosure", category: "mandatory" },
  { name: "Lead Paint Disclosure - 1532 Walnut.pdf", type: "lead_paint", category: "federal" },
  { name: "Home Warranty Disclosure.pdf", type: "home_warranty", category: "additional" },
];

const CONTACTS = [
  { firstName: "Haley", lastName: "Courtney", email: "hcourtney@gmail.com", phone: "225-555-0101", type: "BUYER", source: "referral", neighborhood: "Jackson", parish: "East Feliciana", priceRange: "$150K-$200K", timeline: "30-45 days" },
  { firstName: "Michael", lastName: "Courtney", email: "mcourtney@gmail.com", phone: "225-555-0103", type: "BUYER", source: "referral", neighborhood: "Jackson", parish: "East Feliciana", priceRange: "$150K-$200K", timeline: "30-45 days" },
  { firstName: "David", lastName: "Tran", email: "dtran.br@gmail.com", phone: "225-555-0201", type: "BUYER", source: "zillow", neighborhood: "Highland", parish: "East Baton Rouge", priceRange: "$250K-$300K", timeline: "60 days" },
  { firstName: "Jennifer", lastName: "Arceneaux", email: "j.arceneaux@outlook.com", phone: "225-555-0301", type: "BUYER", source: "open_house", neighborhood: "Perkins", parish: "East Baton Rouge", priceRange: "$400K-$450K", timeline: "45 days" },
  { firstName: "Marcus", lastName: "Williams", email: "mwilliams.br@gmail.com", phone: "225-555-0401", type: "PAST_CLIENT", source: "sign_call", neighborhood: "Scotlandville", parish: "East Baton Rouge", priceRange: "$140K-$170K", timeline: "closed" },
  { firstName: "Ashley", lastName: "Guidry", email: "guidry.ar@gmail.com", phone: "225-555-0601", type: "LEAD", source: "instagram", neighborhood: "Bluebonnet", parish: "East Baton Rouge", priceRange: "$280K-$330K", timeline: "just looking" },
  { firstName: "Ryan", lastName: "Guidry", email: "rguidry@gmail.com", phone: "225-555-0603", type: "LEAD", source: "instagram", neighborhood: "Bluebonnet", parish: "East Baton Rouge", priceRange: "$280K-$330K", timeline: "just looking" },
  { firstName: "Natasha", lastName: "Pierre", email: "n.pierre@outlook.com", phone: "225-555-0701", type: "BUYER", source: "referral", neighborhood: "Mid City", parish: "East Baton Rouge", priceRange: "$180K-$210K", timeline: "30 days" },
  { firstName: "Christopher", lastName: "Dugas", email: "dugas.ca@gmail.com", phone: "225-555-0801", type: "BUYER", source: "zillow", neighborhood: "Old Hammond", parish: "East Baton Rouge", priceRange: "$200K-$250K", timeline: "45 days" },
  { firstName: "Amanda", lastName: "Dugas", email: "adugas@gmail.com", phone: "225-555-0804", type: "BUYER", source: "zillow", neighborhood: "Old Hammond", parish: "East Baton Rouge", priceRange: "$200K-$250K", timeline: "45 days" },
  { firstName: "Simone", lastName: "Baptiste", email: "sbaptiste@lsu.edu", phone: "225-555-0901", type: "BUYER", source: "referral", neighborhood: "Garden District", parish: "East Baton Rouge", priceRange: "$450K-$500K", timeline: "60 days" },
  { firstName: "Derek", lastName: "Johnson", email: "djohnson.br@gmail.com", phone: "225-555-1001", type: "LEAD", source: "open_house", neighborhood: "Mid City", parish: "East Baton Rouge", priceRange: "$120K-$150K", timeline: "cancelled" },
  { firstName: "Patricia", lastName: "Fontenot", email: "fontenot.pr@gmail.com", phone: "225-555-0202", type: "SELLER", source: "referral", neighborhood: "Highland", parish: "East Baton Rouge", priceRange: "$280K-$300K", timeline: "listed" },
  { firstName: "Thomas", lastName: "Boudreaux", email: "boudreaux.tl@gmail.com", phone: "225-555-0302", type: "SELLER", source: "referral", neighborhood: "Perkins", parish: "East Baton Rouge", priceRange: "$400K-$450K", timeline: "listed" },
  { firstName: "Cynthia", lastName: "Mays", email: "cmays@yahoo.com", phone: "225-555-0402", type: "PAST_CLIENT", source: "sign_call", neighborhood: "Scotlandville", parish: "East Baton Rouge", priceRange: "$150K-$170K", timeline: "sold" },
  { firstName: "Jerome", lastName: "Landry", email: "jlandry55@gmail.com", phone: "225-555-0602", type: "SELLER", source: "referral", neighborhood: "Bluebonnet", parish: "East Baton Rouge", priceRange: "$300K-$320K", timeline: "listed" },
  { firstName: "William", lastName: "Hebert", email: "hebert.wd@gmail.com", phone: "225-555-0702", type: "SELLER", source: "referral", neighborhood: "Mid City", parish: "East Baton Rouge", priceRange: "$185K-$200K", timeline: "closing" },
  { firstName: "Katherine", lastName: "Mouton", email: "mouton.kp@gmail.com", phone: "225-555-0902", type: "SELLER", source: "referral", neighborhood: "Garden District", parish: "East Baton Rouge", priceRange: "$460K-$480K", timeline: "listed" },
  { firstName: "Angela", lastName: "Broussard", email: "broussard.ac@gmail.com", phone: "225-555-1002", type: "SELLER", source: "referral", neighborhood: "Mid City", parish: "East Baton Rouge", priceRange: "$130K-$145K", timeline: "cancelled" },
  { firstName: "Sarah", lastName: "Thibodaux", email: "s.thibodaux@gmail.com", phone: "225-555-1101", type: "REFERRAL_SOURCE", source: "referral", neighborhood: "Prairieville", parish: "Ascension", priceRange: "", timeline: "" },
  { firstName: "Mike", lastName: "Leger", email: "mleger@gmfsmortgage.com", phone: "225-555-1201", type: "VENDOR", source: "referral", neighborhood: "", parish: "East Baton Rouge", priceRange: "", timeline: "" },
  { firstName: "Tonya", lastName: "Washington", email: "twashington@ironcladtitle.com", phone: "225-555-1301", type: "VENDOR", source: "referral", neighborhood: "", parish: "East Baton Rouge", priceRange: "", timeline: "" },
  { firstName: "Brandon", lastName: "Lemoine", email: "blemoine@firstam.com", phone: "225-555-1401", type: "VENDOR", source: "referral", neighborhood: "", parish: "East Baton Rouge", priceRange: "", timeline: "" },
  { firstName: "Lisa", lastName: "Comeaux", email: "lcomeaux@originbank.com", phone: "225-555-1501", type: "VENDOR", source: "referral", neighborhood: "", parish: "East Baton Rouge", priceRange: "", timeline: "" },
  { firstName: "James", lastName: "Broussard", email: "jbroussard.inspect@gmail.com", phone: "225-555-1601", type: "VENDOR", source: "referral", neighborhood: "", parish: "East Baton Rouge", priceRange: "", timeline: "" },
  { firstName: "Rachel", lastName: "Domingue", email: "rdomingue@gmail.com", phone: "225-555-1701", type: "LEAD", source: "instagram", neighborhood: "Denham Springs", parish: "Livingston", priceRange: "$180K-$220K", timeline: "90 days" },
  { firstName: "Carlos", lastName: "Martinez", email: "cmartinez.br@gmail.com", phone: "225-555-1801", type: "LEAD", source: "zillow", neighborhood: "Gonzales", parish: "Ascension", priceRange: "$200K-$260K", timeline: "60-90 days" },
  { firstName: "Emily", lastName: "Richard", email: "erichard@outlook.com", phone: "225-555-1901", type: "LEAD", source: "open_house", neighborhood: "Central", parish: "East Baton Rouge", priceRange: "$250K-$300K", timeline: "just looking" },
  { firstName: "Andre", lastName: "Green", email: "agreen.realtor@gmail.com", phone: "225-555-2001", type: "REFERRAL_SOURCE", source: "referral", neighborhood: "", parish: "East Baton Rouge", priceRange: "", timeline: "" },
  { firstName: "Megan", lastName: "Blanchard", email: "mblanchard@gmail.com", phone: "225-555-2101", type: "LEAD", source: "sign_call", neighborhood: "Baker", parish: "East Baton Rouge", priceRange: "$100K-$140K", timeline: "30-60 days" },
];

async function seed() {
  console.log("🌱 Seeding AIRE test data...\n");

  // 1. Create or find test user
  const user = await prisma.user.upsert({
    where: { clerkId: TEST_USER.clerkId },
    update: {},
    create: TEST_USER,
  });
  console.log(`✅ User: ${user.firstName} ${user.lastName} (${user.id})`);

  // 2. Create 10 transactions with deadlines
  for (let i = 0; i < TRANSACTIONS.length; i++) {
    const tx = TRANSACTIONS[i];
    const transaction = await prisma.transaction.create({
      data: {
        userId: user.id,
        propertyAddress: tx.propertyAddress,
        propertyCity: tx.propertyCity,
        propertyState: "LA",
        propertyZip: tx.propertyZip,
        propertyType: tx.propertyType,
        mlsNumber: tx.mlsNumber,
        listPrice: tx.listPrice,
        offerPrice: tx.offerPrice,
        acceptedPrice: tx.acceptedPrice,
        status: tx.status,
        buyerName: tx.buyerName,
        buyerEmail: tx.buyerEmail,
        buyerPhone: tx.buyerPhone,
        sellerName: tx.sellerName,
        sellerEmail: tx.sellerEmail,
        sellerPhone: tx.sellerPhone,
        lenderName: tx.lenderName,
        titleCompany: tx.titleCompany,
        contractDate: tx.contractDate,
        inspectionDeadline: tx.inspectionDeadline,
        appraisalDeadline: tx.appraisalDeadline,
        financingDeadline: tx.financingDeadline,
        closingDate: tx.closingDate,
      },
    });

    // Create deadline records
    for (const dl of DEADLINES_PER_TX) {
      const dueDate = tx[dl.field];
      await prisma.deadline.create({
        data: {
          userId: user.id,
          transactionId: transaction.id,
          name: dl.name,
          dueDate,
          completedAt: dueDate < new Date() ? dueDate : null,
        },
      });
    }

    // Create documents for TX #1 (1532 Walnut St)
    if (i === 0) {
      for (const doc of DOCUMENTS_TX1) {
        await prisma.document.create({
          data: {
            transactionId: transaction.id,
            name: doc.name,
            type: doc.type,
            category: doc.category,
            checklistStatus: "uploaded",
          },
        });
      }
      console.log(`  📄 ${DOCUMENTS_TX1.length} documents created for TX #1`);
    }

    console.log(`✅ TX ${i + 1}: ${tx.propertyAddress}, ${tx.propertyCity} — ${tx.status}`);
  }

  // 3. Create 30 contacts
  for (const c of CONTACTS) {
    await prisma.contact.create({
      data: {
        agentId: user.id,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email || undefined,
        phone: c.phone || undefined,
        type: c.type,
        source: c.source || undefined,
        neighborhood: c.neighborhood || undefined,
        parish: c.parish || undefined,
        priceRange: c.priceRange || undefined,
        timeline: c.timeline || undefined,
        relationshipScore: c.type === "PAST_CLIENT" ? 85 : c.type === "BUYER" ? 70 : c.type === "SELLER" ? 65 : c.type === "VENDOR" ? 50 : c.type === "REFERRAL_SOURCE" ? 60 : 40,
        lastContactedAt: c.type === "PAST_CLIENT" ? daysFromNow(-30) : c.type === "LEAD" ? daysFromNow(-7) : daysFromNow(-3),
      },
    });
  }
  console.log(`✅ ${CONTACTS.length} contacts created`);

  // Summary
  const txCount = await prisma.transaction.count();
  const dlCount = await prisma.deadline.count();
  const docCount = await prisma.document.count();
  const contactCount = await prisma.contact.count();

  console.log(`\n🎉 Seed complete!`);
  console.log(`   Transactions: ${txCount}`);
  console.log(`   Deadlines: ${dlCount}`);
  console.log(`   Documents: ${docCount}`);
  console.log(`   Contacts: ${contactCount}`);

  await prisma.$disconnect();
}

seed().catch((e) => {
  console.error("❌ Seed failed:", e);
  prisma.$disconnect();
  process.exit(1);
});
