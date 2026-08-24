import { useState, useEffect, useRef } from "react";
import {
  CheckCircle,
  Loader2,
  XCircle,
  Mail,
  RotateCcw,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import useQuery from "@/common/Custom/Hook/useQuery";
import { Link, useNavigate } from "react-router-dom";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { toast } from "sonner";
import logo from "../../../assets/aa_erp-blue.png";

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
        }
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
    // Validate email before sending
    if (!email) {
      toast.error("Email is required");
      return;
    }

    setLoading(true);

    _postApi(
      `/api/auth/check-mail`,
      { email: email },
      (resp) => {
        if (resp.success) {
          toast.success(
            resp.message || "Verification email sent successfully!"
          );
          setLoading(false);
        } else {
          toast.error(resp.message || "Failed to send verification email");
          setLoading(false);
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while sending verification email.");
        setLoading(false);
      }
    );
  };

  const handleResendEmail = (e) => {
    e.preventDefault();
    checkMail();
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 px-4 py-8">
      <div className="w-full max-w-md space-y-6 animate-fade-in">
        {/* Header */}
        <div className="text-center space-y-4 animate-slide-down">
          <div className="relative inline-block mx-auto">
            <img
              src={logo}
              alt="YAMMUSA GLOBAL FARMS & AGRO ALLIED SERVICES logo"
              className="mx-auto animate-scale-in"
              style={{ width: "9rem", height: "3.5rem" }}
            />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            Email Verification
          </h1>
        </div>

        {/* Content Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 space-y-6 border border-gray-100 animate-slide-up">
          {status === "loading" && (
            <div className="space-y-6 text-center">
              <div className="flex justify-center">
                <div className="relative">
                  <Loader2 className="h-20 w-20 animate-spin text-[var(--aa-navy)]" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Mail className="h-8 w-8 text-[var(--aa-navy)]/50" />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-semibold text-gray-900">
                  Verifying your email address...
                </h3>
                <p className="text-gray-600">
                  Please wait while we verify your token
                </p>
              </div>
            </div>
          )}

          {status === "success" && (
            <div className="space-y-6 text-center animate-fade-in">
              <div className="flex justify-center">
                <div className="relative">
                  <CheckCircle className="h-20 w-20 text-green-600 animate-scale-in" />
                  <div className="absolute inset-0 bg-green-100 rounded-full animate-ping opacity-20"></div>
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-semibold text-green-800">
                  Verification Successful!
                </h3>
                <p className="text-gray-600">
                  {message || "Your email has been verified successfully."}
                </p>
              </div>
              <div className="space-y-3">
                <Link
                  to={
                    type === "login"
                      ? "/login"
                      : `/reset-password?token=${encodeURIComponent(token)}`
                  }
                  className="block w-full"
                >
                  <Button className="w-full bg-gradient-to-r from-[var(--aa-navy)] to-blue-600 hover:from-[var(--aa-navy)]/90 hover:to-blue-600/90 text-white font-semibold py-3 rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02]">
                    {type === "login" ? "Go to Login" : "Create New Password"}
                  </Button>
                </Link>
                <p className="text-sm text-gray-500">
                  You will be redirected automatically in 5 seconds...
                </p>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-6 text-center animate-fade-in">
              <div className="flex justify-center">
                <div className="relative">
                  <XCircle className="h-20 w-20 text-red-600 animate-scale-in" />
                  <div className="absolute inset-0 bg-red-100 rounded-full animate-ping opacity-20"></div>
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-semibold text-red-800">
                  Verification Failed
                </h3>
                <p className="text-gray-600">
                  {message || "Invalid or expired token"}
                </p>
              </div>
              <div className="space-y-3">
                <Button
                  onClick={handleResendEmail}
                  disabled={loading}
                  className="w-full bg-[var(--aa-navy)] hover:bg-[var(--aa-navy)]/90 text-white font-semibold py-3 rounded-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="mr-2 h-5 w-5" />
                      Resend Verification Email
                    </>
                  )}
                </Button>
                <Link to="/login" className="block">
                  <Button
                    variant="outline"
                    className="w-full border-2 border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-3 rounded-lg transition-all"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Login
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slide-down {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.6s ease-out forwards;
          opacity: 0;
        }

        .animate-slide-down {
          animation: slide-down 0.6s ease-out forwards;
        }

        .animate-slide-up {
          animation: slide-up 0.6s ease-out forwards;
        }

        .animate-scale-in {
          animation: scale-in 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
