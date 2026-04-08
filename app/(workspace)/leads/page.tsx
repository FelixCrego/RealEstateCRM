import { LeadsListView } from "@/components/leads/leads-list-view";
import { ensureRealtorPortalTestLead, listClaimableLeads, listLeads } from "@/lib/store";
import { getAuthenticatedUserId } from "@/lib/auth";

export default async function LeadsPage() {
  try {
    const userId = await getAuthenticatedUserId();
    const testLead = await ensureRealtorPortalTestLead();

    if (!userId) {
      const claimableLeads = await listClaimableLeads(200);
      const combinedLeads = [testLead, ...claimableLeads.filter((lead) => lead.id !== testLead.id)];
      return <LeadsListView leads={combinedLeads} />;
    }

    const userLeads = await listLeads(userId);
    const combinedLeads = userLeads.length > 0 ? userLeads : [testLead];
    return <LeadsListView leads={combinedLeads} />;
  } catch (error) {
    return <LeadsListView leads={[]} errorMessage={error instanceof Error ? error.message : "Failed to load leads."} />;
  }
}
