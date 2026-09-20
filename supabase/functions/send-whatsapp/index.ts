import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function normalizeIndiaPhone(value: string) {
  const digits = String(value || "").replace(/\D/g, "");

  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;

  return "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ sent: false, error: "POST required." }, 405);
  }

  try {
    const enabled =
      String(Deno.env.get("MANVI_AUTO_WHATSAPP_ENABLED") || "false")
        .toLowerCase() === "true";

    if (!enabled) {
      return json({
        sent: false,
        skipped: true,
        reason: "Automatic WhatsApp is disabled.",
      });
    }

    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
    const whatsappFrom = Deno.env.get("TWILIO_WHATSAPP_FROM") || "";

    if (!accountSid || !authToken || !whatsappFrom) {
      return json({
        sent: false,
        skipped: true,
        reason: "WhatsApp provider credentials are not configured yet.",
      });
    }

    const body = await req.json();

    const customerId = String(body.customer_id || "");
    const customerName = String(body.customer_name || "Customer");
    const phone = normalizeIndiaPhone(body.customer_mobile || "");
    const message = String(body.message || "").trim();
    const messageType = String(body.message_type || "sale");
    const referenceId = body.reference_id
      ? String(body.reference_id)
      : null;

    if (!customerId) {
      return json({
        sent: false,
        skipped: true,
        reason: "Customer ID is required.",
      });
    }

    if (!phone) {
      return json({
        sent: false,
        skipped: true,
        reason: "Invalid Indian mobile number.",
      });
    }

    if (!message) {
      return json({
        sent: false,
        skipped: true,
        reason: "Message is empty.",
      });
    }

    const from =
      whatsappFrom.startsWith("whatsapp:")
        ? whatsappFrom
        : `whatsapp:${whatsappFrom}`;

    const to = `whatsapp:${phone}`;

    const form = new URLSearchParams();
    form.set("From", from);
    form.set("To", to);
    form.set("Body", message);

    const basicAuth = btoa(`${accountSid}:${authToken}`);

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      },
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("Twilio WhatsApp error:", result);

      return json(
        {
          sent: false,
          skipped: false,
          error:
            result?.message ||
            "Twilio WhatsApp message failed.",
          code: result?.code || null,
        },
        502,
      );
    }

    console.log("MANVI WhatsApp sent:", {
      customerName,
      messageType,
      referenceId,
      sid: result.sid,
    });

    return json({
      sent: true,
      skipped: false,
      sid: result.sid || null,
      status: result.status || null,
    });
  } catch (error) {
    console.error("send-whatsapp error:", error);

    return json(
      {
        sent: false,
        skipped: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown WhatsApp error.",
      },
      500,
    );
  }
});
