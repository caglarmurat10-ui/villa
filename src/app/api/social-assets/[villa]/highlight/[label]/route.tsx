import { ImageResponse } from "next/og";
import type { Villa } from "@/lib/types";

export const runtime = "nodejs";

const labels = {
  villa: { label: "Villa", glyph: "V" },
  havuz: { label: "Havuz", glyph: "H" },
  odalar: { label: "Odalar", glyph: "O" },
  patara: { label: "Patara", glyph: "P" },
  kas: { label: "Kaş", glyph: "K" },
  musaitlik: { label: "Müsaitlik", glyph: "M" },
  iletisim: { label: "İletişim", glyph: "İ" },
} as const;

function isVilla(value: string): value is Villa {
  return value === "Safira" || value === "Destan";
}

export async function GET(_request: Request, context: { params: Promise<{ villa: string; label: string }> }) {
  const { villa, label } = await context.params;
  if (!isVilla(villa)) return new Response("Villa bulunamadı.", { status: 404 });
  const item = labels[label as keyof typeof labels];
  if (!item) return new Response("Kapak bulunamadı.", { status: 404 });
  const monogram = villa === "Safira" ? "VS" : "VD";

  return new ImageResponse(
    <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",background:"#061a33",color:"#d8b36a",fontFamily:"serif"}}>
      <div style={{width:900,height:900,border:"10px solid #d8b36a",borderRadius:"50%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",position:"relative"}}>
        <div style={{position:"absolute",top:90,fontFamily:"sans-serif",fontSize:28,letterSpacing:7,color:"#d8b36a"}}>{monogram}</div>
        <div style={{fontSize:290,lineHeight:1,color:"#f2dfb1",fontWeight:600}}>{item.glyph}</div>
        <div style={{width:420,height:2,background:"#d8b36a",margin:"18px 0 28px"}} />
        <div style={{fontFamily:"sans-serif",fontSize:44,letterSpacing:5,color:"#ffffff",textTransform:"uppercase"}}>{item.label}</div>
      </div>
    </div>,
    { width: 1080, height: 1080 },
  );
}
