import { useState } from "react"
import logo from "../../../assets/aa_erp-blue.png"
import loginBg from "../../../assets/login-bg.png"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { UnlockIcon, Loader2, Mail } from "lucide-react"
import { _postApi } from "@/redux/actions/api"
import { Link } from "react-router-dom"
import { toast } from "sonner"

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [emailError, setEmailError] = useState("")

  // Email validation function
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  // Handle email input change
  const handleEmailChange = (e) => {
    const value = e.target.value
    setEmail(value)

    // Clear error when user starts typing
    if (emailError) {
      setEmailError("")
    }
  }

  // Handle email blur (when user leaves the input field)
  const handleEmailBlur = () => {
    if (email && !validateEmail(email)) {
      setEmailError("Please enter a valid email address")
    }
  }

  const checkMail = () => {
    // Validate email before sending
    if (!email) {
      setEmailError("Email is required")
      return
    }

    if (!validateEmail(email)) {
      setEmailError("Please enter a valid email address")
      return
    }

    setLoading(true)
    setEmailError("") // Clear any existing errors

    _postApi(
      `/api/auth/check-mail`,
      { email: email },
      (resp) => {
        if (resp.success) {
          toast.success(resp.message)
          setEmail("")
          setLoading(false)
        } else {
          toast.error(resp.message || "Failed to send reset email.")
          setLoading(false)
        }
      },
      (err) => {
        console.error("API Error:", err)
        toast.error("Something went wrong while sending reset email.")
        setLoading(false)
      },
    )
  }

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault()
    checkMail()
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen w-full bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <div className="flex-1 flex items-center justify-center px-4 py-7 md:px-10">
        <div className="w-full max-w-md space-y-6 animate-fade-in">
          {/* Header */}
          <div className="space-y-4 text-center animate-slide-down">
            <div className="relative inline-block">
              <img
                src={logo}
                alt="Alh. Ashiru Yanmusa logo"
                className="mx-auto animate-scale-in"
                style={{ width: "9rem", height: "3.5rem" }}
              />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">
              Trouble logging in?
            </h1>
            <p className="text-sm text-gray-600">
              Enter your email and we'll send you a link to get back into your account.
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 space-y-6 border border-gray-100 animate-slide-up">
            <form className="space-y-5" onSubmit={handleSubmit}>
              {/* Icon */}
              <div className="flex justify-center">
                <div className="p-4 bg-blue-50 rounded-full">
                  <UnlockIcon className="w-12 h-12 text-[#4267B2]" />
                </div>
              </div>

              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-500" />
                  Email Address
                </Label>
                <Input
                  id="email"
                  required
                  type="email"
                  placeholder="Enter your email"
                  className={`border-2 transition-all ${
                    emailError
                      ? "border-red-500 focus:ring-red-500"
                      : "border-gray-300 focus:ring-[#4267B2] focus:border-[#4267B2]"
                  }`}
                  name="user_id"
                  onChange={handleEmailChange}
                  onBlur={handleEmailBlur}
                  value={email}
                />
                {emailError && (
                  <p className="text-red-500 text-sm animate-fade-in">
                    {emailError}
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-[#4267B2] to-blue-600 hover:from-[#4267B2]/90 hover:to-blue-600/90 text-white font-semibold py-3 rounded-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02]"
                disabled={loading || !email || emailError}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send Code"
                )}
              </Button>

              {/* Back to Login Link */}
              <div className="text-center">
                <Link
                  to="/app"
                  className="text-sm font-medium text-[#4267B2] hover:text-blue-700 underline transition-colors"
                >
                  Back to Log In
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
      <div
        className="lg:w-2/5 bg-cover bg-center hidden lg:block relative"
        style={{ backgroundImage: `url(${loginBg})` }}
        role="img"
        aria-label="Background image"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-[#4267B2]/85 to-blue-600/85"></div>
        <div className="relative z-10 flex items-center justify-center h-full p-8">
          <div className="text-white space-y-6 max-w-md animate-fade-in">
            <h3 className="text-4xl font-bold animate-slide-right">
              Welcome to Alh. Ashiru Yanmusa
            </h3>
            <p
              className="text-lg text-blue-100 leading-relaxed animate-slide-right"
              style={{ animationDelay: "0.2s" }}
            >
              Your complete business management solution. Streamline operations,
              track finances, and grow your business with confidence.
            </p>
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

        @keyframes slide-right {
          from {
            opacity: 0;
            transform: translateX(-30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.9);
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

        .animate-slide-right {
          animation: slide-right 0.6s ease-out forwards;
          opacity: 0;
        }

        .animate-scale-in {
          animation: scale-in 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  )
}
