import { supabase } from "./supabase";

export type AutomaticWhatsAppType = "sale" | "collection";

export async function sendAutomaticWhatsApp(input: {
  customerId: string;
  customerName: string;
  customerMobile: string | null | undefined;
  message: string;
  messageType: AutomaticWhatsAppType;
  referenceId?: string;
}) {
  const phone = String(input.customerMobile || "").replace(/\D/g, "");

  if (!phone) {
    return { sent: false, skipped: true, reason: "Customer has no mobile number." };
  }

  if (phone.length !== 10 && !(phone.length === 12 && phone.startsWith("91"))) {
    return { sent: false, skipped: true, reason: "Customer mobile number is not a valid Indian number." };
  }

  const normalizedPhone = phone.length === 10 ? `+91${phone}` : `+${phone}`;

  try {
    const { data, error } = await supabase.functions.invoke("send-whatsapp", {
      body: {
        customer_id: input.customerId,
        customer_name: input.customerName,
        customer_mobile: normalizedPhone,
        message: input.message,
        message_type: input.messageType,
        reference_id: input.referenceId || null,
      },
    });

    if (error) {
      console.error("Automatic WhatsApp error:", error);
      return { sent: false, skipped: false, reason: error.message || "WhatsApp request failed." };
    }

    return data || { sent: true };
  } catch (error: any) {
    console.error("Automatic WhatsApp exception:", error);
    return { sent: false, skipped: false, reason: error?.message || "WhatsApp request failed." };
  }
}
