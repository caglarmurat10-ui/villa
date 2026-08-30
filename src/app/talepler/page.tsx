import BookingInquiryCenter from "@/components/BookingInquiryCenter";
import { listBookingInquiries } from "@/lib/booking-inquiries";

export const dynamic = "force-dynamic";

export default async function BookingInquiriesPage() {
  const inquiries = await listBookingInquiries();
  return <BookingInquiryCenter initialItems={inquiries} />;
}
