import { useState, useEffect, useRef } from "react";
import {
  CheckCircle,
  Loader2,
  XCircle,
  RotateCcw,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import useQuery from "@/common/Custom/Hook/useQuery";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import AuthShell, { AUTH_BRAND } from "./AuthShell";

export default function TokenVerification() {
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const hasRun = useRef(false);
  const query = useQuery();

  const token = query.get("token");
  const email = query.get("email");
  const type = query.get("type");

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const verifyToken = async () => {
      setStatus("loading");
      setMessage("");

      _fetchApi(
        `/api/auth/verify?token=${token}&type=${type}&email=${email}`,
        (resp) => {
          if (resp.success) {
            setStatus("success");
            setTimeout(() => {
              if (resp.type === "login") {
                navigate("/login");
              } else if (resp.type === "reset") {
                navigate(`/reset-password?token=${encodeURIComponent(token)}`);
              } else {
                navigate("/login");
              }
            }, 5000);
            setMessage(resp.message);
          } else {
            setStatus("error");
            setMessage(resp.message || "Invalid or expired token");
          }
        },
        (err) => {
          console.error("API Error:", err);
          setStatus("error");
          setMessage("Something went wrong. Please try again later.");
        },
      );
    };

    if (token && email && type) {
      verifyToken();
    } else {
      setStatus("error");
      setMessage("Missing verification parameters in the URL.");
    }
  }, [token, email, type, navigate]);

  const checkMail = () => {
    if (!email) {
      toast.error("Email is required");
      return;
    }
    setLoading(true);
    _postApi(
      `/api/auth/check-mail`,
      { email },
      (resp) => {
        if (resp.success) {
          toast.success(
            resp.message || "Verification email sent successfully!",
          );
        } else {
          toast.error(resp.message || "Failed to send verification email");
        }
        setLoading(false);
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while sending verification email.");
        setLoading(false);
      },
    );
  };

  const nextHref =
    type === "login"
      ? "/login"
      : `/reset-password?token=${encodeURIComponent(token || "")}`;

  return (
    <AuthShell
      title="Email Verification"
      subtitle={
        <>
          Confirming access to{" "}
          <span className="font-medium text-slate-700">{AUTH_BRAND.name}</span>
        </>
      }
    >
      <div className="flex flex-1 flex-col">
        {status === "loading" && (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <Loader2
              className="h-10 w-10 animate-spin"
              style={{ color: AUTH_BRAND.button }}
            />
            <h3 className="mt-5 text-lg font-semibold text-slate-900">
              Verifying your email…
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Please wait while we confirm this link.
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-1 flex-col">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
              <CheckCircle className="h-7 w-7 text-emerald-600" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-900">
              Verification Successful!
            </h3>
            <p className="mt-1 text-[15px] text-slate-500">
              {message || "Your email has been verified successfully."}
            </p>
            <Link
              to={nextHref}
              className="mt-5 flex h-11 w-full items-center justify-center rounded-md text-[15px] font-semibold text-white transition hover:brightness-105"
              style={{ backgroundColor: AUTH_BRAND.button }}
            >
              {type === "login" ? "Go to Login" : "Create New Password"}
            </Link>
            <p className="mt-3 text-center text-xs text-slate-400">
              You will be redirected automatically in 5 seconds…
            </p>
            <p className="mt-auto pt-8 text-center text-[11px] tracking-wide text-slate-400">
              This solution is powered by Nexifour Limited
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-1 flex-col">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
              <XCircle className="h-7 w-7 text-red-500" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-900">
              Verification Failed
            </h3>
            <p className="mt-1 text-[15px] text-slate-500">
              {message || "Invalid or expired token"}
            </p>
            <button
              type="button"
              onClick={checkMail}
              disabled={loading}
              className="mt-5 flex h-11 w-full items-center justify-center rounded-md text-[15px] font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: AUTH_BRAND.button }}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Resend verification email
                </>
              )}
            </button>
            <Link
              to="/login"
              className="mt-4 text-center text-xs font-medium hover:underline"
              style={{ color: AUTH_BRAND.button }}
            >
              Back to Log In
            </Link>
            <p className="mt-auto pt-8 text-center text-[11px] tracking-wide text-slate-400">
              This solution is powered by Nexifour Limited
            </p>
          </div>
        )}
      </div>
    </AuthShell>
  );
}
