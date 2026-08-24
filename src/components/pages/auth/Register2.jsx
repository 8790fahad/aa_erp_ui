"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Eye,
  EyeOff,
  Loader,
  CheckCircle2,
  User,
  Building2,
  Lock,
  ArrowRight,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useDispatch } from "react-redux";
import { signup } from "@/redux/actions/auth";
import { getSidebarByAppType } from "@/components/sidebars/sidebarModules";
import { apiURL } from "@/redux/actions/api";
import logo from "../../../assets/aa_erp-blue.png";
import registerBg from "../../../assets/register-bg-medium.png";
import Congratulations from "./Congratulations";
import { v4 as UUIDV4 } from "uuid";

export default function Register2() {
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showCongrats, setShowCongrats] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const dispatch = useDispatch();
  const [form, setForm] = useState({
    query_type: "new_admin",
    firstname: "",
    lastname: "",
    username: "",
    email: "",
    description: "",
    rc: "",
    tin: "",
    fax: "",
    phone: "",
    role: "Admin",
    password: "",
    confirmPassword: "",
    busName: "",
    busType: [], // Changed to array for multi-select
    address: "",
    facilityId: UUIDV4(),
  });

  const resetForm = () => {
    setForm({
      firstname: "",
      lastname: "",
      username: "",
      email: "",
      tin: "",
      phone: "",
      password: "",
      confirmPassword: "",
      busName: "",
      busType: "",
      address: "",
    });
  };

  const accessDefiner = () => {
    const functionalities = [];
    const accessToSet = new Set();

    // Handle multiple business types
    const businessTypes = Array.isArray(form.busType)
      ? form.busType
      : form.busType
      ? [form.busType]
      : [];

    // Collect all unique functionalities and access from all selected business types
    businessTypes.forEach((busType) => {
      const sidebarItems = getSidebarByAppType(busType);

      sidebarItems.forEach((item) => {
        if (item?.title) {
          accessToSet.add(item.title);
        }

        if (Array.isArray(item.items)) {
          item?.items?.forEach((child) => {
            if (child.title) {
              functionalities.push(child.title);
            }
            child.subFunctionalities?.forEach((sub) => {
              if (sub?.title) functionalities.push(sub.title);
            });
          });
        }
      });
    });

    // Remove duplicates from functionalities
    const uniqueFunctionalities = [...new Set(functionalities)];

    return {
      accessTo: Array.from(accessToSet),
      functionalities: uniqueFunctionalities,
    };
  };

  const dSame = form.password === form.confirmPassword;

  const busTypeOptions = [
    {
      name: "Retailers",
      value: "retailers",
      description: "Sell products directly to customers",
    },
    {
      name: "Manufacturing",
      value: "manufacturing",
      description: "Produce goods from raw materials",
    },
    {
      name: "Recycling",
      value: "recycling",
      description: "Process and recycle materials",
    },
    {
      name: "Services",
      value: "services",
      description: "Provide services to clients",
    },
    {
      name: "Contractors",
      value: "contractors",
      description: "provide specialized services",
    },
  ];

  const handleBusinessTypeChange = (value, checked) => {
    setForm((prev) => {
      const currentTypes = Array.isArray(prev.busType)
        ? prev.busType
        : prev.busType
        ? [prev.busType]
        : [];

      if (checked) {
        // Add to selection if not already present
        if (!currentTypes.includes(value)) {
          return { ...prev, busType: [...currentTypes, value] };
        }
      } else {
        // Remove from selection
        return {
          ...prev,
          busType: currentTypes.filter((type) => type !== value),
        };
      }
      return prev;
    });
  };

  const handleChange = ({ target: { name, value } }) => {
    setForm((p) => ({
      ...p,
      [name]: value,
    }));

    // Check email when it changes
    if (name === "email" && value.trim() !== "") {
      checkEmailExists(value.trim());
    } else if (name === "email" && value.trim() === "") {
      setEmailError("");
    }
  };

  const checkEmailExists = async (email) => {
    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailError("");
      return;
    }

    setIsCheckingEmail(true);
    setEmailError("");

    try {
      const response = await fetch(`${apiURL}/api/auth/check-email-exists`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (data.exists) {
        setEmailError(
          "This email is already registered. Please use a different email."
        );
      } else {
        setEmailError("");
      }
    } catch (error) {
      console.error("Error checking email:", error);
      // Don't show error on network failure, allow user to proceed
      setEmailError("");
    } finally {
      setIsCheckingEmail(false);
    }
  };

  const totalSteps = 4;

  const validateStep = (step) => {
    switch (step) {
      case 1:
        // Personal Information
        return (
          form.firstname.trim() !== "" &&
          form.lastname.trim() !== "" &&
          form.email.trim() !== "" &&
          form.phone.trim() !== "" &&
          !emailError // Email must not exist
        );
      case 2:
        // Business Details
        return (
          form.busName.trim() !== "" &&
          form.address.trim() !== "" &&
          form.description.trim() !== "" &&
          form.business_phone?.trim() !== "" &&
          form.business_email?.trim() !== "" &&
          form.rc?.trim() !== ""
        );
      case 3:
        // Business Type(s)
        return Array.isArray(form.busType)
          ? form.busType.length > 0
          : form.busType !== "";
      case 4:
        // Password
        return (
          form.password.trim() !== "" &&
          form.password.length >= 6 &&
          form.confirmPassword.trim() !== "" &&
          dSame
        );
      default:
        return false;
    }
  };

  const validateForm = () => {
    return (
      validateStep(1) && validateStep(2) && validateStep(3) && validateStep(4)
    );
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (!completedSteps.includes(currentStep)) {
        setCompletedSteps([...completedSteps, currentStep]);
      }
      if (currentStep < totalSteps) {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const goToStep = (step) => {
    // Allow going to completed steps or next step
    if (completedSteps.includes(step - 1) || step <= currentStep) {
      setCurrentStep(step);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) {
      alert("Please fill in all required fields");
      return;
    }

    setIsLoading(true);

    const { accessTo, functionalities } = accessDefiner();
    // console.log(accessDefiner());
    form.accessTo = accessTo;
    form.functionalities = functionalities;
    // Ensure busType is sent as array
    form.busType = Array.isArray(form.busType)
      ? form.busType
      : form.busType
      ? [form.busType]
      : [];

    const goHome = () => {
      resetForm();
      setIsLoading(false);
      setShowCongrats(true);
    };

    const error = (err) => {
      console.log(err);
      setIsLoading(false);
    };

    // console.log(form);
    console.log(form, "form================");
    dispatch(signup(form, goHome, error));
  };

  const getStepIcon = (step) => {
    switch (step) {
      case 1:
        return <User className="w-5 h-5" />;
      case 2:
        return <Building2 className="w-5 h-5" />;
      case 3:
        return <Building2 className="w-5 h-5" />;
      case 4:
        return <Lock className="w-5 h-5" />;
      default:
        return null;
    }
  };

  const getStepTitle = (step) => {
    switch (step) {
      case 1:
        return "Personal Info";
      case 2:
        return "Business Details";
      case 3:
        return "Business Type";
      case 4:
        return "Set Password";
      default:
        return "";
    }
  };

  return showCongrats ? (
    <Congratulations />
  ) : (
    <div className="flex flex-col lg:flex-row min-h-screen w-full bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <div className="flex-1 flex items-center justify-center px-4 py-7 md:px-10">
        <div className="w-full max-w-2xl space-y-6 animate-fade-in">
          {/* Header */}
          <div className="space-y-4 text-center animate-slide-down">
            <div className="relative inline-block">
              <img
                src={logo}
                alt="YAMMUSA GLOBAL FARMS & AGRO ALLIED SERVICES logo"
                className="mx-auto animate-scale-in"
                style={{ width: "9rem", height: "3.5rem" }}
              />
              {currentStep === 1 && (
                <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-yellow-400 animate-pulse" />
              )}
            </div>
            <h1 className="text-3xl font-bold text-gray-900">
              Let&apos;s Get Started! 🚀
            </h1>
            <p className="text-sm text-gray-600">
              Just {totalSteps} quick steps to create your account
            </p>
          </div>

          {/* Progress Bar */}
          <div className="bg-white rounded-xl shadow-lg py-6 animate-slide-up">
            <div className="flex items-center justify-center mb-4">
              {[1, 2, 3, 4].map((step) => {
                const isCompleted = completedSteps.includes(step);
                const isCurrent = currentStep === step;
                const isAccessible =
                  step <= currentStep || completedSteps.includes(step - 1);

                return (
                  <div
                    key={step}
                    className="flex items-center"
                    onClick={() => isAccessible && goToStep(step)}
                    style={{ cursor: isAccessible ? "pointer" : "not-allowed" }}
                  >
                    <div className="flex items-center">
                      <div
                        className={`relative flex items-center justify-center w-12 h-12 rounded-full font-semibold transition-all transform ${
                          isCompleted
                            ? "bg-green-500 text-white scale-110 shadow-lg"
                            : isCurrent
                            ? "bg-[var(--aa-navy)] text-white scale-110 shadow-lg ring-4 ring-blue-200"
                            : "bg-gray-200 text-gray-500"
                        } ${isAccessible ? "hover:scale-105" : ""}`}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="w-6 h-6 animate-scale-in" />
                        ) : (
                          getStepIcon(step)
                        )}
                      </div>
                      {step < totalSteps && (
                        <div
                          className={`w-16 h-2 mx-2 rounded-full transition-all ${
                            isCompleted
                              ? "bg-green-500"
                              : step < currentStep
                              ? "bg-[var(--aa-navy)]"
                              : "bg-gray-200"
                          }`}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-[var(--aa-navy)] mb-2">
                Step {currentStep} of {totalSteps}: {getStepTitle(currentStep)}
              </p>
              <div className="mx-auto w-full max-w-md bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-[var(--aa-navy)] to-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${(currentStep / totalSteps) * 100}%` }}
                />
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 space-y-6 border border-gray-100 animate-slide-up">
              {/* Step 1: Personal Information */}
              {currentStep === 1 && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <User className="w-5 h-5 text-[var(--aa-navy)]" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">
                        Tell us about yourself
                      </h2>
                      <p className="text-sm text-gray-600">
                        We&apos;ll use this to personalize your experience
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div
                      className="space-y-2 animate-fade-in"
                      style={{ animationDelay: "0.1s" }}
                    >
                      <Label htmlFor="firstname">
                        First Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        className="border-2 border-gray-300 focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-[var(--aa-navy)] transition-all"
                        id="firstname"
                        name="firstname"
                        placeholder="John"
                        value={form.firstname}
                        onChange={handleChange}
                        required
                      />
                    </div>
                    <div
                      className="space-y-2 animate-fade-in"
                      style={{ animationDelay: "0.2s" }}
                    >
                      <Label htmlFor="lastname">
                        Last Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        className="border-2 border-gray-300 focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-[var(--aa-navy)] transition-all"
                        id="lastname"
                        name="lastname"
                        placeholder="Doe"
                        value={form.lastname}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div
                      className="space-y-2 animate-fade-in"
                      style={{ animationDelay: "0.3s" }}
                    >
                      <Label htmlFor="phone">
                        Phone Number <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        className="border-2 border-gray-300 focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-[var(--aa-navy)] transition-all"
                        id="phone"
                        name="phone"
                        type="tel"
                        value={form.phone}
                        onChange={handleChange}
                        placeholder="070xxxxxxxx"
                        required
                      />
                    </div>
                    <div
                      className="space-y-2 animate-fade-in"
                      style={{ animationDelay: "0.4s" }}
                    >
                      <Label htmlFor="email">
                        Email <span className="text-red-500">*</span>
                      </Label>
                      <div className="relative">
                        <Input
                          className={`border-2 transition-all pr-10 ${
                            emailError
                              ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                              : "border-gray-300 focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-[var(--aa-navy)]"
                          }`}
                          id="email"
                          name="email"
                          type="email"
                          value={form.email}
                          onChange={handleChange}
                          placeholder="john@example.com"
                          required
                        />
                        {isCheckingEmail && (
                          <div className="absolute inset-y-0 right-0 px-3 flex items-center">
                            <Loader className="h-4 w-4 text-gray-400 animate-spin" />
                          </div>
                        )}
                      </div>
                      {emailError && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                          <span>⚠</span>
                          {emailError}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Business Details */}
              {currentStep === 2 && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">
                        Business Details
                      </h2>
                      <p className="text-sm text-gray-600">
                        Tell us about your business
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="busName">
                      Business Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      className="border-2 border-gray-300 focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-[var(--aa-navy)] transition-all"
                      id="busName"
                      name="busName"
                      placeholder="e.g., United Gases Limited"
                      value={form.busName}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">
                      Business Description{" "}
                      <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      className="border-2 border-gray-300 focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-[var(--aa-navy)] transition-all"
                      id="description"
                      name="description"
                      placeholder="e.g., Manufacturers of Industrial/Domestic Gases"
                      value={form.description}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="business_phone">
                        Business Phone <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        className="border-2 border-gray-300 focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-[var(--aa-navy)] transition-all"
                        id="business_phone"
                        name="business_phone"
                        type="tel"
                        value={form.business_phone}
                        onChange={handleChange}
                        placeholder="070xxxxxxxx"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="business_email">
                        Business Email <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        className="border-2 border-gray-300 focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-[var(--aa-navy)] transition-all"
                        id="business_email"
                        name="business_email"
                        type="email"
                        value={form.business_email}
                        onChange={handleChange}
                        placeholder="business@example.com"
                        required
                      />
                    </div>
                  </div>

                  {/* Business Reg. No, TIN, and Fax in one row */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="rc">
                        Business Reg. No <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        className="border-2 border-gray-300 focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-[var(--aa-navy)] transition-all"
                        id="rc"
                        name="rc"
                        type="text"
                        value={form.rc}
                        onChange={handleChange}
                        placeholder="RC123456"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tin">TIN</Label>
                      <Input
                        className="border-2 border-gray-300 focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-[var(--aa-navy)] transition-all"
                        id="tin"
                        name="tin"
                        type="text"
                        value={form.tin}
                        onChange={handleChange}
                        placeholder="Tax Identification Number"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="fax">Business Fax</Label>
                      <Input
                        className="border-2 border-gray-300 focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-[var(--aa-navy)] transition-all"
                        id="fax"
                        name="fax"
                        type="tel"
                        value={form.fax}
                        onChange={handleChange}
                        placeholder="+234-xxx-xxxx"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">
                      Business Address <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      className="border-2 border-gray-300 focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-[var(--aa-navy)] transition-all resize-none"
                      id="address"
                      name="address"
                      value={form.address}
                      onChange={handleChange}
                      rows={3}
                      placeholder="Enter your complete business address"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Step 3: Business Type(s) */}
              {currentStep === 3 && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">
                        Business Type(s)
                      </h2>
                      <p className="text-sm text-gray-600">
                        Select all that apply to your business
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="busType">
                      Business Type(s) <span className="text-red-500">*</span>
                      <span className="text-xs text-gray-500 ml-2 font-normal">
                        Select all that apply
                      </span>
                    </Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                      {busTypeOptions.map((option) => {
                        const isSelected = Array.isArray(form.busType)
                          ? form.busType.includes(option.value)
                          : form.busType === option.value;

                        return (
                          <label
                            key={option.value}
                            className={`flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all transform hover:scale-[1.02] ${
                              isSelected
                                ? "border-[var(--aa-navy)] bg-blue-50 shadow-md ring-2 ring-blue-200"
                                : "border-gray-200 hover:border-blue-300 bg-white"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) =>
                                handleBusinessTypeChange(
                                  option.value,
                                  e.target.checked
                                )
                              }
                              className="mt-1 w-5 h-5 text-[var(--aa-navy)] border-gray-300 rounded focus:ring-[var(--aa-accent)] focus:ring-2 cursor-pointer"
                            />
                            <div className="flex-1">
                              <div className="font-semibold text-gray-900">
                                {option.name}
                              </div>
                              <div className="text-xs text-gray-600 mt-1">
                                {option.description}
                              </div>
                            </div>
                            {isSelected && (
                              <div className="text-[var(--aa-navy)] animate-scale-in">
                                <CheckCircle2 className="w-5 h-5" />
                              </div>
                            )}
                          </label>
                        );
                      })}
                    </div>
                    {Array.isArray(form.busType) &&
                      form.busType.length === 0 && (
                        <p className="text-xs text-red-500 mt-1">
                          Please select at least one business type
                        </p>
                      )}
                  </div>
                </div>
              )}

              {/* Step 4: Set Password */}
              {currentStep === 4 && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                      <Lock className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">
                        Set your password
                      </h2>
                      <p className="text-sm text-gray-600">
                        Last step! Choose a strong password to secure your
                        account
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">
                      Password <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        className="border-2 border-gray-300 focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-[var(--aa-navy)] pr-10 transition-all"
                        id="password"
                        name="password"
                        value={form.password}
                        onChange={handleChange}
                        required
                        type={showPassword ? "text" : "password"}
                        placeholder="At least 6 characters"
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 px-3 flex items-center hover:bg-gray-50 rounded-r transition-colors"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5 text-gray-500" />
                        ) : (
                          <Eye className="h-5 w-5 text-gray-500" />
                        )}
                      </button>
                    </div>
                    {form.password && (
                      <div className="flex items-center gap-2 text-xs">
                        <div
                          className={`flex-1 h-1 rounded-full ${
                            form.password.length >= 6
                              ? "bg-green-500"
                              : "bg-gray-200"
                          }`}
                        />
                        <span
                          className={
                            form.password.length >= 6
                              ? "text-green-600"
                              : "text-gray-500"
                          }
                        >
                          {form.password.length >= 6
                            ? "✓ Strong"
                            : `${form.password.length}/6`}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">
                      Confirm Password <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        className={`border-2 pr-10 transition-all ${
                          form.confirmPassword && dSame
                            ? "border-green-500 focus:ring-green-500"
                            : form.confirmPassword && !dSame
                            ? "border-red-500 focus:ring-red-500"
                            : "border-gray-300 focus:ring-[var(--aa-accent)] focus:border-[var(--aa-navy)]"
                        }`}
                        id="confirmPassword"
                        name="confirmPassword"
                        value={form.confirmPassword}
                        onChange={handleChange}
                        required
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Re-enter your password"
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 px-3 flex items-center hover:bg-gray-50 rounded-r transition-colors"
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-5 w-5 text-gray-500" />
                        ) : (
                          <Eye className="h-5 w-5 text-gray-500" />
                        )}
                      </button>
                    </div>
                    {form.confirmPassword && (
                      <div className="flex items-center gap-2 text-xs">
                        {dSame ? (
                          <span className="text-green-600 flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" />
                            Passwords match!
                          </span>
                        ) : (
                          <span className="text-red-500">
                            Passwords don&apos;t match
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex items-center justify-between pt-6 border-t">
                <Button
                  type="button"
                  onClick={handlePrevious}
                  disabled={currentStep === 1}
                  variant="outline"
                  className="flex items-center gap-2 bg-white text-[var(--aa-navy)] border-2 border-[var(--aa-navy)] hover:bg-[var(--aa-navy)] hover:text-white font-semibold py-3 px-6 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Previous
                </Button>

                {currentStep < totalSteps ? (
                  <Button
                    type="button"
                    onClick={handleNext}
                    disabled={!validateStep(currentStep) || isCheckingEmail}
                    className="flex items-center gap-2 bg-gradient-to-r from-[var(--aa-navy)] to-blue-600 hover:from-[var(--aa-navy)]/90 hover:to-blue-600/90 text-white font-semibold py-3 px-8 rounded-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
                  >
                    Next Step
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={isLoading || !validateForm()}
                    className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold py-3 px-8 rounded-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
                  >
                    {isLoading ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin" />
                        Creating Account...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Complete Registration
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </form>

          <div
            className="mt-6 text-center text-sm animate-fade-in"
            style={{ animationDelay: "1.6s" }}
          >
            <span className="text-gray-600">Already have an account? </span>
            <Link
              to="/login"
              className="font-semibold text-[var(--aa-navy)] hover:text-blue-700 underline transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>

      <div
        className="lg:w-2/5 bg-cover bg-center hidden lg:block relative"
        style={{ backgroundImage: `url(${registerBg})` }}
        role="img"
        aria-label="Background image of a desk with a laptop and coffee"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--aa-navy)]/85 to-blue-600/85"></div>
        <div className="relative z-10 flex items-center justify-center h-full p-8">
          <div className="text-white space-y-6 max-w-md animate-fade-in">
            <h3 className="text-4xl font-bold animate-slide-right">
              Welcome to YAMMUSA GLOBAL FARMS & AGRO ALLIED SERVICES
            </h3>
            <p
              className="text-lg text-blue-100 leading-relaxed animate-slide-right"
              style={{ animationDelay: "0.2s" }}
            >
              Your complete business management solution. Streamline operations,
              track finances, and grow your business with confidence.
            </p>
            <ul className="space-y-3 text-blue-50">
              <li
                className="flex items-center gap-3 animate-slide-right"
                style={{ animationDelay: "0.4s" }}
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <span>Real-time inventory and financial tracking</span>
              </li>
              <li
                className="flex items-center gap-3 animate-slide-right"
                style={{ animationDelay: "0.6s" }}
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <span>Comprehensive reporting and analytics</span>
              </li>
              <li
                className="flex items-center gap-3 animate-slide-right"
                style={{ animationDelay: "0.8s" }}
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <span>Multi-business type support</span>
              </li>
              <li
                className="flex items-center gap-3 animate-slide-right"
                style={{ animationDelay: "1.0s" }}
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <span>Bank reconciliation</span>
              </li>
              <li
                className="flex items-center gap-3 animate-slide-right"
                style={{ animationDelay: "1.2s" }}
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <span>Payroll management</span>
              </li>
              <li
                className="flex items-center gap-3 animate-slide-right"
                style={{ animationDelay: "1.4s" }}
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <span>Asset management</span>
              </li>
              <li
                className="flex items-center gap-3 animate-slide-right"
                style={{ animationDelay: "1.6s" }}
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <span>User roles and access control</span>
              </li>
              <li
                className="flex items-center gap-3 animate-slide-right"
                style={{ animationDelay: "1.8s" }}
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <span>Attendance management</span>
              </li>
            </ul>
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
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
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

        .animate-slide-right {
          animation: slide-right 0.6s ease-out forwards;
          opacity: 0;
        }

        .animate-scale-in {
          animation: scale-in 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
