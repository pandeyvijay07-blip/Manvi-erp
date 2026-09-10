import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import {
  FiEye,
  FiEyeOff,
  FiLock,
  FiMail,
  FiArrowLeft,
} from "react-icons/fi";

type Mode = "login" | "forgot" | "reset";

export default function Login() {
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [loading, setLoading] = useState(false);

  // =====================================================
  // CHECK PASSWORD RECOVERY LINK
  // =====================================================

  useEffect(() => {
    const checkRecoverySession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        const hash = window.location.hash;

        if (
          hash.includes("type=recovery") ||
          hash.includes("access_token")
        ) {
          setMode("reset");
        }
      }
    };

    checkRecoverySession();

    // Listen for Supabase password recovery event
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "PASSWORD_RECOVERY") {
          setMode("reset");
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // =====================================================
  // LOGIN
  // =====================================================

  const handleLogin = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (!email.trim()) {
      alert("Please enter your email.");
      return;
    }

    if (!password) {
      alert("Please enter your password.");
      return;
    }

    setLoading(true);

    try {
      const {
        data,
        error,
      } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        console.error(
          "MANVI LOGIN ERROR:",
          error
        );

        alert(
          "Login failed: " +
            error.message
        );

        return;
      }

      if (!data.user || !data.session) {
        alert(
          "Login failed. No active session was created."
        );

        return;
      }

      // =================================================
      // CHECK USER RECORD
      // =================================================

      const {
        data: userRecord,
        error: userError,
      } = await supabase
        .from("users")
        .select(
          "id, name, email, role, active"
        )
        .eq("id", data.user.id)
        .maybeSingle();

      if (userError) {
        console.error(
          "USER RECORD ERROR:",
          userError
        );
      }

      // =================================================
      // CHECK ACTIVE USER
      // =================================================

      if (
        userRecord &&
        userRecord.active === false
      ) {
        await supabase.auth.signOut();

        alert(
          "Your MANVI ERP account is inactive. Please contact the Owner."
        );

        return;
      }

      console.log(
        "MANVI LOGIN SUCCESS:",
        userRecord || data.user
      );

      alert(
        "Welcome to MANVI ERP"
      );

      navigate("/", {
        replace: true,
      });
    } catch (error: any) {
      console.error(
        "MANVI LOGIN EXCEPTION:",
        error
      );

      alert(
        error?.message ||
          "Unable to login."
      );
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // FORGOT PASSWORD
  // =====================================================

  const handleForgotPassword = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (!email.trim()) {
      alert(
        "Please enter your registered email address."
      );
      return;
    }

    setLoading(true);

    try {
      const redirectUrl =
        `${window.location.origin}/login`;

      const {
        error,
      } =
        await supabase.auth.resetPasswordForEmail(
          email.trim(),
          {
            redirectTo: redirectUrl,
          }
        );

      if (error) {
        console.error(
          "FORGOT PASSWORD ERROR:",
          error
        );

        alert(
          "Unable to send reset email: " +
            error.message
        );

        return;
      }

      alert(
        "Password reset link has been sent to your email. Please check your inbox."
      );

      setMode("login");
    } catch (error: any) {
      console.error(
        "FORGOT PASSWORD EXCEPTION:",
        error
      );

      alert(
        error?.message ||
          "Unable to send password reset email."
      );
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // RESET PASSWORD
  // =====================================================

  const handleResetPassword = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (!newPassword) {
      alert(
        "Please enter your new password."
      );
      return;
    }

    if (newPassword.length < 6) {
      alert(
        "Password must be at least 6 characters."
      );
      return;
    }

    if (!confirmPassword) {
      alert(
        "Please confirm your new password."
      );
      return;
    }

    if (
      newPassword !==
      confirmPassword
    ) {
      alert(
        "Passwords do not match."
      );
      return;
    }

    setLoading(true);

    try {
      const {
        error,
      } =
        await supabase.auth.updateUser({
          password: newPassword,
        });

      if (error) {
        console.error(
          "RESET PASSWORD ERROR:",
          error
        );

        alert(
          "Unable to reset password: " +
            error.message
        );

        return;
      }

      alert(
        "Password changed successfully. Please login with your new password."
      );

      // Sign out after changing password
      await supabase.auth.signOut();

      setPassword("");
      setNewPassword("");
      setConfirmPassword("");

      // Remove recovery parameters
      window.history.replaceState(
        {},
        document.title,
        "/login"
      );

      setMode("login");
    } catch (error: any) {
      console.error(
        "RESET PASSWORD EXCEPTION:",
        error
      );

      alert(
        error?.message ||
          "Unable to reset password."
      );
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // BACK TO LOGIN
  // =====================================================

  const backToLogin = () => {
    setMode("login");
    setNewPassword("");
    setConfirmPassword("");
  };

  // =====================================================
  // LOGIN SCREEN
  // =====================================================

  if (mode === "login") {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">

        <form
          onSubmit={handleLogin}
          className="
            bg-white
            shadow-xl
            rounded-2xl
            p-6
            md:p-8
            w-full
            max-w-md
            border
            border-slate-100
          "
        >

          {/* LOGO */}

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
                shadow-lg
              "
            >
              M
            </div>

          </div>

          {/* TITLE */}

          <h1
            className="
              text-3xl
              font-bold
              text-center
              text-blue-700
            "
          >
            MANVI ERP
          </h1>

          <p
            className="
              text-center
              text-gray-500
              mt-1
              mb-7
            "
          >
            MANVI MILK AGENCIES
          </p>

          {/* EMAIL */}

          <label
            className="
              block
              mb-2
              font-semibold
              text-gray-700
            "
          >
            Email
          </label>

          <div
            className="
              flex
              items-center
              border
              rounded-xl
              px-3
              mb-5
              focus-within:ring-2
              focus-within:ring-blue-500
            "
          >

            <FiMail
              className="
                text-gray-400
                text-lg
              "
            />

            <input
              type="email"
              placeholder="Enter email"
              autoComplete="email"
              value={email}
              onChange={(e) =>
                setEmail(
                  e.target.value
                )
              }
              disabled={loading}
              className="
                w-full
                p-3
                outline-none
                bg-transparent
              "
            />

          </div>

          {/* PASSWORD */}

          <label
            className="
              block
              mb-2
              font-semibold
              text-gray-700
            "
          >
            Password
          </label>

          <div
            className="
              flex
              items-center
              border
              rounded-xl
              px-3
              mb-2
              focus-within:ring-2
              focus-within:ring-blue-500
            "
          >

            <FiLock
              className="
                text-gray-400
                text-lg
              "
            />

            <input
              type={
                showPassword
                  ? "text"
                  : "password"
              }
              placeholder="Enter password"
              autoComplete="current-password"
              value={password}
              onChange={(e) =>
                setPassword(
                  e.target.value
                )
              }
              disabled={loading}
              className="
                w-full
                p-3
                outline-none
                bg-transparent
              "
            />

            <button
              type="button"
              onClick={() =>
                setShowPassword(
                  !showPassword
                )
              }
              className="
                text-gray-500
                hover:text-blue-700
              "
            >
              {showPassword ? (
                <FiEyeOff />
              ) : (
                <FiEye />
              )}
            </button>

          </div>

          {/* FORGOT PASSWORD */}

          <div className="text-right mb-6">

            <button
              type="button"
              onClick={() =>
                setMode("forgot")
              }
              disabled={loading}
              className="
                text-sm
                text-blue-600
                hover:text-blue-800
                font-semibold
              "
            >
              Forgot Password?
            </button>

          </div>

          {/* LOGIN */}

          <button
            type="submit"
            disabled={loading}
            className="
              w-full
              bg-blue-600
              hover:bg-blue-700
              text-white
              py-3
              rounded-xl
              font-bold
              shadow
              transition
              disabled:opacity-50
              disabled:cursor-not-allowed
            "
          >
            {loading
              ? "Signing In..."
              : "Login"}
          </button>

          {/* FOOTER */}

          <p
            className="
              text-center
              text-xs
              text-gray-400
              mt-6
            "
          >
            MANVI ERP V29
          </p>

        </form>

      </div>
    );
  }

  // =====================================================
  // FORGOT PASSWORD SCREEN
  // =====================================================

  if (mode === "forgot") {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">

        <form
          onSubmit={
            handleForgotPassword
          }
          className="
            bg-white
            shadow-xl
            rounded-2xl
            p-6
            md:p-8
            w-full
            max-w-md
            border
            border-slate-100
          "
        >

          <button
            type="button"
            onClick={backToLogin}
            className="
              flex
              items-center
              gap-2
              text-blue-600
              mb-6
              font-semibold
            "
          >
            <FiArrowLeft />
            Back to Login
          </button>

          <div
            className="
              w-14
              h-14
              rounded-full
              bg-blue-100
              text-blue-700
              flex
              items-center
              justify-center
              text-2xl
              mx-auto
              mb-4
            "
          >
            <FiLock />
          </div>

          <h1
            className="
              text-2xl
              font-bold
              text-center
              text-blue-700
            "
          >
            Forgot Password
          </h1>

          <p
            className="
              text-center
              text-gray-500
              text-sm
              mt-2
              mb-6
            "
          >
            Enter your registered email and
            we will send you a password reset
            link.
          </p>

          <label
            className="
              block
              mb-2
              font-semibold
              text-gray-700
            "
          >
            Email
          </label>

          <div
            className="
              flex
              items-center
              border
              rounded-xl
              px-3
              mb-6
              focus-within:ring-2
              focus-within:ring-blue-500
            "
          >

            <FiMail
              className="
                text-gray-400
              "
            />

            <input
              type="email"
              placeholder="Enter registered email"
              autoComplete="email"
              value={email}
              onChange={(e) =>
                setEmail(
                  e.target.value
                )
              }
              disabled={loading}
              className="
                w-full
                p-3
                outline-none
                bg-transparent
              "
            />

          </div>

          <button
            type="submit"
            disabled={loading}
            className="
              w-full
              bg-blue-600
              hover:bg-blue-700
              text-white
              py-3
              rounded-xl
              font-bold
              disabled:opacity-50
            "
          >
            {loading
              ? "Sending..."
              : "Send Reset Link"}
          </button>

        </form>

      </div>
    );
  }

  // =====================================================
  // RESET PASSWORD SCREEN
  // =====================================================

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">

      <form
        onSubmit={
          handleResetPassword
        }
        className="
          bg-white
          shadow-xl
          rounded-2xl
          p-6
          md:p-8
          w-full
          max-w-md
          border
          border-slate-100
        "
      >

        <div
          className="
            w-14
            h-14
            rounded-full
            bg-blue-100
            text-blue-700
            flex
            items-center
            justify-center
            text-2xl
            mx-auto
            mb-4
          "
        >
          <FiLock />
        </div>

        <h1
          className="
            text-2xl
            font-bold
            text-center
            text-blue-700
          "
        >
          Reset Password
        </h1>

        <p
          className="
            text-center
            text-gray-500
            text-sm
            mt-2
            mb-6
          "
        >
          Create a new password for your
          MANVI ERP account.
        </p>

        {/* NEW PASSWORD */}

        <label
          className="
            block
            mb-2
            font-semibold
            text-gray-700
          "
        >
          New Password
        </label>

        <div
          className="
            flex
            items-center
            border
            rounded-xl
            px-3
            mb-5
            focus-within:ring-2
            focus-within:ring-blue-500
          "
        >

          <FiLock
            className="
              text-gray-400
            "
          />

          <input
            type={
              showNewPassword
                ? "text"
                : "password"
            }
            placeholder="Enter new password"
            value={newPassword}
            onChange={(e) =>
              setNewPassword(
                e.target.value
              )
            }
            disabled={loading}
            className="
              w-full
              p-3
              outline-none
              bg-transparent
            "
          />

          <button
            type="button"
            onClick={() =>
              setShowNewPassword(
                !showNewPassword
              )
            }
            className="
              text-gray-500
            "
          >
            {showNewPassword ? (
              <FiEyeOff />
            ) : (
              <FiEye />
            )}
          </button>

        </div>

        {/* CONFIRM PASSWORD */}

        <label
          className="
            block
            mb-2
            font-semibold
            text-gray-700
          "
        >
          Confirm Password
        </label>

        <div
          className="
            flex
            items-center
            border
            rounded-xl
            px-3
            mb-6
            focus-within:ring-2
            focus-within:ring-blue-500
          "
        >

          <FiLock
            className="
              text-gray-400
            "
          />

          <input
            type={
              showConfirmPassword
                ? "text"
                : "password"
            }
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) =>
              setConfirmPassword(
                e.target.value
              )
            }
            disabled={loading}
            className="
              w-full
              p-3
              outline-none
              bg-transparent
            "
          />

          <button
            type="button"
            onClick={() =>
              setShowConfirmPassword(
                !showConfirmPassword
              )
            }
            className="
              text-gray-500
            "
          >
            {showConfirmPassword ? (
              <FiEyeOff />
            ) : (
              <FiEye />
            )}
          </button>

        </div>

        {/* RESET BUTTON */}

        <button
          type="submit"
          disabled={loading}
          className="
            w-full
            bg-blue-600
            hover:bg-blue-700
            text-white
            py-3
            rounded-xl
            font-bold
            disabled:opacity-50
          "
        >
          {loading
            ? "Updating Password..."
            : "Reset Password"}
        </button>

      </form>

    </div>
  );
}