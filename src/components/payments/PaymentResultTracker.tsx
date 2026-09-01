"use client";

import { useEffect } from "react";
import { trackPaymentResult, type VillaId, type PaymentTypeAnalytics } from "@/lib/analytics";

export default function PaymentResultTracker({
  success,
  villaId,
  villaName,
  paymentType,
}: {
  success: boolean;
  villaId: VillaId;
  villaName: string;
  paymentType: PaymentTypeAnalytics;
}) {
  useEffect(() => {
    trackPaymentResult(success, { villa_id: villaId, villa_name: villaName }, paymentType);
  }, [success, villaId, villaName, paymentType]);

  return null;
}
