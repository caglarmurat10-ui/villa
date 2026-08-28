import BrandProfileCenter from "@/components/BrandProfileCenter";
import FacebookBrandAutomation from "@/components/FacebookBrandAutomation";
import { listMetaAccounts } from "@/lib/meta-store";

export const dynamic = "force-dynamic";

export default async function BrandPage() {
  const accounts = await listMetaAccounts();
  return <>
    <FacebookBrandAutomation accounts={accounts} />
    <BrandProfileCenter accounts={accounts} />
  </>;
}
