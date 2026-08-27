import { listReservations } from "@/lib/db";

function csvCell(value: string | number) { return `"${String(value).replaceAll('"','""')}"`; }
export const dynamic = "force-dynamic";
export async function GET(){
  const header=["Müşteri","Villa","Giriş","Çıkış","Gece","Kanal","Gecelik fiyat","Brüt","Komisyon oranı","Komisyon","Net","Ödenen","Kalan","Notlar"];
  const rows=(await listReservations()).map((r)=>[r.guestName,r.villa,r.checkIn,r.checkOut,Math.round((Date.parse(r.checkOut)-Date.parse(r.checkIn))/86400000),r.channel,r.nightlyRate,r.grossAmount,r.commissionRate,r.commissionAmount,r.netAmount,r.paidAmount,r.grossAmount-r.paidAmount,r.notes]);
  const csv="\uFEFF"+[header,...rows].map((row)=>row.map(csvCell).join(";")).join("\r\n");
  return new Response(csv,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="villa-rezervasyonlari-${new Date().toISOString().slice(0,10)}.csv"`,"Cache-Control":"no-store"}});
}
