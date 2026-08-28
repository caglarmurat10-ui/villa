import MetaConnections from "@/components/MetaConnections";
import MetaDiagnostics from "@/components/MetaDiagnostics";
import SocialContentLibrary from "@/components/SocialContentLibrary";
import SocialMediaView from "@/components/SocialMediaView";
import { listMetaAccounts } from "@/lib/meta-store";
import { getMetaDiagnostic } from "@/lib/meta-diagnostics";
import { listReservations } from "@/lib/db";
import { findAvailabilityGaps } from "@/lib/social-availability";
import { listSocialPosts } from "@/lib/social-db";
import { ensureDefaultSocialPlan } from "@/lib/social-plan-seed";

export const dynamic = "force-dynamic";

function istanbulToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
}

export default async function SocialPage() {
  const seed = await ensureDefaultSocialPlan();
  const [posts, accounts, reservations] = await Promise.all([listSocialPosts(), listMetaAccounts(), listReservations()]);
  const diagnostic = await getMetaDiagnostic(accounts);
  const gaps = findAvailabilityGaps(reservations, istanbulToday());
  return <>
    <MetaDiagnostics diagnostic={diagnostic} />
    <MetaConnections initialAccounts={accounts} />
    <div style={{maxWidth:1250,margin:"12px auto",padding:"0 20px"}}>
      <div style={{marginBottom:10,padding:"10px 13px",border:"1px solid #22c55e55",borderRadius:12,background:"#071b16",color:"#bbf7d0",fontSize:11,fontWeight:700}}>
        ✓ Drive medya otomasyonu aktif · {seed.created} yeni plan eklendi, {seed.updated} mevcut plana gerçek medya bağlandı, {seed.skipped} kayıt zaten günceldi. Yeni/değişen kayıtlar insan onayı bekler.
      </div>
      <a href="/sosyal/marka" style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,padding:"14px 16px",border:"1px solid #d5aa5855",borderRadius:14,background:"linear-gradient(135deg,#13233a,#081522)",color:"#f8fafc",textDecoration:"none",fontWeight:800}}>
        <span><small style={{display:"block",color:"#d5aa58",fontSize:9,letterSpacing:1.5}}>MARKA + HEDEF KİTLE</small>Logo, Facebook kapağı, Instagram öne çıkanları ve Meta kitle merkezi</span>
        <span style={{color:"#d5aa58"}}>Aç →</span>
      </a>
    </div>
    <SocialContentLibrary />
    <SocialMediaView initialPosts={posts} availabilityGaps={gaps} />
  </>;
}
