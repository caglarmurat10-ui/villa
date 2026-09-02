import { ImageResponse } from "next/og";
import { resolveDriveMediaById } from "@/lib/social-drive-media";
import type { Villa } from "@/lib/types";

export const runtime = "nodejs";

const BRAND = {
  Safira: {
    monogram: "VS",
    name: "VILLA SAFIRA",
    title: "Villa Safira Patara",
    subtitle: "Özel Havuzlu Villa • Kaş / Antalya",
    mediaId: "13ZC4v1qxGmUX0AXfNRWhpAkYprKpfkLB",
  },
  Destan: {
    monogram: "VD",
    name: "VILLA DESTAN",
    title: "Villa Destan Patara",
    subtitle: "Özel Havuzlu Villa • Kaş / Antalya",
    mediaId: "1IipTx5zZfOge9Y1rQJBpW8BK9zBU2tgj",
  },
} as const;

function isVilla(value: string): value is Villa {
  return value === "Safira" || value === "Destan";
}

function profile(villa: Villa) {
  const brand = BRAND[villa];
  return new ImageResponse(
    <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",background:"#061a33",color:"#d8b36a",padding:54,fontFamily:"serif"}}>
      <div style={{width:940,height:940,border:"12px solid #d8b36a",borderRadius:"50%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",position:"relative",boxShadow:"inset 0 0 0 4px #8c6a32"}}>
        <div style={{position:"absolute",top:145,width:610,height:2,background:"#d8b36a",opacity:.55}} />
        <div style={{fontSize:280,lineHeight:1,fontWeight:600,letterSpacing:-30,marginRight:28,textShadow:"0 5px 18px rgba(0,0,0,.35)"}}>{brand.monogram}</div>
        <div style={{display:"flex",width:660,height:2,background:"#d8b36a",margin:"28px 0 38px"}} />
        <div style={{fontSize:88,letterSpacing:10,color:"#f2dfb1",fontWeight:500}}>{brand.name}</div>
        <div style={{fontFamily:"sans-serif",fontSize:26,letterSpacing:8,color:"#d8b36a",marginTop:38}}>PATARA • KAŞ</div>
      </div>
    </div>,
    { width: 1080, height: 1080 },
  );
}

function cover(villa: Villa) {
  const brand = BRAND[villa];
  const media = resolveDriveMediaById(brand.mediaId);
  const imageUrl = media?.previewUrl.replace("sz=w1600", "sz=w2400") ?? "";

  return new ImageResponse(
    <div style={{width:"100%",height:"100%",display:"flex",position:"relative",overflow:"hidden",background:"#061a33",fontFamily:"serif"}}>
      {imageUrl ? <img src={imageUrl} alt="" width={1640} height={924} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}} /> : null}
      <div style={{position:"absolute",inset:0,display:"flex",background:"linear-gradient(90deg, rgba(4,19,40,.98) 0%, rgba(4,19,40,.94) 32%, rgba(4,19,40,.52) 55%, rgba(4,19,40,.08) 78%)"}} />
      <div style={{position:"absolute",left:68,top:58,bottom:58,width:680,display:"flex",flexDirection:"column",justifyContent:"center",color:"#f4e1b4"}}>
        <div style={{width:145,height:145,border:"4px solid #d8b36a",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:62,fontWeight:700,color:"#d8b36a",marginBottom:34}}>{brand.monogram}</div>
        <div style={{fontSize:86,lineHeight:1.03,fontWeight:500,color:"#f3dfae",letterSpacing:1}}>{brand.title}</div>
        <div style={{width:520,height:3,background:"#d8b36a",margin:"34px 0 26px"}} />
        <div style={{fontFamily:"sans-serif",fontSize:29,letterSpacing:2.5,color:"#ffffff"}}>{brand.subtitle}</div>
        <div style={{display:"flex",gap:28,marginTop:42,fontFamily:"sans-serif",fontSize:22,color:"#f2dfb1"}}>
          <span>ÖZEL HAVUZ</span><span>•</span><span>PATARA</span><span>•</span><span>HUZUR</span>
        </div>
      </div>
      <div style={{position:"absolute",left:0,right:0,bottom:0,height:14,background:"#d8b36a"}} />
    </div>,
    { width: 1640, height: 924 },
  );
}

export async function GET(_request: Request, context: { params: Promise<{ villa: string; asset: string }> }) {
  const { villa, asset } = await context.params;
  if (!isVilla(villa)) return new Response("Villa bulunamadı.", { status: 404 });
  if (asset === "profile") return profile(villa);
  if (asset === "cover") return cover(villa);
  return new Response("Sosyal medya varlığı bulunamadı.", { status: 404 });
}
