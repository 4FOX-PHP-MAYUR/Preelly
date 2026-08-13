import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import {
  sendOtp,
  emailStart,
  clearError,
  enterGuestMode,
} from "@shared/store/slices/authSlice";
import toast from "react-hot-toast";
import { Mail } from "lucide-react";
import AuthSplitLayout, {
  AuthField,
  AuthPhoneField,
  AuthSocialButton,
} from "../components/Auth/AuthSplitLayout";
import {
  DEFAULT_COUNTRY_ISO,
  getCountryByIso,
} from "@shared/data/countryCodes";
import { apiUrl } from "@shared/utils/constants";
import { useAppleSignIn } from "@shared/hooks/useAppleSignIn";

function GoogleIcon() {
  return (
    <svg
      className="h-7 w-7"
      aria-hidden="true"
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="28" height="28" rx="4" fill="white" />
      <path
        d="M23.68 14.2285C23.68 13.5135 23.6158 12.826 23.4967 12.166H14V16.071H19.4267C19.1883 17.3268 18.4733 18.3902 17.4008 19.1052V21.6443H20.6733C22.58 19.8843 23.68 17.2993 23.68 14.2285Z"
        fill="#4285F4"
      />
      <path
        d="M14 24.0841C16.7225 24.0841 19.005 23.1858 20.6733 21.6458L17.4008 19.1066C16.5025 19.7116 15.3566 20.0783 14 20.0783C11.3783 20.0783 9.15079 18.3091 8.35329 15.9258H4.99829V18.5291C6.65746 21.8199 10.0583 24.0841 14 24.0841Z"
        fill="#34A853"
      />
      <path
        d="M8.35329 15.9155C8.15163 15.3105 8.03246 14.6688 8.03246 13.9996C8.03246 13.3305 8.15163 12.6888 8.35329 12.0838V9.48047H4.99829C4.31079 10.8371 3.91663 12.368 3.91663 13.9996C3.91663 15.6313 4.31079 17.1621 4.99829 18.5188L7.61079 16.4838L8.35329 15.9155Z"
        fill="#FBBC05"
      />
      <path
        d="M14 7.93102C15.485 7.93102 16.805 8.44435 17.8591 9.43435L20.7466 6.54685C18.9958 4.91518 16.7225 3.91602 14 3.91602C10.0583 3.91602 6.65746 6.18018 4.99829 9.48018L8.35329 12.0835C9.15079 9.70018 11.3783 7.93102 14 7.93102Z"
        fill="#EA4335"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg
      className="h-6 w-6 fill-current text-slate-900"
      aria-hidden="true"
      viewBox="0 0 26 26"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="26" height="26" rx="4" fill="white" />
      <path
        d="M21.5821 9.50071C21.4515 9.59971 19.1452 10.8691 19.1452 13.6917C19.1452 16.9564 22.0799 18.1114 22.1677 18.14C22.1542 18.2104 21.7015 19.7218 20.6204 21.2618C19.6565 22.617 18.6497 23.97 17.1182 23.97C15.5867 23.97 15.1925 23.101 13.4245 23.101C11.7016 23.101 11.089 23.9986 9.68808 23.9986C8.28719 23.9986 7.30972 22.7446 6.18586 21.2046C4.88407 19.3962 3.83228 16.5868 3.83228 13.9205C3.83228 9.64371 6.6791 7.37553 9.48087 7.37553C10.9696 7.37553 12.2106 8.33032 13.1453 8.33032C14.0349 8.33032 15.4223 7.31833 17.1159 7.31833C17.7578 7.31833 20.0641 7.37553 21.5821 9.50071ZM16.3119 5.50774C17.0123 4.69595 17.5078 3.56956 17.5078 2.44317C17.5078 2.28697 17.4943 2.12858 17.465 2.00098C16.3254 2.04278 14.9696 2.74237 14.152 3.66856C13.5101 4.38136 12.911 5.50774 12.911 6.64953C12.911 6.82113 12.9403 6.99273 12.9538 7.04773C13.0259 7.06093 13.143 7.07633 13.2601 7.07633C14.2826 7.07633 15.5687 6.40754 16.3119 5.50774Z"
        fill="black"
      />
    </svg>
  );
}

