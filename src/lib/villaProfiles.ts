import type { Villa } from "./types";

export type VillaProfile = {
  villa: Villa;
  slug: "safira" | "destan";
  name: `Villa ${Villa}`;
  sourceImageUrl: string;
  publicImageUrl: string;
  imageFileBase: string;
};

export const VILLA_PROFILES = {
  Safira: {
    villa: "Safira",
    slug: "safira",
    name: "Villa Safira",
    sourceImageUrl: "https://cdn.villapaketi.com/uploads/villa-paketiVilla-Safira-26_823.jpg",
    publicImageUrl: "/api/villas/safira/image",
    imageFileBase: "villa-safira",
  },
  Destan: {
    villa: "Destan",
    slug: "destan",
    name: "Villa Destan",
    sourceImageUrl: "https://www.villavakti.com/thumbs/1200/630/catalog/3318/batch_villa-destan_45-7604.jpg",
    publicImageUrl: "/api/villas/destan/image",
    imageFileBase: "villa-destan",
  },
} as const satisfies Record<Villa, VillaProfile>;

export function villaProfile(villa: Villa): VillaProfile {
  return VILLA_PROFILES[villa];
}

export function villaProfileFromSlug(value: string): VillaProfile | null {
  const slug = value.toLocaleLowerCase("tr-TR");
  return Object.values(VILLA_PROFILES).find((profile) => profile.slug === slug) ?? null;
}
