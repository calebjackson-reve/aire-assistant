/**
 * AIRE Intelligence — Louisiana Contract Addendum Templates
 * Fills Louisiana-specific real estate addendum templates with transaction data.
 * Templates based on LREC (Louisiana Real Estate Commission) standard forms.
 */

export interface AddendumData {
  // Transaction info
  propertyAddress: string;
  propertyCity?: string;
  propertyState?: string;
  propertyZip?: string;

  // Parties
  buyerName: string;
  sellerName: string;

  // Contract reference
  contractDate: string;
  originalPrice?: number;

  // Addendum-specific fields
  addendumType: AddendumType;
  changes: Record<string, string>;
}

export type AddendumType =
  | "price_reduction"
  | "closing_extension"
  | "repair_request"
  | "inspection_response"
  | "financing_contingency"
  | "appraisal_contingency"
  | "general";

interface TemplateField {
  key: string;
  label: string;
  required: boolean;
  placeholder: string;
}

// Louisiana addendum template definitions
const TEMPLATES: Record<AddendumType, { title: string; fields: TemplateField[]; body: string }> = {
  price_reduction: {
    title: "Addendum — Price Reduction",
    fields: [
      { key: "newPrice", label: "New Purchase Price", required: true, placeholder: "$0.00" },
      { key: "reason", label: "Reason for Reduction", required: false, placeholder: "Based on appraisal / inspection findings" },
    ],
    body: `ADDENDUM TO PURCHASE AGREEMENT

Property: {{propertyAddress}}, {{propertyCity}}, {{propertyState}} {{propertyZip}}
Date of Original Agreement: {{contractDate}}
Buyer: {{buyerName}}
Seller: {{sellerName}}

The parties agree to amend the Purchase Agreement as follows:

1. PRICE REDUCTION: The purchase price is hereby reduced from {{originalPrice}} to {{newPrice}}.
{{#reason}}
2. REASON: {{reason}}
{{/reason}}
3. All other terms and conditions of the original Purchase Agreement remain in full force and effect.

This Addendum is hereby made a part of the above-referenced Purchase Agreement.

Buyer Signature: _________________________ Date: __________
Seller Signature: ________________________ Date: __________`,
  },

  closing_extension: {
    title: "Addendum — Closing Date Extension",
    fields: [
      { key: "originalClosingDate", label: "Original Closing Date", required: true, placeholder: "MM/DD/YYYY" },
      { key: "newClosingDate", label: "New Closing Date", required: true, placeholder: "MM/DD/YYYY" },
      { key: "reason", label: "Reason for Extension", required: false, placeholder: "Lender processing delays" },
    ],
    body: `ADDENDUM TO PURCHASE AGREEMENT — CLOSING DATE EXTENSION

Property: {{propertyAddress}}, {{propertyCity}}, {{propertyState}} {{propertyZip}}
Date of Original Agreement: {{contractDate}}
Buyer: {{buyerName}}
Seller: {{sellerName}}

The parties agree to amend the Purchase Agreement as follows:

1. CLOSING DATE EXTENSION: The Act of Sale (closing) date is hereby extended from {{originalClosingDate}} to {{newClosingDate}}.
{{#reason}}
2. REASON: {{reason}}
{{/reason}}
3. All other terms and conditions of the original Purchase Agreement remain unchanged.

Buyer Signature: _________________________ Date: __________
Seller Signature: ________________________ Date: __________`,
  },

  repair_request: {
    title: "Addendum — Buyer's Repair Request",
    fields: [
      { key: "repairs", label: "Requested Repairs", required: true, placeholder: "1. Repair roof leak... 2. Replace HVAC filter..." },
      { key: "deadline", label: "Repair Completion Deadline", required: true, placeholder: "MM/DD/YYYY" },
      { key: "estimatedCost", label: "Estimated Cost", required: false, placeholder: "$0.00" },
    ],
    body: `ADDENDUM TO PURCHASE AGREEMENT — BUYER'S REPAIR REQUEST

Property: {{propertyAddress}}, {{propertyCity}}, {{propertyState}} {{propertyZip}}
Date of Original Agreement: {{contractDate}}
Buyer: {{buyerName}}
Seller: {{sellerName}}

Based on the property inspection, Buyer requests the following repairs be completed prior to closing:

{{repairs}}

Repair Completion Deadline: {{deadline}}
{{#estimatedCost}}Estimated Cost: {{estimatedCost}}{{/estimatedCost}}

Seller shall complete all repairs using licensed contractors and provide receipts to Buyer prior to closing. All repairs shall be completed in a workmanlike manner.

Buyer Signature: _________________________ Date: __________
Seller Signature: ________________________ Date: __________`,
  },

  inspection_response: {
    title: "Addendum — Seller's Inspection Response",
    fields: [
      { key: "acceptedRepairs", label: "Accepted Repairs", required: true, placeholder: "Items seller agrees to repair" },
      { key: "rejectedRepairs", label: "Rejected Repairs", required: false, placeholder: "Items seller declines to repair" },
      { key: "creditAmount", label: "Credit in Lieu of Repairs", required: false, placeholder: "$0.00" },
    ],
    body: `ADDENDUM TO PURCHASE AGREEMENT — SELLER'S INSPECTION RESPONSE

Property: {{propertyAddress}}, {{propertyCity}}, {{propertyState}} {{propertyZip}}
Date of Original Agreement: {{contractDate}}
Buyer: {{buyerName}}
Seller: {{sellerName}}

In response to Buyer's repair request, Seller agrees as follows:

ACCEPTED REPAIRS:
{{acceptedRepairs}}

{{#rejectedRepairs}}
DECLINED REPAIRS:
{{rejectedRepairs}}
{{/rejectedRepairs}}

{{#creditAmount}}
CREDIT IN LIEU OF REPAIRS: Seller will provide a credit of {{creditAmount}} at closing in lieu of completing certain repairs.
{{/creditAmount}}

Buyer Signature: _________________________ Date: __________
Seller Signature: ________________________ Date: __________`,
  },

  financing_contingency: {
    title: "Addendum — Financing Contingency Extension",
    fields: [
      { key: "newFinancingDeadline", label: "New Financing Deadline", required: true, placeholder: "MM/DD/YYYY" },
      { key: "lenderName", label: "Lender Name", required: false, placeholder: "ABC Mortgage" },
      { key: "reason", label: "Reason", required: false, placeholder: "Additional documentation required by lender" },
    ],
    body: `ADDENDUM TO PURCHASE AGREEMENT — FINANCING CONTINGENCY EXTENSION

Property: {{propertyAddress}}, {{propertyCity}}, {{propertyState}} {{propertyZip}}
Date of Original Agreement: {{contractDate}}
Buyer: {{buyerName}}
Seller: {{sellerName}}

1. The financing contingency deadline is hereby extended to {{newFinancingDeadline}}.
{{#lenderName}}2. Lender: {{lenderName}}{{/lenderName}}
{{#reason}}3. Reason: {{reason}}{{/reason}}

All other terms remain in full force and effect.

Buyer Signature: _________________________ Date: __________
Seller Signature: ________________________ Date: __________`,
  },

  appraisal_contingency: {
    title: "Addendum — Appraisal Contingency",
    fields: [
      { key: "appraisedValue", label: "Appraised Value", required: true, placeholder: "$0.00" },
      { key: "resolution", label: "Resolution", required: true, placeholder: "reduce_price | buyer_pays_difference | split_difference | terminate" },
      { key: "newPrice", label: "New Price (if applicable)", required: false, placeholder: "$0.00" },
    ],
    body: `ADDENDUM TO PURCHASE AGREEMENT — APPRAISAL CONTINGENCY RESOLUTION

Property: {{propertyAddress}}, {{propertyCity}}, {{propertyState}} {{propertyZip}}
Date of Original Agreement: {{contractDate}}
Buyer: {{buyerName}}
Seller: {{sellerName}}

The property appraisal has been completed with an appraised value of {{appraisedValue}}.

The parties agree to the following resolution: {{resolution}}
{{#newPrice}}
The purchase price is hereby amended to {{newPrice}}.
{{/newPrice}}

All other terms remain in full force and effect.

Buyer Signature: _________________________ Date: __________
Seller Signature: ________________________ Date: __________`,
  },

  general: {
    title: "General Addendum",
    fields: [
      { key: "terms", label: "Additional Terms", required: true, placeholder: "Enter the addendum terms..." },
    ],
    body: `ADDENDUM TO PURCHASE AGREEMENT

Property: {{propertyAddress}}, {{propertyCity}}, {{propertyState}} {{propertyZip}}
Date of Original Agreement: {{contractDate}}
Buyer: {{buyerName}}
Seller: {{sellerName}}

The parties agree to the following additional terms:

{{terms}}

All other terms and conditions of the original Purchase Agreement remain in full force and effect.

Buyer Signature: _________________________ Date: __________
Seller Signature: ________________________ Date: __________`,
  },
};