function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { loading, error, isAuthenticated } = useSelector(
    (state) => state.auth,
  );
  const params = new URLSearchParams(location.search);

  // Returning from the OTP screen via "Change" — prefill whichever value the
  // user already submitted so they aren't retyping it from scratch.
  const queryEmail = params.get("email") || "";
  const queryCountryIso = params.get("countryIso") || DEFAULT_COUNTRY_ISO;
  const queryPhoneDigits = (() => {
    const raw = params.get("phone") || "";
    if (!raw) return "";
    const dialCode = getCountryByIso(queryCountryIso).code.replace(/\D/g, "");
    // `phone` arrives as dialCode + local number concatenated (no separator) —
    // strip the dial code so the input only shows the local digits.
    return raw.startsWith(dialCode) ? raw.slice(dialCode.length) : raw;
  })();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: { email: queryEmail, phone: queryPhoneDigits },
  });
  const [oauthLoading, setOauthLoading] = useState(null);
  // Phone tab is the default per the new login design, unless the caller
  // asks for the email tab (e.g. returning from the email OTP screen).
  const [channel, setChannel] = useState(() =>
    new URLSearchParams(location.search).get("tab") === "email"
      ? "email"
      : "whatsapp",
  );
  const [countryIso, setCountryIso] = useState(queryCountryIso);

  const target = params.get("target") === "seller" ? "seller" : "buyer";
  // Set by the shared "Login Required" modal so guests land back on the page
  // (and protected action) they were on before being asked to log in. Persisted
  // to localStorage (like authTarget) so it survives the multi-step OTP/OAuth
  // hops that follow this page.
  const redirectParam = params.get("redirect");
  const redirectTo =
    redirectParam && redirectParam.startsWith("/") ? redirectParam : null;

  useEffect(() => {
    localStorage.setItem("authTarget", target);
    localStorage.setItem("authRedirectTo", redirectTo || "");
    if (isAuthenticated) {
      navigate(
        redirectTo ||
          (target === "seller" ? "/post-ad" : "/dashboard/settings"),
      );
    }
  }, [isAuthenticated, navigate, target, redirectTo]);

  useEffect(() => {
    if (error) {
      const message = typeof error === "string" ? error : error?.message;
      if (message) toast.error(message);
      dispatch(clearError());
    }
  }, [error, dispatch]);

  useEffect(() => {
    const oauthError = new URLSearchParams(location.search).get("oauthError");
    if (oauthError) {
      setOauthLoading(null);
      toast.error(decodeURIComponent(oauthError));
    }
  }, [location.search]);

  const onSubmit = async (data) => {
    try {
      if (channel === "whatsapp") {
        const phoneDigits = String(data.phone || "").replace(/\D/g, "");
        const dialCode = getCountryByIso(countryIso).code;
        const fullPhone = phoneDigits ? `${dialCode}${phoneDigits}` : "";

        if (!phoneDigits) {
          toast.error("Mobile number is required");
          return;
        }

        await dispatch(
          sendOtp({
            phone: fullPhone.replace(/\D/g, ""),
            phoneCountryCode: dialCode,
            phoneCountryIso: countryIso,
            mode: "login",
            channel: "whatsapp",
          }),
        ).unwrap();
        toast.success("Sign-in code sent to your WhatsApp");

        const query = new URLSearchParams({
          phone: fullPhone.replace(/\D/g, ""),
          countryIso,
          mode: "login",
          channel: "whatsapp",
        });
        navigate(`/verify-phone-otp?${query.toString()}`);
        return;
      }

      const email = data.email.trim();
      const result = await dispatch(emailStart({ email })).unwrap();
      toast.success(result?.message || "Verification code sent to your email");
      if (result?.mode === "signup") {
        // New user — created as U-XXXXXXXX. Run the email→mobile completion chain.
        navigate(
          `/verify-email-otp?email=${encodeURIComponent(email)}&flow=email-complete`,
        );
      } else {
        navigate(
          `/verify-email-otp?email=${encodeURIComponent(email)}&mode=login&channel=email`,
        );
      }
    } catch {
      // Error handled by useEffect
    }
  };

  const startSocialLogin = (provider) => {
    setOauthLoading(provider);
    const url = apiUrl(
      `/auth/oauth/${provider}?target=${encodeURIComponent(target)}`,
    );
    window.location.href = url;
  };

  // Apple runs in a popup and posts the identity token to the web-only
  // /auth/apple/web endpoint instead of leaving the page like Google's redirect
  // flow; the isAuthenticated effect above handles the navigation.
  const { startAppleSignIn } = useAppleSignIn({
    onStart: () => setOauthLoading("apple"),
    onFinish: () => setOauthLoading(null),
  });

  return (
    <AuthSplitLayout
      title="Login"
      mobileTitle="Welcome!"
      mobileSubtitle="Secure login with your phone number"
      subtitle={
        target === "seller"
          ? "Access your seller dashboard, manage listings, and reply to buyers without missing a step."
          : "Explore cars your way scroll effortlessly, discover the best deals, and drive home your perfect match."
      }
      switchLabel="Continue as Guest"
      switchTo="/"
      switchArrow
      switchOnClick={() => dispatch(enterGuestMode())}
      quote="I found my perfect car in minutes. Scrolling through Preelly made the whole process effortless."
      quoteAuthor="Aarav Mehta"
      quoteRole="Car Buyer"
    >
      <div className="mb-6 grid grid-cols-2 rounded-xl border border-[#e7e9f2] bg-[#f4f5fb]">
        <button
          type="button"
          onClick={() => setChannel("whatsapp")}
          className={`rounded-s-xl px-4 py-3.5 text-lg  font-helvetica transition ${
            channel === "whatsapp"
              ? "bg-brand text-white shadow-[0_8px_20px_rgba(0,0,255,0.25)]"
              : "text-[#232388] hover:bg-white/70"
          }`}
        >
          Phone
        </button>
        <button
          type="button"
          onClick={() => setChannel("email")}
          className={`rounded-e-xl px-4 py-3.5 text-lg  font-helvetica transition ${
            channel === "email"
              ? "bg-brand text-white shadow-[0_8px_20px_rgba(0,0,255,0.25)]"
              : "text-[#232388] hover:bg-white/70"
          }`}
        >
          Email
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {channel === "email" ? (
          <AuthField
            label="Email"
            type="email"
            icon={Mail}
            placeholder="Enter your email"
            error={errors.email?.message}
            {...register("email", {
              required: channel === "email" ? "Email is required" : false,
              pattern: {
                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                message: "Invalid email address",
              },
            })}
          />
        ) : (
          <AuthPhoneField
            label="Mobile Number"
            countryIso={countryIso}
            onCountryIsoChange={setCountryIso}
            placeholder="Phone number"
            error={errors.phone?.message}
            {...register("phone", {
              required:
                channel === "whatsapp" ? "Mobile number is required" : false,
              validate: (value) => {
                if (channel !== "whatsapp") return true;
                const digits = String(value || "").replace(/\D/g, "");
                return (
                  digits.length >= 6 || "Please enter a valid mobile number"
                );
              },
            })}
          />
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex h-14 w-full items-center justify-center rounded-full bg-brand px-6 text-base font-medium text-white shadow-[0_18px_40px_rgba(0,0,255,0.25)] transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : (
            <>
              <span className="min-[1025px]:hidden">Login</span>
              <span className="hidden min-[1025px]:inline">
                {channel === "whatsapp"
                  ? "Continue with WhatsApp"
                  : "Continue with Email"}
              </span>
            </>
          )}
        </button>
      </form>

      <div className="mt-8">
        <div className="flex items-center gap-4">
          <div className="h-px flex-1 bg-[#e7e9f2]" />
          <span className="text-center text-xs font-medium text-slate-400 min-[1025px]:text-sm min-[1025px]:uppercase min-[1025px]:tracking-[0.24em]">
            <span className="min-[1025px]:hidden">Or sign in using below accounts</span>
            <span className="hidden min-[1025px]:inline">Or</span>
          </span>
          <div className="h-px flex-1 bg-[#e7e9f2]" />
        </div>

        <div className="mt-6 flex justify-center gap-4 min-[1025px]:grid min-[1025px]:grid-cols-2">
          <AuthSocialButton
            label="Continue with Google"
            onClick={() => startSocialLogin("google")}
            disabled={!!oauthLoading}
            active={oauthLoading === "google"}
            className="h-14 w-14 shrink-0 min-[1025px]:h-14 min-[1025px]:w-full"
          >
            <GoogleIcon />
          </AuthSocialButton>
          <AuthSocialButton
            label="Continue with Apple"
            onClick={startAppleSignIn}
            disabled={!!oauthLoading}
            active={oauthLoading === "apple"}
            className="h-14 w-14 shrink-0 min-[1025px]:h-14 min-[1025px]:w-full"
          >
            <AppleIcon />
          </AuthSocialButton>
        </div>
      </div>
    </AuthSplitLayout>
  );
}

export default LoginPage;
