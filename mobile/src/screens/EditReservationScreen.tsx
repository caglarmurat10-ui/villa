import { useNavigate, useParams } from "react-router-dom";
import { TopBar, Skeleton, ErrorState } from "../components/common";
import { useApi } from "../lib/useApi";
import { api } from "../api/client";
import { ReservationForm, type ReservationFormValues } from "../components/ReservationForm";

interface Reservation {
  id: string; villa: "Safira" | "Destan"; guestName: string; phone: string;
  checkIn: string; checkOut: string; channel: "Doğrudan" | "Booking" | "Airbnb" | "Diğer";
  paidAmount: number; notes: string;
}

export function EditReservationScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useApi<{ reservation: Reservation }>(`/reservations/${id}`);

  async function handleSubmit(values: ReservationFormValues) {
    await api.put(`/reservations/${id}`, {
      villa: values.villa,
      guestName: values.guestName,
      // Telefon alanı formda yok - mevcut (varsa legacy) değeri olduğu gibi koru, sil me.
      phone: data?.reservation.phone ?? "",
      checkIn: values.checkIn,
      checkOut: values.checkOut,
      channel: values.channel,
      paidAmount: Number(values.paidAmount) || 0,
      notes: values.notes,
    });
    navigate(`/rezervasyonlar/${id}`, { replace: true });
  }

  return (
    <div>
      <TopBar title="Rezervasyonu Düzenle" />
      <div className="app-content">
        {loading && <Skeleton count={3} />}
        {error && <ErrorState text={error} onRetry={reload} />}
        {data && (
          <ReservationForm
            submitLabel="Değişiklikleri Kaydet"
            initial={{
              villa: data.reservation.villa,
              guestName: data.reservation.guestName,
              checkIn: data.reservation.checkIn,
              checkOut: data.reservation.checkOut,
              channel: data.reservation.channel,
              paidAmount: String(data.reservation.paidAmount),
              notes: data.reservation.notes,
            }}
            onSubmit={handleSubmit}
          />
        )}
      </div>
    </div>
  );
}