/**
 * Fill a Louisiana addendum template with transaction data
 */
export function fillAddendumTemplate(data: AddendumData): {
  title: string;
  content: string;
  fields: TemplateField[];
} {
  const template = TEMPLATES[data.addendumType];
  if (!template) {
    throw new Error(`Unknown addendum type: ${data.addendumType}`);
  }

  let content = template.body;

  // Fill base transaction fields
  content = content.replace(/\{\{propertyAddress\}\}/g, data.propertyAddress);
  content = content.replace(/\{\{propertyCity\}\}/g, data.propertyCity || "Baton Rouge");
  content = content.replace(/\{\{propertyState\}\}/g, data.propertyState || "LA");
  content = content.replace(/\{\{propertyZip\}\}/g, data.propertyZip || "");
  content = content.replace(/\{\{contractDate\}\}/g, data.contractDate);
  content = content.replace(/\{\{buyerName\}\}/g, data.buyerName);
  content = content.replace(/\{\{sellerName\}\}/g, data.sellerName);
  content = content.replace(
    /\{\{originalPrice\}\}/g,
    data.originalPrice ? `$${data.originalPrice.toLocaleString()}` : "N/A"
  );

  // Fill addendum-specific change fields
  for (const [key, value] of Object.entries(data.changes)) {
    content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);

    // Handle conditional sections {{#key}}...{{/key}}
    if (value && value.trim()) {
      content = content.replace(new RegExp(`\\{\\{#${key}\\}\\}`, "g"), "");
      content = content.replace(new RegExp(`\\{\\{/${key}\\}\\}`, "g"), "");
    } else {
      content = content.replace(
        new RegExp(`\\{\\{#${key}\\}\\}[\\s\\S]*?\\{\\{/${key}\\}\\}`, "g"),
        ""
      );
    }
  }

  // Clean up any remaining unfilled conditionals
  content = content.replace(/\{\{#\w+\}\}[\s\S]*?\{\{\/\w+\}\}/g, "");
  // Clean up empty lines
  content = content.replace(/\n{3,}/g, "\n\n");

  return {
    title: template.title,
    content: content.trim(),
    fields: template.fields,
  };
}

/**
 * Get available template types and their descriptions
 */
export function getAvailableTemplates(): { type: AddendumType; title: string; fields: TemplateField[] }[] {
  return Object.entries(TEMPLATES).map(([type, template]) => ({
    type: type as AddendumType,
    title: template.title,
    fields: template.fields,
  }));
}
