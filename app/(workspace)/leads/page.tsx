import { LeadsListView } from "@/components/leads/leads-list-view";
import { AUTH_BYPASS_ENABLED, getAuthenticatedUserId } from "@/lib/auth";
import { buildDemoOfferDeskLeads } from "@/lib/investor-demo-content";
import { listClaimableLeads, listLeads } from "@/lib/store";

export default async function LeadsPage() {
  try {
    const userId = await getAuthenticatedUserId();

    if (AUTH_BYPASS_ENABLED) {
      const claimableLeads = await listClaimableLeads(200);
      return <LeadsListView leads={claimableLeads.length > 0 ? claimableLeads : buildDemoOfferDeskLeads()} />;
    }

    if (!userId) {
      const claimableLeads = await listClaimableLeads(200);
      return <LeadsListView leads={claimableLeads.length > 0 ? claimableLeads : buildDemoOfferDeskLeads()} />;
    }

    const userLeads = await listLeads(userId);
    return <LeadsListView leads={userLeads} />;
  } catch (error) {
    return <LeadsListView leads={[]} errorMessage={error instanceof Error ? error.message : "Failed to load leads."} />;
  }
}
