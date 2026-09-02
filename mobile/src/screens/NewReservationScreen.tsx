import { useNavigate } from "react-router-dom";
import { TopBar } from "../components/common";
import { api } from "../api/client";
import { ReservationForm, type ReservationFormValues } from "../components/ReservationForm";

export function NewReservationScreen() {
  const navigate = useNavigate();

  async function handleSubmit(values: ReservationFormValues) {
    const result = await api.post<{ reservation: { id: string } }>("/reservations", {
      villa: values.villa,
      guestName: values.guestName,
      phone: values.phone,
      checkIn: values.checkIn,
      checkOut: values.checkOut,
      channel: values.channel,
      paidAmount: Number(values.paidAmount) || 0,
      notes: values.notes,
    });
    navigate(`/rezervasyonlar/${result.reservation.id}`, { replace: true });
  }

  return (
    <div>
      <TopBar title="Yeni Rezervasyon" />
      <div className="app-content">
        <ReservationForm submitLabel="Rezervasyonu Kaydet" onSubmit={handleSubmit} />
      </div>
    </div>
  );
}
