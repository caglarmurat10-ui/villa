import { NextRequest } from "next/server";

const MEDIA_IDS: Record<string, string> = {
  "safira-hero": "1JL-isYYwAC7gtdKvIVogGnvZjB_3rXs5",
  "safira-alt": "1RqmKOcfGBYrSF1ZJHaJhKdN915nmUrlS",
  "destan-hero": "1IipTx5zZfOge9Y1rQJBpW8BK9zBU2tgj",
  "destan-suite": "1NmKtSAV2d4SUdYZo3qpfTJuROhgRExIH",
};

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const id = MEDIA_IDS[key];
  if (!id) return new Response("Not Found", { status: 404 });

  const upstream = await fetch(`https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`, {
    redirect: "follow",
    headers: { "User-Agent": "Mozilla/5.0" },
  });

  if (!upstream.ok || !upstream.body) {
    return new Response("Media unavailable", { status: 502 });
  }

  const headers = new Headers();
  headers.set("Content-Type", upstream.headers.get("content-type") || "image/jpeg");
  headers.set("Cache-Control", "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000");
  headers.set("X-Content-Type-Options", "nosniff");

  return new Response(upstream.body, { status: 200, headers });
}
