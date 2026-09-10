import { NextResponse } from "next/server";
import { getWhatsappCredentials } from "@/lib/whatsapp/config";
import {
  getWhatsappDisplayNameSnapshot,
  WHATSAPP_TARGET_DISPLAY_NAME,
} from "@/lib/whatsapp/display-name";

export const dynamic = "force-dynamic";

export async function GET() {
  const credentials = await getWhatsappCredentials();
  if (!credentials) {
    return NextResponse.json({
      configured: false,
      targetDisplayName: WHATSAPP_TARGET_DISPLAY_NAME,
      verifiedName: null,
      nameStatus: null,
      matchesTarget: false,
      actionRequired: "WHATSAPP_COEXISTENCE_SETUP",
    });
  }

  try {
    const snapshot = await getWhatsappDisplayNameSnapshot(credentials);
    return NextResponse.json({
      ...snapshot,
      actionRequired: snapshot.matchesTarget ? null : "WHATSAPP_MANAGER_DISPLAY_NAME_REVIEW",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "WhatsApp görünen adı okunamadı.";
    return NextResponse.json({
      configured: true,
      targetDisplayName: WHATSAPP_TARGET_DISPLAY_NAME,
      verifiedName: null,
      nameStatus: null,
      matchesTarget: false,
      actionRequired: "WHATSAPP_DISPLAY_NAME_STATUS_UNAVAILABLE",
      error: message,
    }, { status: 502 });
  }
}
