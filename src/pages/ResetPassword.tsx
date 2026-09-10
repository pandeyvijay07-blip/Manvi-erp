import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function ResetPassword() {
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const {
        data,
      } = await supabase.auth.getSession();

      if (data.session) {
        setReady(true);
      } else {
        alert(
          "Password reset link is invalid or expired."
        );

        navigate("/login", {
          replace: true,
        });
      }
    };

    checkSession();
  }, [navigate]);

  const resetPassword = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (password.length < 6) {
      alert(
        "Password must be at least 6 characters."
      );
      return;
    }

    if (password !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const {
        error,
      } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        alert(
          "Password reset failed: " +
            error.message
        );
        return;
      }

      alert(
        "Password changed successfully. Please login with your new password."
      );

      await supabase.auth.signOut();

      navigate("/login", {
        replace: true,
      });

    } catch (error: any) {
      alert(
        error?.message ||
          "Unable to reset password."
      );
    } finally {
      setLoading(false);
    }
  };

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <p className="text-gray-600">
          Verifying reset link...
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[80vh] px-4">

      <form
        onSubmit={resetPassword}
        className="
          bg-white
          shadow-xl
          rounded-2xl
          p-8
          w-full
          max-w-md
        "
      >

        <div className="flex justify-center mb-4">

          <div
            className="
              w-16
              h-16
              rounded-full
              bg-blue-700
              text-white
              flex
              items-center
              justify-center
              text-2xl
              font-bold
            "
          >
            M
          </div>

        </div>

        <h1
          className="
            text-3xl
            font-bold
            text-center
            text-blue-700
            mb-2
          "
        >
          Reset Password
        </h1>

        <p
          className="
            text-center
            text-gray-500
            mb-8
          "
        >
          Enter your new MANVI ERP password.
        </p>

        {/* NEW PASSWORD */}

        <label className="block mb-2 font-medium">
          New Password
        </label>

        <input
          type="password"
          placeholder="Enter new password"
          autoComplete="new-password"
          className="
            w-full
            border
            rounded-lg
            p-3
            mb-5
            focus:outline-none
            focus:ring-2
            focus:ring-blue-500
          "
          value={password}
          onChange={(e) =>
            setPassword(e.target.value)
          }
          disabled={loading}
        />

        {/* CONFIRM PASSWORD */}

        <label className="block mb-2 font-medium">
          Confirm New Password
        </label>

        <input
          type="password"
          placeholder="Confirm new password"
          autoComplete="new-password"
          className="
            w-full
            border
            rounded-lg
            p-3
            mb-6
            focus:outline-none
            focus:ring-2
            focus:ring-blue-500
          "
          value={confirmPassword}
          onChange={(e) =>
            setConfirmPassword(
              e.target.value
            )
          }
          disabled={loading}
        />

        <button
          type="submit"
          disabled={loading}
          className="
            w-full
            bg-blue-600
            text-white
            py-3
            rounded-lg
            font-semibold
            hover:bg-blue-700
            disabled:opacity-50
          "
        >
          {loading
            ? "Updating..."
            : "Reset Password"}
        </button>

      </form>

    </div>
  );
}