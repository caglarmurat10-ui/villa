export type ReservationFinancials = {
  grossAmount: number;
  commissionRate: number;
  commissionAmount: number;
  netAmount: number;
};

function toCents(value: number) {
  return Math.round((value + Number.EPSILON) * 100);
}

export function calculateReservationFinancials(
  grossAmount: number,
  commissionRate: number,
): ReservationFinancials {
  if (!Number.isFinite(grossAmount) || grossAmount < 0) {
    throw new Error("Brüt tutar geçerli değil.");
  }
  if (!Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate > 100) {
    throw new Error("Komisyon oranı geçerli değil.");
  }

  const grossCents = toCents(grossAmount);
  const commissionCents = Math.round((grossCents * commissionRate) / 100);
  return {
    grossAmount: grossCents / 100,
    commissionRate,
    commissionAmount: commissionCents / 100,
    netAmount: (grossCents - commissionCents) / 100,
  };
}
