import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(
  data: unknown,
  status = 200,
) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: corsHeaders,
    },
  );
}

function normalizeIndiaPhone(
  value: string,
): string {
  const digits = String(value || "")
    .replace(/\D/g, "");

  if (digits.length === 10) {
    return `+91${digits}`;
  }

  if (
    digits.length === 12 &&
    digits.startsWith("91")
  ) {
    return `+${digits}`;
  }

  return "";
}

Deno.serve(async (req: Request) => {
  // ========================================================
  // CORS
  // ========================================================

  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return json(
      {
        sent: false,
        error: "POST required.",
      },
      405,
    );
  }

  try {
    // ======================================================
    // SUPABASE ENVIRONMENT
    // ======================================================

    const supabaseUrl =
      Deno.env.get("SUPABASE_URL") || "";

    const supabaseAnonKey =
      Deno.env.get("SUPABASE_ANON_KEY") || "";

    const serviceRoleKey =
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY",
      ) || "";

    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      !serviceRoleKey
    ) {
      return json(
        {
          sent: false,
          error:
            "Supabase server environment variables are missing.",
        },
        500,
      );
    }

    // ======================================================
    // AUTHENTICATION
    // ======================================================

    const authorization =
      req.headers.get("Authorization");

    if (!authorization) {
      return json(
        {
          sent: false,
          error:
            "Authentication required.",
        },
        401,
      );
    }

    const userClient =
      createClient(
        supabaseUrl,
        supabaseAnonKey,
        {
          global: {
            headers: {
              Authorization:
                authorization,
            },
          },

          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        },
      );

    const {
      data: { user },
      error: authError,
    } =
      await userClient.auth.getUser();

    if (authError || !user) {
      console.error(
        "Authentication error:",
        authError,
      );

      return json(
        {
          sent: false,
          error:
            "Invalid or expired login session.",
        },
        401,
      );
    }

    // ======================================================
    // SERVICE ROLE CLIENT
    // ======================================================

    const adminClient =
      createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        },
      );

    // ======================================================
    // MASTER SWITCH
    // ======================================================

    const enabled =
      String(
        Deno.env.get(
          "MANVI_AUTO_WHATSAPP_ENABLED",
        ) || "false",
      ).toLowerCase() === "true";

    if (!enabled) {
      return json({
        sent: false,
        skipped: true,
        reason:
          "Automatic WhatsApp is disabled.",
      });
    }

    // ======================================================
    // TWILIO CREDENTIALS
    // ======================================================

    const accountSid =
      Deno.env.get(
        "TWILIO_ACCOUNT_SID",
      ) || "";

    const authToken =
      Deno.env.get(
        "TWILIO_AUTH_TOKEN",
      ) || "";

    const whatsappFrom =
      Deno.env.get(
        "TWILIO_WHATSAPP_FROM",
      ) || "";

    if (
      !accountSid ||
      !authToken ||
      !whatsappFrom
    ) {
      return json({
        sent: false,
        skipped: true,
        reason:
          "WhatsApp provider credentials are not configured.",
      });
    }

    // ======================================================
    // REQUEST BODY
    // ======================================================

    const body = await req.json();

    const customerId =
      String(
        body.customer_id || "",
      ).trim();

    const customerName =
      String(
        body.customer_name ||
          "Customer",
      ).trim();

    const customerMobile =
      String(
        body.customer_mobile || "",
      ).trim();

    const message =
      String(
        body.message || "",
      ).trim();

    const messageType =
      String(
        body.message_type ||
          "sale",
      ).trim();

    const referenceId =
      body.reference_id
        ? String(
            body.reference_id,
          )
        : null;

    // ======================================================
    // VALIDATION
    // ======================================================

    if (!customerId) {
      return json({
        sent: false,
        skipped: true,
        reason:
          "Customer ID is required.",
      });
    }

    if (!message) {
      return json({
        sent: false,
        skipped: true,
        reason:
          "Message is empty.",
      });
    }

    // ======================================================
    // LOAD CUSTOMER
    // ======================================================

    const {
      data: customer,
      error: customerError,
    } =
      await adminClient
        .from("customers")
        .select(
          `
            id,
            customer_name,
            mobile,
            whatsapp_opt_in
          `,
        )
        .eq(
          "id",
          customerId,
        )
        .maybeSingle();

    if (customerError) {
      console.error(
        "Customer lookup error:",
        customerError,
      );

      return json(
        {
          sent: false,
          skipped: false,
          error:
            "Unable to verify customer WhatsApp settings.",
        },
        500,
      );
    }

    if (!customer) {
      return json({
        sent: false,
        skipped: true,
        reason:
          "Customer not found.",
      });
    }

    // ======================================================
    // OPT-IN CHECK
    // ======================================================

    if (
      customer.whatsapp_opt_in !==
      true
    ) {
      return json({
        sent: false,
        skipped: true,
        reason:
          "Customer has not opted in to WhatsApp messages.",
      });
    }

    // ======================================================
    // PHONE NUMBER
    // ======================================================

    const phone =
      normalizeIndiaPhone(
        customer.mobile ||
          customerMobile,
      );

    if (!phone) {
      return json({
        sent: false,
        skipped: true,
        reason:
          "Invalid Indian mobile number.",
      });
    }

    // ======================================================
    // TWILIO FROM / TO
    // ======================================================

    const from =
      whatsappFrom.startsWith(
        "whatsapp:",
      )
        ? whatsappFrom
        : `whatsapp:${whatsappFrom}`;

    const to =
      `whatsapp:${phone}`;

    // ======================================================
    // TWILIO MESSAGE
    // ======================================================

    const form =
      new URLSearchParams();

    form.set(
      "From",
      from,
    );

    form.set(
      "To",
      to,
    );

    form.set(
      "Body",
      message,
    );

    // ======================================================
    // TWILIO AUTHENTICATION
    // ======================================================

    const basicAuth =
      btoa(
        `${accountSid}:${authToken}`,
      );

    // ======================================================
    // SEND WHATSAPP
    // ======================================================

    const response =
      await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: "POST",

          headers: {
            Authorization:
              `Basic ${basicAuth}`,

            "Content-Type":
              "application/x-www-form-urlencoded",
          },

          body:
            form.toString(),
        },
      );

    const result =
      await response.json();

    // ======================================================
    // TWILIO ERROR
    // ======================================================

    if (!response.ok) {
      console.error(
        "Twilio WhatsApp error:",
        result,
      );

      return json(
        {
          sent: false,
          skipped: false,

          error:
            result?.message ||
            "Twilio WhatsApp message failed.",

          code:
            result?.code ||
            null,
        },
        502,
      );
    }

    // ======================================================
    // LOG SUCCESS
    // ======================================================

    const {
      error: logError,
    } =
      await adminClient
        .from(
          "whatsapp_message_logs",
        )
        .insert({
          customer_id:
            customer.id,

          message_type:
            messageType,

          reference_id:
            referenceId,

          customer_name:
            customer.customer_name ||
            customerName,

          customer_mobile:
            phone,

          message,

          provider:
            "twilio",

          provider_message_id:
            result.sid || null,

          status:
            result.status ||
            "sent",

          sent_at:
            new Date().toISOString(),
        });

    if (logError) {
      console.warn(
        "WhatsApp log insert warning:",
        logError,
      );
    }

    // ======================================================
    // SUCCESS
    // ======================================================

    console.log(
      "MANVI WhatsApp sent:",
      {
        customerId:
          customer.id,

        customerName:
          customer.customer_name ||
          customerName,

        messageType,

        referenceId,

        phone,

        sid:
          result.sid || null,

        status:
          result.status || null,
      },
    );

    return json({
      sent: true,
      skipped: false,

      sid:
        result.sid || null,

      status:
        result.status || null,
    });
  } catch (error) {
    console.error(
      "send-whatsapp error:",
      error,
    );

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