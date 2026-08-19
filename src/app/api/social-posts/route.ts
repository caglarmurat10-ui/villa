import { createSocialPost, listSocialPosts } from "@/lib/social-db";
import { socialPostSchema } from "@/lib/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ posts: await listSocialPosts() });
}

export async function POST(request: Request) {
  const parsed = socialPostSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Geçersiz paylaşım bilgisi" }, { status: 400 });
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
  if (parsed.data.scheduledDate < today) return Response.json({ error: "Geçmiş bir tarihe paylaşım planlanamaz." }, { status: 400 });
  return Response.json({ post: await createSocialPost(parsed.data) }, { status: 201 });
}
