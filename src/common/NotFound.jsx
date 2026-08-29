import { useLocation, useNavigate } from "react-router-dom";
import { Home, ArrowLeft, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "../assets/aa_erp-blue.png";

export default function NotFound() {
  const location = useLocation();
  const navigate = useNavigate();

  const goTo = () => {
    const isInsideApp = location.pathname.includes("/app");
    if (isInsideApp) {
      navigate("/app/home");
    } else {
      navigate("/");
    }
  };

  const goBack = () => {
    navigate(-1);
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
        </div>

        {/* Content Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 space-y-6 border border-gray-100 animate-slide-up">
          <div className="text-center space-y-4">
            {/* 404 Icon */}
            <div className="flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-[var(--aa-navy)]/20 rounded-full blur-2xl"></div>
                <div className="relative bg-gradient-to-br from-[var(--aa-navy)] to-blue-600 rounded-full p-6">
                  <SearchX className="h-16 w-16 text-white animate-scale-in" />
                </div>
              </div>
            </div>

            {/* Error Code */}
            <div className="space-y-2">
              <h1 className="text-7xl font-bold text-[var(--aa-navy)] animate-scale-in">
                404
              </h1>
              <h2 className="text-2xl font-semibold text-gray-900">
                Page Not Found
              </h2>
              <p className="text-gray-600 max-w-md mx-auto">
                Oops! The page you&apos;re looking for doesn&apos;t exist or has
                been moved.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 pt-4">
              <Button
                onClick={goTo}
                className="w-full bg-gradient-to-r from-[var(--aa-navy)] to-blue-600 hover:from-[var(--aa-navy)]/90 hover:to-blue-600/90 text-white font-semibold py-3 rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02]"
              >
                <Home className="mr-2 h-5 w-5" />
                Go Back Home
              </Button>
              <Button
                onClick={goBack}
                variant="outline"
                className="w-full border-2 border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-3 rounded-lg transition-all"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Go Back
              </Button>
            </div>
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
