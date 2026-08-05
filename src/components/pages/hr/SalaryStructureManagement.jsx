import React, { useState } from "react";
import SalaryStructureList from "./SalaryStructureList";
import SalaryStructureForm from "./SalaryStructureForm";
import SalaryStructureView from "./SalaryStructureView";
import { _postApi, _putApi } from "@/redux/actions/api";
import { toast } from "sonner";

const SalaryStructureManagement = () => {
  const [currentView, setCurrentView] = useState("list"); // "list", "form", "view"
  const [selectedStructure, setSelectedStructure] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  const handleAddNew = () => {
    setSelectedStructure(null);
    setIsEditing(false);
    setCurrentView("form");
  };

  const handleEdit = (structure) => {
    setSelectedStructure(structure);
    setIsEditing(true);
    setCurrentView("form");
  };

  const handleView = (structure) => {
    setSelectedStructure(structure);
    setCurrentView("view");
  };

  const handleDelete = async (structure) => {
    if (
      window.confirm(
        `Are you sure you want to deactivate "${structure.structureName}"? This action cannot be undone.`
      )
    ) {
      try {
        const response = await fetch(`/api/hr/salary-structures/${structure.id}`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            facilityId: structure.facilityId,
            updatedBy: structure.updatedBy,
          }),
        });

        const data = await response.json();

        if (data.success) {
          setCurrentView("list");
          toast.success("Salary structure deactivated successfully");
        } else {
          toast.error(data.message || "Error deactivating salary structure");
        }
      } catch (error) {
        console.error("Error deactivating salary structure:", error);
        toast.error("Error deactivating salary structure");
      }
    }
  };

  const handleSave = async (formData) => {
    try {
      const url = isEditing
        ? `/api/hr/salary-structures/${selectedStructure.id}`
        : "/api/hr/salary-structures";

      const apiFunction = isEditing ? _putApi : _postApi;

      apiFunction(
        url,
        formData,
        (data) => {
          if (data.success) {
            setCurrentView("list");
            setSelectedStructure(null);
            setIsEditing(false);
            toast.success(
              isEditing
                ? "Salary structure updated successfully"
                : "Salary structure created successfully"
            );
          } else {
            toast.error(data.message || "Error saving salary structure");
          }
        },
        (error) => {
          console.error("Error saving salary structure:", error);
          toast.error("Error saving salary structure");
        }
      );
    } catch (error) {
      console.error("Error saving salary structure:", error);
      toast.error("Error saving salary structure");
    }
  };

  const handleCancel = () => {
    setCurrentView("list");
    setSelectedStructure(null);
    setIsEditing(false);
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case "form":
        return (
          <SalaryStructureForm
            salaryStructure={selectedStructure}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        );
      case "view":
        return (
          <SalaryStructureView
            salaryStructure={selectedStructure}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onClose={handleCancel}
          />
        );
      default:
        return (
          <SalaryStructureList
            onAddNew={handleAddNew}
            onEdit={handleEdit}
            onView={handleView}
            onDelete={handleDelete}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderCurrentView()}
      </div>
    </div>
  );
};

export default SalaryStructureManagement;