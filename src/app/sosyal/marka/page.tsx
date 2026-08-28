import BrandProfileCenter from "@/components/BrandProfileCenter";
import { listMetaAccounts } from "@/lib/meta-store";

export const dynamic = "force-dynamic";

export default async function BrandPage() {
  const accounts = await listMetaAccounts();
  return <BrandProfileCenter accounts={accounts} />;
}
