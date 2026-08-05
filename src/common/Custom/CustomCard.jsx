/* eslint-disable no-unused-vars */
/* eslint-disable react/prop-types */
import React from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { useSelector } from "react-redux";
import BackButton from "../BackButton";
import { useNavigate } from "react-router-dom";

function CustomCard(props) {
  const { header, footer, back, headerRight, className, children } = props;
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const navigate = useNavigate();

  return (
    <Card
      className={`border-2 ${className}`}
      style={{
        borderWidth: 2,
        borderColor: activeBusiness?.primary_color,
        borderStyle: "solid",
        boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
        borderRadius: "8px",
        minHeight: "83vh",
      }}
    >
      {header && (
        <CardHeader
          // className={`flex items-center flex-row ${
          //   back ? "justify-between" : "justify-center"
          // }`}
          className="flex items-center flex-row w-full"
          style={{
            borderBottom: `1px solid ${activeBusiness?.primary_color}`,
            backgroundColor: activeBusiness?.primary_color,
            color: activeBusiness.secondary_color,
            padding: "0.5rem 1rem",
            borderTopLeftRadius: "5px",
            borderTopRightRadius: "5px",
            fontSize: "1.2rem",
            fontWeight: "bold",
            fontFamily: "Arial, sans-serif",
          }}
        >
          <div className="w-50">
            {back && <BackButton className={"ms-3"} navigate={navigate} />}
          </div>
          <div style={{marginLeft: -80}}>
            <h4 className="text-lg font-semibold">{header}</h4>
          </div>
          {headerRight && <div>{headerRight}</div>}
        </CardHeader>
      )}
      <CardContent className="p-3">{children}</CardContent>
      {footer && (
        <CardFooter
          className="p-4"
          style={{
            backgroundColor: activeBusiness.primary_color,
            color: activeBusiness.secondary_color,
          }}
        >
          {footer}
        </CardFooter>
      )}
    </Card>
  );
}

export default CustomCard;
