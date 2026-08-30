import CalculatorCenter from "@/components/CalculatorCenter";
import { getCommissionRate } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HesaplamaPage() {
  const commission = await getCommissionRate();
  return <main className="ops-page">
    <header className="ops-page-head"><div><span className="ops-eyebrow">VİLLA YÖNETİM / FİNANS</span><h1>Hesaplama</h1><p>Rezervasyon tutarı ve komisyon etkisini kayıt oluşturmadan önce hızlıca hesaplayın.</p></div></header>
    <CalculatorCenter defaultCommission={commission} />
  </main>;
}
