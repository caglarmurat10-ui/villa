"use client";

import { useEffect } from "react";

export default function LocationRedirect({ href, villaName }: { href: string; villaName: string }) {
  useEffect(() => {
    const timer = window.setTimeout(() => window.location.replace(href), 500);
    return () => window.clearTimeout(timer);
  }, [href]);

  return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:24,background:"#07111f",color:"#fff",fontFamily:"Arial,sans-serif"}}>
    <section style={{maxWidth:520,textAlign:"center"}}>
      <h1>{villaName}</h1>
      <p style={{color:"#cbd5e1"}}>Konum Google Maps üzerinde açılıyor…</p>
      <a href={href} style={{display:"inline-block",marginTop:12,padding:"12px 18px",borderRadius:10,background:"#4c1d95",color:"#fff",textDecoration:"none",fontWeight:700}}>Konumu aç</a>
    </section>
  </main>;
}
