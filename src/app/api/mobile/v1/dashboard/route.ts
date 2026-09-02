import { listReservations } from "@/lib/db";
import { listSocialPosts } from "@/lib/social-db";
import { listExternalBlocksForAdmin } from "@/lib/ota/availability";
import type { Reservation } from "@/lib/types";

export const dynamic = "force-dynamic";

// Auth zaten custom-worker.mjs'in mobileAuthGate'inde (bearer token) yapıldı - bu route'a
// ulaşabilen her istek zaten doğrulanmış demektir.
function istanbulToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
}

export async function GET() {
  const today = istanbulToday();
  const [reservations, posts, otaBlocks] = await Promise.all([
    listReservations(),
    listSocialPosts(50),
    listExternalBlocksForAdmin(),
  ]);

  const active = reservations;
  const checkInsToday = active.filter((r) => r.checkIn === today);
  const checkOutsToday = active.filter((r) => r.checkOut === today);
  const upcoming = active
    .filter((r) => r.checkIn > today)
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn))
    .slice(0, 10);

  const socialFailed = posts.filter((p) => p.status === "Planlandı" && Boolean(p.lastPublishError));
  const socialScheduledToday = posts.filter((p) => p.status === "Planlandı" && p.scheduledDate === today);
  const socialPublishedToday = posts.filter((p) => p.status === "Yayınlandı" && (p.publishedAt ?? "").slice(0, 10) === today);

  const needsReview = otaBlocks.filter((b) => b.status === "needs_review");

  return Response.json({
    today,
    checkInsToday: checkInsToday.map(reservationSummary),
    checkOutsToday: checkOutsToday.map(reservationSummary),
    upcomingReservations: upcoming.map(reservationSummary),
    villaStatus: {
      Safira: { activeReservations: active.filter((r) => r.villa === "Safira").length },
      Destan: { activeReservations: active.filter((r) => r.villa === "Destan").length },
    },
    social: {
      scheduledToday: socialScheduledToday.length,
      publishedToday: socialPublishedToday.length,
      failed: socialFailed.length,
      destanInstagramHardBlocked: true,
    },
    otaNeedsReview: {
      count: needsReview.length,
      blocks: needsReview.slice(0, 10).map((b) => ({ villa: b.villa, source: b.source, startDate: b.startDate, endDate: b.endDate })),
    },
  });
}

function reservationSummary(r: Reservation) {
  return {
    id: r.id,
    villa: r.villa,
    guestName: r.guestName,
    phone: r.phone,
    checkIn: r.checkIn,
    checkOut: r.checkOut,
    totalAmount: r.totalAmount,
    paidAmount: r.paidAmount,
    channel: r.channel,
  };
}
