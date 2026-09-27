const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type WhatsAppRequest = {
  customer_id?: string | null;
  customer_name?: string | null;
  customer_mobile?: string | null;
  message?: string | null;
  message_type?: "sale" | "collection" | string | null;
  reference_id?: string | null;

  // Template variables in order:
  // {{1}}, {{2}}, {{3}}, {{4}}, {{5}}, {{6}}
  template_variables?: Array<string | number | null | undefined>;
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function normalizeIndianWhatsAppNumber(
  mobile: string | null | undefined
): string | null {
  if (!mobile) return null;

 const digits = String(mobile).replace(/\D/g, "");

  // +91XXXXXXXXXX / 91XXXXXXXXXX
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits;
  }

  // XXXXXXXXXX
  if (digits.length === 10) {
    return `91${digits}`;
  }

  return null;
}

function cleanTemplateVariable(
  value: string | number | null | undefined
): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      {
        success: false,
        sent: false,
        skipped: false,
        error: "Only POST requests are allowed.",
      },
      405
    );
  }

  try {
    const enabled =
      String(Deno.env.get("MANVI_AUTO_WHATSAPP_ENABLED") || "")
        .trim()
        .toLowerCase() === "true";

    if (!enabled) {
      return jsonResponse({
        success: true,
        sent: false,
        skipped: true,
        reason: "Automatic WhatsApp is disabled.",
      });
    }

    const accessToken = Deno.env.get("META_WHATSAPP_ACCESS_TOKEN");
    const phoneNumberId = Deno.env.get("META_WHATSAPP_PHONE_NUMBER_ID");

    const defaultTemplateName =
      Deno.env.get("META_WHATSAPP_TEMPLATE_NAME") ||
      "manvi_sale_bill";

    const defaultTemplateLanguage =
      Deno.env.get("META_WHATSAPP_TEMPLATE_LANGUAGE") ||
      "en_US";

    if (!accessToken) {
      return jsonResponse(
        {
          success: false,
          sent: false,
          skipped: false,
          error: "META_WHATSAPP_ACCESS_TOKEN is not configured.",
        },
        500
      );
    }

    if (!phoneNumberId) {
      return jsonResponse(
        {
          success: false,
          sent: false,
          skipped: false,
          error: "META_WHATSAPP_PHONE_NUMBER_ID is not configured.",
        },
        500
      );
    }

    const body = (await req.json()) as WhatsAppRequest;

    const customerId = body.customer_id || null;
    const customerName = body.customer_name || "";
    const customerMobile = body.customer_mobile || "";
    const messageType = body.message_type || "sale";
    const referenceId = body.reference_id || null;

    const to = normalizeIndianWhatsAppNumber(customerMobile);

    if (!to) {
      return jsonResponse({
        success: true,
        sent: false,
        skipped: true,
        reason: "Customer does not have a valid Indian mobile number.",
        customer_id: customerId,
        customer_name: customerName,
        customer_mobile: customerMobile,
      });
    }

    /*
     * For now the approved Meta template is:
     *
     * manvi_sale_bill
     *
     * Body:
     *
     * MANVI MILK AGENCIES
     *
     * SALE BILL
     *
     * Customer: {{1}}
     * Date: {{2}}
     *
     * Previous Balance: ₹{{3}}
     * Total Amount: ₹{{4}}
     * Paid Amount: ₹{{5}}
     * Balance Amount: ₹{{6}}
     *
     * Thank you for your business.
     */

    const templateVariables = Array.isArray(body.template_variables)
      ? body.template_variables.map(cleanTemplateVariable)
      : [];

    const templateName =
      defaultTemplateName.trim() || "manvi_sale_bill";

    const templateLanguage =
      defaultTemplateLanguage.trim() || "en_US";

    const templatePayload: Record<string, unknown> = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "template",
      template: {
        name: templateName,
        language: {
          code: templateLanguage,
        },
      },
    };

    /*
     * Add body variables only when supplied.
     *
     * The approved MANVI template needs 6 variables.
     */
    if (templateVariables.length > 0) {
      (
        templatePayload.template as {
          components?: unknown[];
        }
      ).components = [
        {
          type: "body",
          parameters: templateVariables.map((value) => ({
            type: "text",
            text: value,
          })),
        },
      ];
    }

    const graphUrl =
      `https://graph.facebook.com/v25.0/${phoneNumberId}/messages`;

    console.log("Sending Meta WhatsApp message:", {
      customer_id: customerId,
      customer_name: customerName,
      customer_mobile: to,
      message_type: messageType,
      reference_id: referenceId,
      template_name: templateName,
      template_language: templateLanguage,
      template_variable_count: templateVariables.length,
    });

    const response = await fetch(graphUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(templatePayload),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error(
        "Meta WhatsApp API error:",
        JSON.stringify(responseData)
      );

      return jsonResponse(
        {
          success: false,
          sent: false,
          skipped: false,
          error: "Meta WhatsApp API returned an error.",
          meta_error: responseData,
          customer_id: customerId,
          customer_name: customerName,
          customer_mobile: to,
          message_type: messageType,
          reference_id: referenceId,
        },
        response.status
      );
    }

    console.log(
      "Meta WhatsApp message sent:",
      JSON.stringify(responseData)
    );

    return jsonResponse({
      success: true,
      sent: true,
      skipped: false,
      provider: "meta",
      customer_id: customerId,
      customer_name: customerName,
      customer_mobile: to,
      message_type: messageType,
      reference_id: referenceId,
      template_name: templateName,
      template_language: templateLanguage,
      template_variable_count: templateVariables.length,
      meta_response: responseData,
    });
  } catch (error) {
    console.error("send-whatsapp exception:", error);

    return jsonResponse(
      {
        success: false,
        sent: false,
        skipped: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected WhatsApp function error.",
      },
      500
    );
  }
});