"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import baseStyles from "./SocialOperations.module.css";
import aiStyles from "./AiContentStudio.module.css";

const styles = { ...baseStyles, ...aiStyles };

type Item = { villa: string; suggestion: string; reason: string };
export default function AiTodayWidget() {
  const [items, setItems] = useState<Item[]>([]); const [locked, setLocked] = useState(false);
  useEffect(()=>{let active=true;void fetch("/api/social/ai/today").then(async(response)=>{
    if(!active)return;if(response.status===401){setLocked(true);return;}const body=await response.json().catch(()=>({}));
    if(active&&response.ok)setItems(body.items??[]);
  });return()=>{active=false};},[]);
  return <section className={styles.panel}><div className={styles.panelHead}><div><span className={styles.eyebrow}>BUGÜN NE PAYLAŞALIM?</span><h2>AI öneri merkezi</h2></div><Link className={styles.primary} href="/sosyal/ai">AI stüdyosunu aç</Link></div>
    {locked?<p className={styles.muted}>Öneriler, korumalı AI yönetici oturumu açıldığında görünür.</p>:<div className={styles.grid}>{items.map((item)=><article className={styles.ideaCard} key={item.villa}><strong>Villa {item.villa}</strong><p>{item.suggestion}</p><small>{item.reason}</small></article>)}</div>}
  </section>;
}
