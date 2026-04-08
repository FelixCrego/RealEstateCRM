export type ToneOfVoice = "PROFESSIONAL" | "AGGRESSIVE" | "CONSULTATIVE" | "FRIENDLY";
export type UserRole = "REP" | "MANAGER" | "TEAM_LEAD" | "SUPER_ADMIN";
export type RealtorPortalWalkthroughStatus = "PENDING" | "CONFIRMED" | "RESCHEDULE_REQUESTED";
export type InvestorLeadCategory =
  | "DISTRESSED_SELLER"
  | "CASH_BUYER"
  | "WHOLESALER"
  | "AGENT"
  | "PROPERTY_MANAGER"
  | "PROBATE_ATTORNEY"
  | "EVICTION_ATTORNEY"
  | "CONTRACTOR"
  | "OFF_MARKET_LIST"
  | "GENERAL";

export type InvestorLeadProfile = {
  category: InvestorLeadCategory;
  targetPropertyType?: string | null;
  propertyAddress?: string | null;
  ownerName?: string | null;
  leadType?: string | null;
  leadScore: number;
  tags: string[];
  motivationSignals: string[];
  recommendedAction?: string | null;
  rationale?: string | null;
  sourceKind?: "GOOGLE_MAPS" | "CSV_IMPORT" | "MANUAL" | null;
};

export type BuyerProfile = {
  id: string;
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  markets: string[];
  assetTypes: string[];
  strategies: string[];
  minPrice?: number | null;
  maxPrice?: number | null;
  minLeadScore?: number | null;
  notes?: string | null;
  updatedAt: string;
};

export type RealtorPortal = {
  enabled: boolean;
  token: string;
  realtorName: string;
  realtorEmail: string;
  realtorPhone?: string | null;
  brokerage?: string | null;
  propertyAddress: string;
  portalNote?: string | null;
  walkthrough: {
    scheduledAt: string | null;
    status: RealtorPortalWalkthroughStatus;
    confirmedAt?: string | null;
    requestMessage?: string | null;
  };
  cma: {
    url: string | null;
    fileName?: string | null;
    note?: string | null;
    sentAt?: string | null;
    viewedAt?: string | null;
  };
  updatedAt: string;
};

export type LeadResearchSocialLinks = Partial<Record<"facebook" | "instagram" | "googleBusiness" | "linkedin" | "x" | "youtube" | "tiktok" | "yelp", string>> & Record<string, string | undefined>;

export type LeadResearchStructuredPayload = {
  businessName: string;
  primaryPhone: string | null;
  primaryEmail: string | null;
  logoUrl: string | null;
  brandColors: string[];
  socialLinks: LeadResearchSocialLinks;
  heroCopy: string | null;
  services: string[];
  trustSignals: string[];
  confidence: number;
  sources: string[];
};

export type LeadEnrichmentPayload = {
  summary: string;
  structured: LeadResearchStructuredPayload;
};

export type Lead = {
  id: string;
  businessName: string;
  city: string;
  businessType: string;
  phone?: string | null;
  email?: string | null;
  websiteUrl?: string | null;
  websiteStatus?: string | null;
  socialLinks?: string[];
  aiResearchSummary?: string | null;
  enrichment?: LeadEnrichmentPayload | null;
  investorProfile?: InvestorLeadProfile | null;
  sourceQuery?: string | null;
  contacts?: Array<{
    id: string;
    name: string;
    role?: string;
    phones: string[];
    emails: string[];
  }>;
  demoBooking?: {
    date?: string;
    time?: string;
    timeZone?: string;
    meetLink?: string;
    bookedAt?: string;
  } | null;
  realtorPortal?: RealtorPortal | null;
  status: "NEW" | "CONTACTED" | "IN_PROGRESS" | "CLOSED" | "DISQUALIFIED";
  deployedUrl?: string | null;
  siteStatus?: "UNBUILT" | "BUILDING" | "LIVE" | "FAILED" | null;
  vercelDeploymentId?: string | null;
  ownerId?: string | null;
  closedDealValue?: number | null;
  closedAt?: string | null;
  stripeCheckoutLink?: string | null;
  transferRequests?: { requesterId: string; requestedAt: string; status: "PENDING" | "APPROVED" | "REJECTED" }[];
  updatedAt: string;
};

export type Script = {
  id: string;
  content: string;
  type: "EMAIL" | "SMS" | "OBJECTION_RESPONSE" | "TIP";
  upvoteCount: number;
  leadId?: string;
};
