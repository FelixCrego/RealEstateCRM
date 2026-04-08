import { RealtorPortalPublic } from "@/components/realtor-portal/realtor-portal-public";

export default function RealtorPortalPublicPage({
  params,
  searchParams,
}: {
  params: { leadId: string };
  searchParams: { token?: string };
}) {
  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-100 md:px-8">
      <div className="mx-auto max-w-6xl">
        <RealtorPortalPublic leadId={params.leadId} token={searchParams.token ?? ""} />
      </div>
    </main>
  );
}
