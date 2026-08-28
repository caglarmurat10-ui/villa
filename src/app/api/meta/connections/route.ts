import { listMetaAccounts, removeMetaAccount } from "@/lib/meta-store";

export async function GET() {
  try {
    return Response.json({ accounts: await listMetaAccounts() });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Bağlantılar alınamadı." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const villa = url.searchParams.get("villa");
  const platform = url.searchParams.get("platform") ?? "Instagram";
  if (villa !== "Safira" && villa !== "Destan") return Response.json({ error: "Geçersiz villa." }, { status: 400 });
  if (platform !== "Instagram" && platform !== "Facebook") return Response.json({ error: "Geçersiz platform." }, { status: 400 });

  try {
    await removeMetaAccount(villa, platform);
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Bağlantı kaldırılamadı." }, { status: 500 });
  }
}
