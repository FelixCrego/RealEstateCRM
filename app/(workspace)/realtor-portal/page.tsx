import { RealtorPortalManager } from "@/components/realtor-portal/realtor-portal-manager";
import { AUTH_BYPASS_ENABLED, getAuthenticatedUserId } from "@/lib/auth";
import { ensureRealtorPortalTestLead, listClaimableLeads, listLeads } from "@/lib/store";

export default async function RealtorPortalPage() {
  const userId = await getAuthenticatedUserId();
  let leads = [] as Awaited<ReturnType<typeof listClaimableLeads>>;

  try {
    const testLead = await ensureRealtorPortalTestLead();
    const baseLeads = AUTH_BYPASS_ENABLED ? await listClaimableLeads(200) : userId ? await listLeads(userId) : await listClaimableLeads(200);
    leads = [testLead, ...baseLeads.filter((lead) => lead.id !== testLead.id)];
  } catch {
    leads = [];
  }

  return <RealtorPortalManager leads={leads} />;
}
