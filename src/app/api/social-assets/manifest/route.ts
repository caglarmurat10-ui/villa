import { brandProfiles } from "@/lib/brand-profiles";
import { socialAssetManifest } from "@/lib/brand-assets";
import type { Villa } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const absolute = (path: string) => new URL(path, `${origin}/`).toString();
  const villas: Villa[] = ["Safira", "Destan"];

  return Response.json({
    generatedAt: new Date().toISOString(),
    villas: Object.fromEntries(villas.map((villa) => {
      const assets = socialAssetManifest[villa];
      const profile = brandProfiles[villa];
      return [villa, {
        profileImage: absolute(assets.profile),
        facebookCover: absolute(assets.facebookCover),
        instagramHighlights: assets.instagramHighlights.map((item) => ({ label: item.label, url: absolute(item.path) })),
        instagram: {
          profileName: profile.instagram.profileName,
          preferredUsername: profile.instagram.preferredUsername,
          bio: profile.instagram.bio,
          category: profile.instagram.category,
          contactActions: profile.instagram.contactActions,
          pinnedPosts: profile.instagram.pinnedPosts,
        },
        facebook: {
          pageName: profile.facebook.pageName,
          preferredUsername: profile.facebook.preferredUsername,
          category: profile.facebook.category,
          intro: profile.facebook.intro,
          about: profile.facebook.about,
          cta: profile.facebook.cta,
          pinnedPosts: profile.facebook.pinnedPosts,
        },
      }];
    })),
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
