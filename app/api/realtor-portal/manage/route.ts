import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth";
import { saveLeadRealtorPortal } from "@/lib/store";

export async function POST(request: Request) {
  try {
    const userId = await getAuthenticatedUserId();

    const body = await request.json() as {
      leadId?: string;
      enabled?: boolean;
      realtorName?: string;
      realtorEmail?: string;
      realtorPhone?: string | null;
      brokerage?: string | null;
      propertyAddress?: string;
      portalNote?: string | null;
      walkthroughScheduledAt?: string | null;
      cmaUrl?: string | null;
      cmaFileName?: string | null;
      cmaNote?: string | null;
      zillowUrl?: string | null;
      zestimate?: number | null;
      rentLow?: number | null;
      rentMedium?: number | null;
      rentHigh?: number | null;
    };

    const leadId = typeof body.leadId === "string" ? body.leadId.trim() : "";
    if (!leadId) {
      return NextResponse.json({ error: "Lead id is required." }, { status: 400 });
    }

    const portal = await saveLeadRealtorPortal(userId, leadId, {
      enabled: body.enabled,
      realtorName: body.realtorName,
      realtorEmail: body.realtorEmail,
      realtorPhone: body.realtorPhone,
      brokerage: body.brokerage,
      propertyAddress: body.propertyAddress,
      portalNote: body.portalNote,
      walkthroughScheduledAt: body.walkthroughScheduledAt,
      cmaUrl: body.cmaUrl,
      cmaFileName: body.cmaFileName,
      cmaNote: body.cmaNote,
      zillowUrl: body.zillowUrl,
      zestimate: body.zestimate,
      rentLow: body.rentLow,
      rentMedium: body.rentMedium,
      rentHigh: body.rentHigh,
    });

    return NextResponse.json({ portal });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to save realtor portal." }, { status: 500 });
  }
}
