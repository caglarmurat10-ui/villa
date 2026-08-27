import MetaConnections from "@/components/MetaConnections";
import SocialOperationsCenter from "@/components/SocialOperationsCenter";
import { listMetaAccounts } from "@/lib/meta-store";

export const dynamic = "force-dynamic";

type SearchParams = { meta_error?: string | string[]; meta_connected?: string | string[] };
const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export default async function SocialPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const accounts = await listMetaAccounts();
  const error = one(params.meta_error);
  const connected = one(params.meta_connected);
  return <>
    {error ? <div style={{maxWidth:1250,margin:"18px auto 0",padding:14,border:"1px solid #ef4444",borderRadius:14,background:"#450a0a",color:"#fecaca"}} role="alert"><strong>Instagram bağlantısı tamamlanamadı</strong><p>{error}</p></div> : null}
    {connected === "Destan" || connected === "Safira" ? <div style={{maxWidth:1250,margin:"18px auto 0",padding:14,border:"1px solid #22c55e",borderRadius:14,background:"#052e16",color:"#bbf7d0"}} role="status">Villa {connected} Instagram hesabı bağlandı.</div> : null}
    <MetaConnections initialAccounts={accounts} />
    <SocialOperationsCenter accounts={accounts} />
  </>;
}
