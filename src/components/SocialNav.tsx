import Link from "next/link";
import styles from "./SocialOperations.module.css";

export default function SocialNav() {
  return <nav className={styles.nav} aria-label="Sosyal medya bölümleri">
    <Link href="/">← Ana panel</Link>
    <Link href="/sosyal">Operasyon merkezi</Link>
    <Link href="/sosyal/yayinla">Şimdi yayınla</Link>
    <Link href="/sosyal/takvim">İçerik takvimi</Link>
    <Link href="/sosyal/medya">Medya kütüphanesi</Link>
    <Link href="/sosyal/istatistik">İstatistik</Link>
    <Link href="/sosyal/ai">AI İçerik Stüdyosu</Link>
  </nav>;
}
