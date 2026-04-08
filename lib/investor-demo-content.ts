import { mockLeads } from "@/lib/mock-investor-crm";
import type { Lead } from "@/lib/types";

export type DemoCalendarEvent = {
  id: string;
  leadId?: string | null;
  leadName: string;
  scheduledDate: string;
  scheduledTime: string;
  eventType: "Seller Appointment" | "Investor Call" | "Realtor Walkthrough";
  meetingUrl?: string | null;
  propertyAddress?: string | null;
  sourceLabel: string;
  isDemo?: boolean;
};

function dateOffset(daysFromToday: number) {
  const next = new Date();
  next.setDate(next.getDate() + daysFromToday);
  return next.toISOString().slice(0, 10);
}

export function buildDemoOfferDeskLeads(): Lead[] {
  return mockLeads.slice(0, 5).map((lead, index) => {
    const category =
      lead.motivationSignals.includes("Probate")
        ? "DISTRESSED_SELLER"
        : lead.motivationSignals.includes("Pre-Foreclosure")
          ? "DISTRESSED_SELLER"
          : lead.motivationSignals.includes("Tax Delinquent")
            ? "OFF_MARKET_LIST"
            : "GENERAL";

    const score = Math.min(98, Math.max(55, Math.round(lead.distressScore * 0.72 + (30 - Math.min(30, lead.timelineDays)) * 0.8)));

    return {
      id: `demo-offer-${lead.id}`,
      businessName: `${lead.ownerName} Opportunity`,
      city: lead.propertyAddress.split(",")[1]?.trim() || "Target Market",
      businessType: "Off Market Residential",
      phone: lead.phone,
      email: null,
      websiteUrl: null,
      websiteStatus: "MISSING",
      socialLinks: [],
      aiResearchSummary: `${lead.ownerName} owns ${lead.propertyAddress}. Timeline is ${lead.timelineDays} days with ${lead.motivationSignals.join(", ").toLowerCase()} signals and estimated equity of ${lead.equityEstimate.toLocaleString("en-US")} dollars.`,
      enrichment: null,
      investorProfile: {
        category,
        targetPropertyType: index < 3 ? "single family" : "rental",
        propertyAddress: lead.propertyAddress,
        ownerName: lead.ownerName,
        leadType: "Off Market Property",
        leadScore: score,
        tags: [...lead.motivationSignals, lead.occupancy],
        motivationSignals: lead.motivationSignals,
        recommendedAction: lead.timelineDays <= 7 ? "Move to written cash offer immediately." : "Validate condition, timeline, and seller motivation before pricing.",
        rationale: `Demo investor scenario seeded from ${lead.county} County mock data.`,
        sourceKind: "MANUAL",
      },
      sourceQuery: `${lead.county} county distress watchlist`,
      contacts: [
        {
          id: `demo-contact-${lead.id}`,
          name: lead.ownerName,
          role: "Property Owner",
          phones: [lead.phone],
          emails: [],
        },
      ],
      demoBooking: null,
      realtorPortal: null,
      status: "NEW",
      deployedUrl: null,
      siteStatus: "UNBUILT",
      vercelDeploymentId: null,
      ownerId: "demo-user",
      closedDealValue: lead.listPriceEstimate,
      closedAt: null,
      stripeCheckoutLink: null,
      transferRequests: [],
      updatedAt: new Date().toISOString(),
    } satisfies Lead;
  });
}

export function buildDemoCalendarEvents(): DemoCalendarEvent[] {
  const seeds = mockLeads.slice(0, 4);

  return [
    {
      id: "demo-calendar-seller-1",
      leadId: null,
      leadName: `${seeds[0].ownerName} Seller Call`,
      scheduledDate: dateOffset(0),
      scheduledTime: "11:00 AM",
      eventType: "Seller Appointment",
      meetingUrl: "https://meet.google.com/demo-seller-call",
      propertyAddress: seeds[0].propertyAddress,
      sourceLabel: "Demo scenario",
      isDemo: true,
    },
    {
      id: "demo-calendar-walkthrough-1",
      leadId: null,
      leadName: `${seeds[1].ownerName} Walkthrough`,
      scheduledDate: dateOffset(1),
      scheduledTime: "2:30 PM",
      eventType: "Realtor Walkthrough",
      meetingUrl: null,
      propertyAddress: seeds[1].propertyAddress,
      sourceLabel: "Demo scenario",
      isDemo: true,
    },
    {
      id: "demo-calendar-buyer-1",
      leadId: null,
      leadName: "Ridgeway Holdings Buyer Review",
      scheduledDate: dateOffset(2),
      scheduledTime: "4:00 PM",
      eventType: "Investor Call",
      meetingUrl: "https://meet.google.com/demo-buyer-review",
      propertyAddress: seeds[2].propertyAddress,
      sourceLabel: "Demo scenario",
      isDemo: true,
    },
    {
      id: "demo-calendar-seller-2",
      leadId: null,
      leadName: `${seeds[3].ownerName} Offer Follow-Up`,
      scheduledDate: dateOffset(4),
      scheduledTime: "9:30 AM",
      eventType: "Seller Appointment",
      meetingUrl: "https://meet.google.com/demo-offer-followup",
      propertyAddress: seeds[3].propertyAddress,
      sourceLabel: "Demo scenario",
      isDemo: true,
    },
  ];
}
