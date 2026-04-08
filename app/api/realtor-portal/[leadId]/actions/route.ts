import { NextResponse } from "next/server";
import { updateLeadRealtorPortalFromPublic } from "@/lib/store";

export async function POST(
  request: Request,
  { params }: { params: { leadId: string } },
) {
  try {
    const body = await request.json() as {
      token?: string;
      action?: "confirm_walkthrough" | "request_reschedule" | "mark_cma_viewed";
      message?: string | null;
    };

    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token) {
      return NextResponse.json({ error: "Missing portal token." }, { status: 400 });
    }

    if (body.action !== "confirm_walkthrough" && body.action !== "request_reschedule" && body.action !== "mark_cma_viewed") {
      return NextResponse.json({ error: "Invalid portal action." }, { status: 400 });
    }

    const portal = await updateLeadRealtorPortalFromPublic(params.leadId, token, {
      action: body.action,
      message: body.message,
    });

    return NextResponse.json({ portal });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update portal." }, { status: 500 });
  }
}
