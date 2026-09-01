import { getCloudflareContext } from "@opennextjs/cloudflare";

export interface PaytrCredentials {
  merchantId: string;
  merchantKey: string;
  merchantSalt: string;
}

export async function getPaytrCredentials(): Promise<PaytrCredentials | null> {
  const { env } = await getCloudflareContext({ async: true });
  const merchantId = env.PAYTR_MERCHANT_ID;
  const merchantKey = env.PAYTR_MERCHANT_KEY;
  const merchantSalt = env.PAYTR_MERCHANT_SALT;
  if (!merchantId || !merchantKey || !merchantSalt) return null;
  return { merchantId, merchantKey, merchantSalt };
}

export async function isPaytrConfigured(): Promise<boolean> {
  return (await getPaytrCredentials()) !== null;
}
