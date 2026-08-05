/* eslint-disable no-unused-vars */
import React, { useCallback, useEffect } from "react";
import {
  Navigate,
  useLocation,
  useNavigate,
  useRoutes,
} from "react-router-dom";
import PublicRoutes from "./PublicRoutes";
import AuthRoutes from "./AuthRoutes";
import ReactGA from "react-ga4";
import { initUser } from "@/redux/actions/auth";
import { useDispatch, useSelector } from "react-redux";
import { hasAccess } from "@/utilities";
import { accessData } from "./MainRoutes";
import Dashboard from "../pages/dashboard/Dashboard";
import { gotoApp } from "./routeHelper";
import Login from "../pages/auth/Login";
import Register from "../pages/auth/Register";
import NotFound from "@/common/NotFound";

const Router = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const authenticated = useSelector((state) => state.auth.authenticated);
  const access = useSelector((state) => state.auth.user?.accessTo || []);

  // Function to navigate the user based on access
  const navigateUser = useCallback(
    (access) => {
      if (!access?.length) return;
      if (access.includes("Dashboard")) {
        navigate("/app/dashboard");
      } else {
        gotoApp(access, navigate);
      }
    },
    [navigate]
  );

  useEffect(() => {
    if (authenticated && access.length) {
      navigateUser(access);
    } else if (!authenticated) {
      dispatch(initUser(navigate, () => navigate(location.pathname)));
    }
  }, [authenticated, access, navigate, dispatch, location]);

  // Initialize Google Analytics
  useEffect(() => {
    ReactGA.initialize("G-C9S1DWKHVN");
    ReactGA.send("pageview");
  }, []);

  // Function to recursively filter accessible routes
  const getAccessibleRoutes = (routes, user) => {
    return routes
      .filter((route) => hasAccess(user, [route.name])) // Check top-level route access based on 'name' (or any other field)
      .map((route) => ({
        ...route,
        children: route.children
          ? getAccessibleRoutes(route.children, user) // Recursively process child routes
          : undefined,
      }));
  };

  // Define the route configuration for `useRoutes`
  const routes = [
    {
      path: "/",
      element: <PublicRoutes />,
      children: [
        { path: "/", element: <Navigate to="/login" replace /> },
        { path: "/login", element: <Login /> },
        { path: "/signup", element: <Register /> },
      ],
    },
    {
      path: "/app",
      element: <AuthRoutes />,
      children: [
        { path: "dashboard", element: <Dashboard /> }, // Use relative path here
        ...getAccessibleRoutes(accessData, user).map((route) => ({
          path: route.path.replace("/app", ""), // Ensure relative path
          element: <Navigate to={route.path} />, // Dynamically render accessible route
          children: route.children?.map((child) => ({
            path: child.path.replace("/app", ""), // Convert child paths to relative
            element: <Navigate to={child.path} />,
          })),
        })),
        { path: "*", element: <NotFound /> },
      ],
    },
    { path: "*", element: <NotFound /> },
  ];

  // Use `useRoutes` for dynamic routing
  const element = useRoutes(routes);

  return element;
};

export default Router;
