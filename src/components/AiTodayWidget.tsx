"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AiConfigurationStatus } from "@/lib/aiConfiguration";
import baseStyles from "./SocialOperations.module.css";
import aiStyles from "./AiContentStudio.module.css";

const styles = { ...baseStyles, ...aiStyles };

type Item = { villa: string; suggestion: string; reason: string };
export default function AiTodayWidget() {
  const [items, setItems] = useState<Item[]>([]); const [locked, setLocked] = useState(false);
  const [configuration, setConfiguration] = useState<AiConfigurationStatus | null>(null);
  useEffect(()=>{let active=true;void (async()=>{
    const sessionResponse=await fetch("/api/social/ai/session");const session=await sessionResponse.json().catch(()=>({})) as {authenticated?:boolean;configuration?:AiConfigurationStatus};
    if(!active)return;if(session.configuration)setConfiguration(session.configuration);
    if(session.authenticated!==true){setLocked(true);return;}
    const response=await fetch("/api/social/ai/today");if(!active)return;if(response.status===401){setLocked(true);return;}
    const body=await response.json().catch(()=>({})) as {items?:Item[];configuration?:AiConfigurationStatus};
    if(body.configuration)setConfiguration(body.configuration);if(response.ok)setItems(body.items??[]);
  })();return()=>{active=false};},[]);
  return <section className={styles.panel}><div className={styles.panelHead}><div><span className={styles.eyebrow}>BUGÜN NE PAYLAŞALIM?</span><h2>AI öneri merkezi</h2></div><Link className={styles.primary} href="/sosyal/ai">AI stüdyosunu aç</Link></div>
    {configuration?<div className={styles.statusGrid}><span>Workers AI: <strong>{configuration.workersAiConfigured?"Aktif":"Kullanılamıyor"}</strong></span><span>OpenAI alternatifi: <strong>{configuration.paidFallbackEnabled?"Açık":"Kapalı"}</strong></span><span>Pexels: <strong>{configuration.pexelsConfigured?"Yapılandırıldı":"Yapılandırılmadı"}</strong></span><span>AI Autopilot: <strong>{configuration.autopilotEnabled?"Açık":"Kapalı"}</strong></span></div>:null}
    {configuration&&!configuration.workersAiConfigured?<p className={styles.muted}>Workers AI kullanılamıyor. Güvenli şablonlar ve mevcut Instagram yayın sistemi çalışmaya devam eder.</p>:null}
    {locked?<p className={styles.muted}>Öneriler, korumalı AI yönetici oturumu açıldığında görünür.</p>:<div className={styles.grid}>{items.map((item)=><article className={styles.ideaCard} key={item.villa}><strong>Villa {item.villa}</strong><p>{item.suggestion}</p><small>{item.reason}</small></article>)}</div>}
  </section>;
}
