import LegalInfoPage, { buildLegalMetadata } from "@/components/LegalInfoPage";
import { LEGAL_PAGES } from "@/lib/legal-content";

const page = LEGAL_PAGES["gizlilik"];

export const metadata = buildLegalMetadata(page);

export default function Page() {
  return <LegalInfoPage page={page} />;
}
