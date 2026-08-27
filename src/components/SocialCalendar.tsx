"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import type { SocialCampaign, SocialMediaLibraryItem } from "@/lib/socialOperationsDb";
import type { Villa } from "@/lib/types";
import SocialNav from "./SocialNav";
import styles from "./SocialOperations.module.css";

type Scheduled = { id: string; villa: Villa; type: string; scheduledAt: string; status: string; caption: string; mediaUrls: string[] };
type Event = { id: string; villa: Villa; date: string; status: string; type: string; caption: string; thumbnail: string | null; campaign: SocialCampaign };

export default function SocialCalendar() {
  const [campaigns,setCampaigns]=useState<SocialCampaign[]>([]); const [scheduled,setScheduled]=useState<Scheduled[]>([]); const [media,setMedia]=useState<SocialMediaLibraryItem[]>([]);
  const [month,setMonth]=useState(()=>new Date()); const [filter,setFilter]=useState<"Tümü"|Villa>("Tümü"); const [selected,setSelected]=useState<Event|null>(null); const [caption,setCaption]=useState(""); const [notice,setNotice]=useState("");
  const load=useCallback(async()=>{const response=await fetch("/api/social/calendar");const data=await response.json().catch(()=>({}));if(response.ok){setCampaigns(data.campaigns??[]);setScheduled(data.scheduled??[]);setMedia(data.media??[]);}},[]);
  useEffect(()=>{let cancelled=false;void fetch("/api/social/calendar").then(async(response)=>{const data=await response.json().catch(()=>({}));if(!cancelled&&response.ok){setCampaigns(data.campaigns??[]);setScheduled(data.scheduled??[]);setMedia(data.media??[]);}});return()=>{cancelled=true;};},[]);
  const events=useMemo(()=>campaigns.map((campaign)=>{const plan=scheduled.find((item)=>item.id===campaign.scheduledPostId);const itemMedia=media.find((item)=>campaign.mediaIds.includes(item.id));return{id:campaign.id,villa:campaign.villa,date:(plan?.scheduledAt??campaign.availabilityStart??campaign.createdAt).slice(0,10),status:plan?.status??(campaign.source==="automation"&&campaign.status==="draft"?"automatic-proposal":campaign.status),type:plan?.type??campaign.campaignType,caption:campaign.caption,thumbnail:itemMedia?.publicUrl??null,campaign};}).filter((item)=>filter==="Tümü"||item.villa===filter),[campaigns,scheduled,media,filter]);
  const year=month.getFullYear(),monthIndex=month.getMonth(); const firstDay=new Date(year,monthIndex,1); const lead=(firstDay.getDay()+6)%7; const count=new Date(year,monthIndex+1,0).getDate();
  const cells=Array.from({length:lead+count},(_,index)=>index<lead?null:index-lead+1);
  const monthLabel=new Intl.DateTimeFormat("tr-TR",{month:"long",year:"numeric"}).format(month);
  function open(item:Event){setSelected(item);setCaption(item.caption);}
  async function save(){if(!selected)return;const response=await fetch(`/api/social/campaigns/${selected.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({caption})});const data=await response.json().catch(()=>({}));setNotice(response.ok?"Taslak güncellendi.":data.error??"Taslak güncellenemedi.");if(response.ok){setSelected(null);await load();}}
  const statusName:Record<string,string>={draft:"Taslak",approved:"Onaylı",scheduled:"Planlı",processing:"Yayınlanıyor",published:"Yayınlandı",failed:"Başarısız",cancelled:"İptal",ignored:"Yoksayıldı","automatic-proposal":"Otomatik öneri"};
  return <main className={styles.page}><div className={styles.shell}><SocialNav/><section className={styles.hero}><div><span className={styles.eyebrow}>İÇERİK TAKVİMİ</span><h1>Aylık yayın planı</h1><p>Taslak, planlı, yayınlanan, başarısız, iptal ve otomatik önerileri birlikte görün.</p></div></section>{notice?<p className={styles.message}>{notice}</p>:null}
    <section className={styles.panel}><div className={styles.calendarHead}><div className={styles.toolbar}><button className={styles.button} onClick={()=>setMonth(new Date(year,monthIndex-1,1))}>‹</button><h2>{monthLabel}</h2><button className={styles.button} onClick={()=>setMonth(new Date(year,monthIndex+1,1))}>›</button></div><div className={styles.toolbar}>{(["Tümü","Destan","Safira"] as const).map((value)=><button key={value} className={filter===value?styles.primary:styles.button} onClick={()=>setFilter(value)}>{value}</button>)}</div></div>
      <div className={styles.calendarGrid}>{["Pzt","Sal","Çar","Per","Cum","Cmt","Paz"].map((day)=><div className={styles.weekday} key={day}>{day}</div>)}{cells.map((day,index)=>day?<div className={styles.day} key={day}><strong>{day}</strong>{events.filter((item)=>item.date===`${year}-${String(monthIndex+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`).map((item)=><button key={item.id} className={`${styles.event} ${item.villa==="Safira"?styles.safira:""} ${item.status==="failed"?styles.failed:""} ${item.status==="cancelled"?styles.cancelled:""} ${item.status==="draft"?styles.draft:""}`} onClick={()=>open(item)}>{item.villa} · {statusName[item.status]??item.status}</button>)}</div>:<div key={`empty-${index}`}/>)}</div></section>
    {selected?<div className={styles.modal}><div className={styles.modalCard}><h2>Villa {selected.villa} · {statusName[selected.status]??selected.status}</h2>{selected.thumbnail?<Image unoptimized width={800} height={500} className={styles.mediaPreview} src={selected.thumbnail} alt="Kampanya medyası"/>:null}<div className={styles.form}><label>İçerik türü<input readOnly value={selected.type}/></label><label>Yayın / kampanya tarihi<input readOnly value={selected.date}/></label><label>Caption<textarea rows={10} value={caption} readOnly={selected.status!=="draft"} onChange={(event)=>setCaption(event.target.value)}/></label><div className={styles.actions}>{selected.status==="draft"?<button className={styles.primary} onClick={save}>Değişikliği kaydet</button>:null}<button className={styles.button} onClick={()=>setSelected(null)}>Kapat</button></div></div></div></div>:null}
  </div></main>;
}
