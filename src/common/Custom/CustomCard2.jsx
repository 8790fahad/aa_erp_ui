import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ChevronLeft } from "lucide-react";
import React from "react";
import { useNavigate } from "react-router-dom";

export default function CustomCard(props) {
  const { header, footer, back, to, headerRight, className, children } = props;
  const navigate = useNavigate();
  return (
    <Card className={`w-full sm:mr-0 lg:mr-0 border-0 bg-white/95 backdrop-blur-sm ${className}`}>
      <CardHeader className="relative p-3 pb-6 pt-0 md:pt-8">
        {back && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(to ? to : -1)}
            className="absolute -left-1 md:left-6 top-2 md:top-2 h-8 w-8 p-0 hover:bg-slate-100 rounded-md border transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden md:visible">Go back</span>
          </Button>
        )}
        {header ? (
          <div className="text-center">
            <h1 className="text-2xl sm:text-3xl md:ml-0 font-bold text-slate-900 tracking-tight">
              {header}
            </h1>
            <div className="mt-2 h-1 w-50 bg-gradient-to-r from-[#4267B2] to-purple-300 rounded-full mx-auto"></div>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="px-2 sm:px-5 pb-8 overflow-x-auto">{children}</CardContent>
    </Card>
  );
}
