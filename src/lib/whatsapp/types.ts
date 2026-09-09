export const WHATSAPP_MESSAGE_TYPES = ["CHECKOUT_REMINDER"] as const;
export type WhatsappMessageType = (typeof WHATSAPP_MESSAGE_TYPES)[number];

export const WHATSAPP_MESSAGE_STATUSES = [
  "SCHEDULED",
  "SENDING",
  "SENT",
  "DELIVERED",
  "READ",
  "FAILED",
  "CANCELLED",
  "SKIPPED_NOT_CONFIGURED",
] as const;
export type WhatsappMessageStatus = (typeof WHATSAPP_MESSAGE_STATUSES)[number];

export interface WhatsappScheduledMessage {
  id: string;
  reservationId: string;
  messageType: WhatsappMessageType;
  checkoutDate: string;
  scheduledAt: string;
  recipientPhone: string;
  templateName: string;
  status: WhatsappMessageStatus;
  providerMessageId: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  autoEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}
