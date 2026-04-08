import { NextResponse } from "next/server";
import { SCRAPE_MODES, scrapeLeads, type ScrapeMode } from "@/lib/scraper";
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

    const city = String(body.city ?? "").trim().replace(/\s+/g, " ");
    const businessType = String(body.businessType ?? "").trim().replace(/\s+/g, " ");
    const investorCategoryRaw = String(body.investorCategory ?? "DISTRESSED_SELLERS").trim().toUpperCase();
    const targetPropertyType = String(body.targetPropertyType ?? "").trim().replace(/\s+/g, " ").slice(0, 80);

    if (city.length < 2 || businessType.length < 2) {
      return NextResponse.json({ error: "City and businessType must each be at least 2 characters." }, { status: 400 });
    }

    if (!SCRAPE_MODES.includes(investorCategoryRaw as ScrapeMode)) {
      return NextResponse.json({ error: `investorCategory must be one of: ${SCRAPE_MODES.join(", ")}.` }, { status: 400 });
    }

    const minRatingRaw = Number(body.minRating ?? 0);
    const minRating = Number.isFinite(minRatingRaw) ? Math.max(0, Math.min(5, minRatingRaw)) : 0;
    const { leads, diagnostics } = await scrapeLeads({
      city,
      businessType,
      minRating,
      investorCategory: investorCategoryRaw as ScrapeMode,
      targetPropertyType,
    });
    const inserted = await insertLeads(userId, leads);

    return NextResponse.json({ inserted, fetched: leads.length, diagnostics });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to scrape leads.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
