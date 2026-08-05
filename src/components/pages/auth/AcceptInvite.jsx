import React, { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { _postApi } from "@/redux/actions/api";

const AcceptInvite = () => {
  const [searchParams] = useSearchParams();
  const userId = searchParams.get("userId");
  const businessId = searchParams.get("businessId");

  const [showCheck, setShowCheck] = useState(false);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState("Processing your invitation...");

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowCheck(true);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const acceptInvitation = async () => {
      if (!userId || !businessId) {
        setSuccess(false);
        setMessage("Invalid invitation link.");
        return;
      }

      await _postApi(
        "/users/accept-invite",
        { userId, businessId },
        (res) => {
          if (res.success) {
            setSuccess(true);
            setMessage("You have been successfully added to the business.");
          } else {
            setSuccess(false);
            setMessage(res.message || "Failed to accept invitation.");
          }
        },
        (err) => {
          console.error("API error:", err);
          setSuccess(false);
          setMessage("Server error while accepting invitation.");
        }
      );
    };

    acceptInvitation();
  }, [userId, businessId]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-transparent">
      <div className="text-center">
        <div className="mb-6">
          <div
            className={`inline-flex items-center justify-center w-24 h-24 rounded-full ${
              success ? "bg-blue-500" : "bg-red-500"
            } transition-all duration-700 transform ${
              showCheck ? "scale-100 opacity-100" : "scale-0 opacity-0"
            }`}
          >
            <svg
              className={`w-12 h-12 text-white transition-all duration-500 delay-300 ${
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
                d={
                  success
                    ? "M5 13l4 4L19 7" // ✅ checkmark
                    : "M6 18L18 6M6 6l12 12" // ❌ cross
                }
                className={showCheck ? "animate-draw-check" : ""}
              />
            </svg>
          </div>
        </div>

        <h1
          className={`text-2xl font-semibold transition-all duration-500 delay-500 ${
            showCheck ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          } ${success ? "text-gray-800" : "text-red-700"}`}
        >
          {success ? "Invitation Accepted!" : "Invitation Failed!"}
        </h1>

        <p
          className={`mt-2 transition-all duration-500 delay-700 ${
            showCheck ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          } text-gray-600`}
        >
          {message}
        </p>

        <div
          className={`text-gray-600 mt-2 transition-all duration-500 delay-700 ${
            showCheck ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
        >
          Click{" "}
          <Link to="/login" className="fw-bold hover:!underline">
            here
          </Link>{" "}
          to go back to Log In
        </div>
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
  );
};

export default AcceptInvite;
