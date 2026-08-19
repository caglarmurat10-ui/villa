import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Villa Yönetim",
  description: "Safira ve Destan rezervasyon yönetim sistemi",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="tr"><body>{children}</body></html>;
}
