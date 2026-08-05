/* eslint-disable react/prop-types */
import { initUser } from "@/redux/actions/auth";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";

export default function AuthWrapper(props) {
  const authenticated = useSelector((state) => state.auth.authenticated);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!authenticated) {
      dispatch(initUser(navigate, (f) => f, location));
    }
  }, [authenticated, dispatch, location, navigate]);
  return (
<>
{props.children}
</>
  );
}
