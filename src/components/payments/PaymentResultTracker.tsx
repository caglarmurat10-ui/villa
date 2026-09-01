"use client";

import { useEffect } from "react";
import { trackPaymentResult, type VillaId, type PaymentTypeAnalytics } from "@/lib/analytics";

export default function PaymentResultTracker({
  success,
  villaId,
  villaName,
  paymentType,
  testMode,
}: {
  success: boolean;
  villaId: VillaId;
  villaName: string;
  paymentType: PaymentTypeAnalytics;
  testMode: boolean;
}) {
  useEffect(() => {
    trackPaymentResult(success, { villa_id: villaId, villa_name: villaName }, paymentType, testMode);
  }, [success, villaId, villaName, paymentType, testMode]);

  return null;
}
