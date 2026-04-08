import { NextResponse } from "next/server";
import { getLeadRealtorPortal } from "@/lib/store";

export async function GET(
  request: Request,
  { params }: { params: { leadId: string } },
) {
  try {
    const token = new URL(request.url).searchParams.get("token")?.trim() ?? "";
    if (!token) {
      return NextResponse.json({ error: "Missing portal token." }, { status: 400 });
    }

    const portal = await getLeadRealtorPortal(params.leadId, token);
    if (!portal) {
      return NextResponse.json({ error: "Portal not found." }, { status: 404 });
    }

    return NextResponse.json({
      lead: {
        id: portal.lead.id,
        businessName: portal.lead.businessName,
        city: portal.lead.city,
      },
      portal: portal.portal,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load portal." }, { status: 500 });
  }
}
