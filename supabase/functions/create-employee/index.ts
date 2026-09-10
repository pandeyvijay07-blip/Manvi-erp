import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  createClient,
} from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};

function jsonResponse(
  body: unknown,
  status = 200
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type":
          "application/json",
      },
    }
  );
}

Deno.serve(async (req: Request) => {

  // =====================================================
  // CORS
  // =====================================================

  if (req.method === "OPTIONS") {
    return new Response(
      "ok",
      {
        headers: corsHeaders,
      }
    );
  }

  if (req.method !== "POST") {
    return jsonResponse(
      {
        success: false,
        error: "Method not allowed.",
      },
      405
    );
  }

  try {

    // ===================================================
    // ENVIRONMENT
    // ===================================================

    const supabaseUrl =
      Deno.env.get(
        "SUPABASE_URL"
      );

    const serviceRoleKey =
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY"
      );

    if (!supabaseUrl) {
      throw new Error(
        "SUPABASE_URL is not configured."
      );
    }

    if (!serviceRoleKey) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY is not configured."
      );
    }

    // ===================================================
    // GET OWNER JWT
    // ===================================================

    const authHeader =
      req.headers.get(
        "Authorization"
      );

    if (!authHeader) {
      return jsonResponse(
        {
          success: false,
          error:
            "Missing Authorization header.",
        },
        401
      );
    }

    const token =
      authHeader.replace(
        "Bearer ",
        ""
      );

    if (!token) {
      return jsonResponse(
        {
          success: false,
          error:
            "Invalid authorization token.",
        },
        401
      );
    }

    // ===================================================
    // ADMIN CLIENT
    // ===================================================

    const adminClient =
      createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      );

    // ===================================================
    // VERIFY CURRENT USER
    // ===================================================

    const {
      data: authData,
      error: authError,
    } =
      await adminClient.auth.getUser(
        token
      );

    if (
      authError ||
      !authData.user
    ) {
      return jsonResponse(
        {
          success: false,
          error:
            "Unauthorized. Please login again.",
        },
        401
      );
    }

    const currentUser =
      authData.user;

    // ===================================================
    // VERIFY OWNER
    // ===================================================

    const {
      data: ownerRecord,
      error: ownerError,
    } =
      await adminClient
        .from("users")
        .select(
          "id, name, email, role, active"
        )
        .eq(
          "id",
          currentUser.id
        )
        .maybeSingle();

    if (ownerError) {
      console.error(
        "OWNER CHECK ERROR:",
        ownerError
      );

      throw new Error(
        "Unable to verify owner account."
      );
    }

    if (!ownerRecord) {
      return jsonResponse(
        {
          success: false,
          error:
            "Your user record was not found.",
        },
        403
      );
    }

    if (
      ownerRecord.role
        ?.toLowerCase() !==
      "owner"
    ) {
      return jsonResponse(
        {
          success: false,
          error:
            "Only the Owner can manage employees.",
        },
        403
      );
    }

    if (
      ownerRecord.active === false
    ) {
      return jsonResponse(
        {
          success: false,
          error:
            "Owner account is inactive.",
        },
        403
      );
    }

    // ===================================================
    // REQUEST BODY
    // ===================================================

    const body =
      await req.json();

    const action =
      body?.action || "create";

    // ===================================================
    // DELETE EMPLOYEE
    // ===================================================

    if (action === "delete") {

      const userId =
        String(
          body?.user_id || ""
        ).trim();

      if (!userId) {
        return jsonResponse(
          {
            success: false,
            error:
              "Employee user ID is required.",
          },
          400
        );
      }

      // -----------------------------------------------
      // NEVER DELETE OWNER
      // -----------------------------------------------

      if (
        userId ===
        currentUser.id
      ) {
        return jsonResponse(
          {
            success: false,
            error:
              "The Owner account cannot be deleted.",
          },
          403
        );
      }

      // -----------------------------------------------
      // GET TARGET USER
      // -----------------------------------------------

      const {
        data: targetUser,
        error:
          targetUserError,
      } =
        await adminClient
          .from("users")
          .select(
            "id, name, email, role"
          )
          .eq(
            "id",
            userId
          )
          .maybeSingle();

      if (targetUserError) {
        console.error(
          "TARGET USER ERROR:",
          targetUserError
        );

        throw new Error(
          "Unable to find employee."
        );
      }

      if (!targetUser) {
        return jsonResponse(
          {
            success: false,
            error:
              "Employee not found.",
          },
          404
        );
      }

      if (
        targetUser.role
          ?.toLowerCase() ===
        "owner"
      ) {
        return jsonResponse(
          {
            success: false,
            error:
              "The Owner account cannot be deleted.",
          },
          403
        );
      }

      // -----------------------------------------------
      // DELETE AUTH USER
      // -----------------------------------------------

      const {
        error:
          deleteAuthError,
      } =
        await adminClient.auth.admin.deleteUser(
          userId
        );

      if (deleteAuthError) {
        console.error(
          "DELETE AUTH USER ERROR:",
          deleteAuthError
        );

        throw new Error(
          deleteAuthError.message ||
            "Unable to delete employee login."
        );
      }

      // -----------------------------------------------
      // DELETE PUBLIC USERS RECORD
      // -----------------------------------------------

      const {
        error:
          deleteRowError,
      } =
        await adminClient
          .from("users")
          .delete()
          .eq(
            "id",
            userId
          );

      if (deleteRowError) {
        console.error(
          "DELETE USERS ROW ERROR:",
          deleteRowError
        );

        throw new Error(
          "Employee login was deleted, but the employee record could not be removed."
        );
      }

      return jsonResponse(
        {
          success: true,
          message:
            "Employee deleted successfully.",
          user_id: userId,
        },
        200
      );
    }

    // ===================================================
    // CREATE EMPLOYEE
    // ===================================================

    if (action === "create") {

      const cleanName =
        String(
          body?.name || ""
        ).trim();

      const cleanEmail =
        String(
          body?.email || ""
        )
          .trim()
          .toLowerCase();

      const password =
        String(
          body?.password || ""
        );

      const role =
        String(
          body?.role ||
            "Employee"
        );

      const active =
        body?.active !== false;

      // -----------------------------------------------
      // VALIDATION
      // -----------------------------------------------

      if (!cleanName) {
        return jsonResponse(
          {
            success: false,
            error:
              "Employee name is required.",
          },
          400
        );
      }

      if (!cleanEmail) {
        return jsonResponse(
          {
            success: false,
            error:
              "Employee email is required.",
          },
          400
        );
      }

      if (!password) {
        return jsonResponse(
          {
            success: false,
            error:
              "Employee password is required.",
          },
          400
        );
      }

      if (password.length < 6) {
        return jsonResponse(
          {
            success: false,
            error:
              "Password must contain at least 6 characters.",
          },
          400
        );
      }

      // -----------------------------------------------
      // ONLY EMPLOYEE ROLE
      // -----------------------------------------------

      const finalRole =
        role.toLowerCase() ===
        "owner"
          ? "Employee"
          : "Employee";

      // -----------------------------------------------
      // CREATE AUTH USER
      // -----------------------------------------------

      const {
        data: createdAuth,
        error:
          createAuthError,
      } =
        await adminClient.auth.admin.createUser(
          {
            email:
              cleanEmail,
            password,
            email_confirm:
              true,
            user_metadata: {
              name:
                cleanName,
              role:
                finalRole,
            },
          }
        );

      if (createAuthError) {
        console.error(
          "CREATE AUTH USER ERROR:",
          createAuthError
        );

        throw new Error(
          createAuthError.message ||
            "Unable to create employee login."
        );
      }

      if (
        !createdAuth.user
      ) {
        throw new Error(
          "Employee login was not created."
        );
      }

      const employeeId =
        createdAuth.user.id;

      // -----------------------------------------------
      // INSERT USERS RECORD
      // -----------------------------------------------

      const {
        error:
          insertError,
      } =
        await adminClient
          .from("users")
          .insert({
            id:
              employeeId,
            name:
              cleanName,
            email:
              cleanEmail,
            role:
              finalRole,
            active,
          });

      if (insertError) {

        console.error(
          "INSERT USER RECORD ERROR:",
          insertError
        );

        // ---------------------------------------------
        // ROLLBACK AUTH ACCOUNT
        // ---------------------------------------------

        await adminClient.auth.admin.deleteUser(
          employeeId
        );

        throw new Error(
          insertError.message ||
            "Unable to save employee record."
        );
      }

      return jsonResponse(
        {
          success: true,
          message:
            "Employee created successfully.",
          user: {
            id:
              employeeId,
            name:
              cleanName,
            email:
              cleanEmail,
            role:
              finalRole,
            active,
          },
        },
        200
      );
    }

    // ===================================================
    // UNKNOWN ACTION
    // ===================================================

    return jsonResponse(
      {
        success: false,
        error:
          "Invalid action. Use create or delete.",
      },
      400
    );

  } catch (error: any) {

    console.error(
      "CREATE EMPLOYEE FUNCTION ERROR:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Unable to process employee request.";

    return jsonResponse(
      {
        success: false,
        error: message,
      },
      500
    );
  }
});