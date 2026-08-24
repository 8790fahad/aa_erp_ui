/* eslint-disable no-unused-vars */
/* eslint-disable react/no-unescaped-entities */
// EmailVerification.jsx
import useQuery from "@/common/Custom/Hook/useQuery";
import { _postApi } from "@/redux/actions/api";
import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const EmailVerification = () => {
  const [verificationCode, setVerificationCode] = useState([
    "",
    "",
    "",
    "",
    "",
    "",
  ]);
  const inputRefs = useRef([]);
  const [timer, setTimer] = useState(120); // 00:41 in seconds

  useEffect(() => {
    // Auto-focus first input on component mount
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }

    // Timer countdown
    const interval = setInterval(() => {
      setTimer((prevTimer) => {
        if (prevTimer <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prevTimer - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleChange = (index, value) => {
    if (!/^[0-9]$/.test(value) && value !== "") return;

    const newCode = [...verificationCode];
    newCode[index] = value;
    setVerificationCode(newCode);

    // Auto-focus next input
    if (value && index < 5 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();

    const pasteData = e.clipboardData.getData("Text").trim();
    if (!/^\d{6}$/.test(pasteData)) return;

    const newCode = pasteData.split("");
    setVerificationCode(newCode);

    // Focus the last input
    const lastIndex = newCode.length - 1;
    if (inputRefs.current[lastIndex]) {
      inputRefs.current[lastIndex].focus();
    }
  };

  const handleKeyDown = (index, e) => {
    // Handle backspace to go to previous input
    if (e.key === "Backspace" && index > 0 && !verificationCode[index]) {
      inputRefs.current[index - 1].focus();
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const query = useQuery().get("email");
//   const type = useQuery().get("type");
  const navigate = useNavigate();
  const handleVerify = () => {
    _postApi(
      "/api/auth/verify",
      { email: query, verificationCode: verificationCode.join("") },
      (response) => {
        if (response.message === "Email verified successfully") {
        //   if (type === "reset-password") {
        //     navigate(`/create-new-password?email=${query}&type=${type}`);
        //   } else {
            navigate("/login");
        //   }
        } else {
          console.log(response.message);
        }
      },
      (error) => {
        console.log(error);
      }
    );
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 w-full">
      <div className="w-full max-w-md p-8 bg-white">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">
            Check your email
          </h2>
          <p className="text-gray-500">
            please enter the six digit verification code that we sent to {query}
          </p>
        </div>

        <div className="flex justify-between mb-8">
          {verificationCode.map((digit, index) => (
            <input
              key={index}
              ref={(el) => (inputRefs.current[index] = el)}
              type="text"
              className="w-12 h-12 text-center text-xl font-semibold text-black border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--aa-accent)]"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onPaste={(e) => handlePaste(e)}
              onKeyDown={(e) => handleKeyDown(index, e)}
            />
          ))}
        </div>
        <div className="flex justify-center">
          <button
            className=" bg-[var(--aa-navy)] hover:bg-[var(--aa-navy)] text-white py-3 px-4 rounded-md mb-4 cursor-pointer"
            onClick={handleVerify}
          >
            Verify and Continue
          </button>
        </div>

        <div className="text-center text-sm text-gray-600">
          Didn't get the code?
          <button
            className={`text-[var(--aa-navy)] ml-1 ${
              timer === 0 ? "" : "opacity-50 cursor-not-allowed"
            }`}
            disabled={timer > 0}
          >
            Resend in {formatTime(timer)}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailVerification;
