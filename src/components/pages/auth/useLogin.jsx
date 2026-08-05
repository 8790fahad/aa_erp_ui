import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { login } from "@/redux/actions/auth";
import validate from "./LinkValidator";
import { _fetchApi } from "@/redux/actions/api";
import { toast } from "sonner";

const useLogin = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loggingIn } = useSelector((state) => state.auth);

  const [values, setValues] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState({});
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);
  const [pendingFacilityId, setPendingFacilityId] = useState(null);

  const handleChange = ({ target }) => {
    const { name, value } = target;
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const resendMail = () => {
    if (resendCooldown > 0 || resendLoading) return;

    setResendLoading(true);
    const facilityQuery = pendingFacilityId
      ? `&facilityId=${encodeURIComponent(pendingFacilityId)}`
      : "";
    _fetchApi(
      `/api/auth/verify-user?email=${encodeURIComponent(values.email)}${facilityQuery}`,
      (resp) => {
        setResendLoading(false);
        if (resp.success) {
          toast.success("A new verification link has been sent to your email.");
          setResendCooldown(120);
        } else {
          toast.error(resp.message || "Failed to resend verification link.");
        }
      },
      (err) => {
        setResendLoading(false);
        console.error("API Error:", err);
        toast.error("Failed to resend verification link. Please try again.");
      },
    );
  };

  // Function to determine redirect route based on user access and functionalities
  // Previously: getRedirectRoute computed a dynamic route based on modules.
  // Login now always redirects to the unified Home page (or account-switch when multiple businesses).

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    try {
      await dispatch(
        login(
          values,
          (data) => {
            if (data && data.business && data.business.length > 1) {
              navigate("/account-switch");
              return;
            }

            navigate("/app/home");
          },
          (err, data) => {
            setError({ message: err });
            if (data?.facilityId) {
              setPendingFacilityId(data.facilityId);
            }
          },
        ),
      );
    } catch (error) {
      console.error(error);
    }
  };

  return {
    errors,
    values,
    handleChange,
    handleSubmit,
    resendMail,
    loading: loggingIn,
    error,
    resendCooldown,
    resendLoading,
  };
};

export default useLogin;
