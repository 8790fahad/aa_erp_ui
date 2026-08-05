import { useState, useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"

export default function Congratulations() {
  const [showCheck, setShowCheck] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowCheck(true)
    }, 300)

    return () => clearTimeout(timer)
  }, [])

  const login = () => {
    navigate("/login")
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <div className="text-center max-w-md px-6">
        <div className="mb-8">
          <div
            className={`inline-flex items-center justify-center w-32 h-32 rounded-full bg-[#4267B2] transition-all duration-700 transform ${
              showCheck ? "scale-100 opacity-100" : "scale-0 opacity-0"
            }`}
          >
            <svg
              className={`w-16 h-16 text-white transition-all duration-500 delay-300 ${
                showCheck ? "scale-100 opacity-100" : "scale-0 opacity-0"
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
                className={showCheck ? "animate-draw-check" : ""}
              />
            </svg>
          </div>
        </div>

        {/* Success Message */}
        <h1
          className={`text-3xl font-bold text-gray-900 mb-4 transition-all duration-500 delay-500 ${
            showCheck ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
        >
          Successfully Registered!
        </h1>

        <p
          className={`text-gray-600 text-base leading-relaxed mb-2 transition-all duration-500 delay-700 ${
            showCheck ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
        >
          Your account has been successfully created! A verification email has been sent to your inbox.
        </p>

        <p
          className={`text-gray-600 text-base transition-all duration-500 delay-900 ${
            showCheck ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
        >
          <Link
            to="/login"
            className="text-[#4267B2] font-semibold hover:underline transition-colors"
          >
            Click here
          </Link> to go back to Log In
        </p>
      </div>

      <style jsx>{`
        @keyframes draw-check {
          0% {
            stroke-dasharray: 0 100;
          }
          100% {
            stroke-dasharray: 100 0;
          }
        }

        .animate-draw-check {
          animation: draw-check 0.6s ease-in-out forwards;
          stroke-dasharray: 0 100;
        }
      `}</style>
    </div>
  )
}
