import { NextResponse } from "next/server";
import { scrapeLeads } from "@/lib/scraper";
import { insertLeads } from "@/lib/store";
import { getAuthenticatedUserId } from "@/lib/auth";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rawBody = await request.text();
    let body: Record<string, unknown> = {};

    if (rawBody.trim()) {
      try {
        body = JSON.parse(rawBody) as Record<string, unknown>;
      } catch {
        return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
      }
    }

    const city = String(body.city ?? "").trim();
    const businessType = String(body.businessType ?? "").trim();
    const investorCategory = String(body.investorCategory ?? "DISTRESSED_SELLERS").trim().toUpperCase();
    const targetPropertyType = String(body.targetPropertyType ?? "").trim();

    if (!city || !businessType) {
      return NextResponse.json({ error: "City and businessType are required." }, { status: 400 });
    }

    const minRating = Number(body.minRating ?? 0);
    const includeNoWebsiteOnly = Boolean(body.includeNoWebsiteOnly ?? false);
    const { leads, diagnostics } = await scrapeLeads({
      city,
      businessType,
      minRating: Number.isFinite(minRating) ? minRating : 0,
      includeNoWebsiteOnly,
      investorCategory: investorCategory as Parameters<typeof scrapeLeads>[0]["investorCategory"],
      targetPropertyType,
    });
    const inserted = await insertLeads(userId, leads);

    return NextResponse.json({ inserted, fetched: leads.length, diagnostics });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to scrape leads.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
