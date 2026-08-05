import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  Lock,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import logo from "../../../assets/aa_erp-blue.png";
import { _postApi, _fetchApi } from "@/redux/actions/api";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import useQuery from "@/common/Custom/Hook/useQuery";

export default function ResetPassword() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const query = useQuery();
  const resetToken = query.get("token");
  const [verifiedEmail, setVerifiedEmail] = useState("");

  useEffect(() => {
    if (!resetToken) return;
    _fetchApi(
      `/api/auth/verify?token=${encodeURIComponent(resetToken)}&type=reset`,
      (resp) => {
        if (resp.success && resp.email) {
          setVerifiedEmail(resp.email);
        }
      },
      () => {},
    );
  }, [resetToken]);

  // Password validation rules
  const passwordRules = [
    { rule: "At least 8 characters", valid: newPassword.length >= 8 },
    // { rule: "Contains uppercase letter", valid: /[A-Z]/.test(newPassword) },
    // { rule: "Contains lowercase letter", valid: /[a-z]/.test(newPassword) },
    { rule: "Contains number", valid: /\d/.test(newPassword) },
  ];

  const isPasswordValid = passwordRules.every((rule) => rule.valid);
  const passwordsMatch =
    newPassword === confirmPassword && confirmPassword !== "";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!isPasswordValid) {
      setError("Please ensure your password meets all requirements");
      return;
    }

    if (!passwordsMatch) {
      setError("Passwords do not match");
      return;
    }

    setIsSubmitting(true);

    _postApi(
      `/api/auth/reset-password`,
      { password: newPassword, token: resetToken },
      (resp) => {
        if (resp.success) {
          toast.success(resp.message);
          setIsSubmitting(false);
          setSuccess(true);
        } else {
          toast.error(resp.message || "Something went wrong.");
          setIsSubmitting(false);
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while sending password reset.");
        setIsSubmitting(false);
      }
    );
  };

  if (!resetToken) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 px-4 py-8">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="relative inline-block mx-auto">
            <img
              src={logo}
              alt="AA ERP logo"
              className="mx-auto"
              style={{ width: "9rem", height: "3.5rem" }}
            />
          </div>
          <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 border border-gray-100 space-y-4">
            <div className="flex justify-center">
              <XCircle className="h-16 w-16 text-amber-500" />
            </div>
            <h1 className="text-xl font-semibold text-gray-900">
              Link incomplete or expired
            </h1>
            <p className="text-sm text-gray-600">
              Open the password reset link from your email, or request a new
              reset from the login page.
            </p>
            <Button
              onClick={() => navigate("/login")}
              className="w-full bg-gradient-to-r from-[#4267B2] to-blue-600 text-white font-semibold py-3 rounded-lg"
            >
              <ArrowLeft className="mr-2 h-4 w-4 inline" />
              Back to Log In
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 px-4 py-8">
        <div className="w-full max-w-md space-y-6 animate-fade-in">
          {/* Header */}
          <div className="text-center space-y-4 animate-slide-down">
            <div className="relative inline-block mx-auto">
              <img
                src={logo}
                alt="AA ERP logo"
                className="mx-auto animate-scale-in"
                style={{ width: "9rem", height: "3.5rem" }}
              />
            </div>
          </div>

          {/* Success Card */}
          <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 space-y-6 border border-gray-100 animate-slide-up">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="relative">
                  <CheckCircle className="h-20 w-20 text-green-600 animate-scale-in" />
                  <div className="absolute inset-0 bg-green-100 rounded-full animate-ping opacity-20"></div>
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-semibold text-green-800">
                  Password Reset Successful!
                </h3>
                <p className="text-gray-600">
                  Your password has been successfully updated. You can now log
                  in with your new password.
                </p>
              </div>
              <div className="pt-4">
                <Button
                  onClick={() => navigate("/login")}
                  className="w-full bg-gradient-to-r from-[#4267B2] to-blue-600 hover:from-[#4267B2]/90 hover:to-blue-600/90 text-white font-semibold py-3 rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02]"
                >
                  Continue to Log In
                </Button>
              </div>
            </div>
          </div>
        </div>

        <style>{`
          @keyframes fade-in {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slide-down {
            from { opacity: 0; transform: translateY(-20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes slide-up {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes scale-in {
            from { opacity: 0; transform: scale(0.8); }
            to { opacity: 1; transform: scale(1); }
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

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 px-4 py-8">
      <div className="w-full max-w-md space-y-6 animate-fade-in">
        {/* Header */}
        <div className="space-y-4 text-center animate-slide-down">
          <div className="relative inline-block">
            <img
              src={logo}
              alt="AA ERP logo"
              className="mx-auto animate-scale-in"
              style={{ width: "9rem", height: "3.5rem" }}
            />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            Reset Your Password
          </h1>
          <p className="text-sm text-gray-600">
            Enter your new password below. Make sure it&apos;s strong and
            secure.
          </p>
          {verifiedEmail && (
            <p className="text-xs text-gray-500">
              Account: <span className="font-medium">{verifiedEmail}</span>
            </p>
          )}
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 space-y-6 border border-gray-100 animate-slide-up">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 animate-fade-in">
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              </div>
            )}

            {/* New Password Field */}
            <div className="space-y-2">
              <Label htmlFor="new-password" className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-gray-500" />
                New Password
              </Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter your new password"
                  className="border-2 pr-12 transition-all border-gray-300 focus:ring-[#4267B2] focus:border-[#4267B2]"
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 px-3 flex items-center hover:bg-gray-50 rounded-r transition-colors"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-500" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-500" />
                  )}
                </button>
              </div>
            </div>

            {/* Password Requirements */}
            {newPassword && (
              <div className="space-y-2 bg-gray-50 rounded-lg p-4 animate-fade-in">
                <Label className="text-sm font-medium text-gray-700">
                  Password Requirements
                </Label>
                <div className="space-y-2 mt-2">
                  {passwordRules.map((rule, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 text-sm"
                    >
                      {rule.valid ? (
                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-gray-300 flex-shrink-0" />
                      )}
                      <span
                        className={
                          rule.valid
                            ? "text-green-700 font-medium"
                            : "text-gray-500"
                        }
                      >
                        {rule.rule}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Confirm Password Field */}
            <div className="space-y-2">
              <Label
                htmlFor="confirm-password"
                className="flex items-center gap-2"
              >
                <Lock className="w-4 h-4 text-gray-500" />
                Confirm New Password
              </Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your new password"
                  className={`border-2 pr-12 transition-all ${
                    confirmPassword && !passwordsMatch
                      ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                      : confirmPassword && passwordsMatch
                      ? "border-green-500 focus:ring-green-500 focus:border-green-500"
                      : "border-gray-300 focus:ring-[#4267B2] focus:border-[#4267B2]"
                  }`}
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 px-3 flex items-center hover:bg-gray-50 rounded-r transition-colors"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-500" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-500" />
                  )}
                </button>
              </div>
              {confirmPassword && !passwordsMatch && (
                <p className="text-sm text-red-600 flex items-center gap-2 animate-fade-in">
                  <XCircle className="h-4 w-4" />
                  <span>Passwords do not match</span>
                </p>
              )}
              {confirmPassword && passwordsMatch && (
                <p className="text-sm text-green-600 flex items-center gap-2 animate-fade-in">
                  <CheckCircle className="h-4 w-4" />
                  <span>Passwords match</span>
                </p>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-[#4267B2] to-blue-600 hover:from-[#4267B2]/90 hover:to-blue-600/90 text-white font-semibold py-3 rounded-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02]"
              disabled={!isPasswordValid || !passwordsMatch || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Updating Password...
                </>
              ) : (
                "Update Password"
              )}
            </Button>
          </form>

          {/* Back to Login */}
          <div className="pt-4 border-t text-center">
            <Button
              variant="outline"
              onClick={() => navigate("/login")}
              className="border-2 border-gray-300 hover:bg-gray-50 text-gray-700 font-medium"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Log In
            </Button>
          </div>
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
