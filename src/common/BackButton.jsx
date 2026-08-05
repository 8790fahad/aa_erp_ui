/* eslint-disable no-unused-vars */
/* eslint-disable react/prop-types */
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import React from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

function BackButton({ className }) {
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const navigate = useNavigate()

  return (
    <Button
      className={`${className} px-3 py-0 border-0 shadow-none`}
      style={{
        borderBottom: `1px solid ${activeBusiness?.primary_color}`,
        backgroundColor: activeBusiness?.primary_color,
      }}
      onClick={() => navigate(-1)}
    >
      <ChevronLeft className="h-4 w-4" />
      Back
    </Button>
  );
}

export default BackButton;
