import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Users,
  X,
  Eye,
  Loader,
  UserPlus,
  Power,
  PowerOff,
  MoreVerticalIcon,
  Crown,
} from "lucide-react";
import CustomTable1 from "@/common/Custom/CustomTable1";
import CustomButton from "@/common/Custom/CustomButton";
import { _fetchApi, _postApi, _deleteApi } from "@/redux/actions/api";
import { Alert } from "reactstrap";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const TeamTable = ({ embedded = false }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [loading2, setLoading2] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teams, setTeams] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);
  const [formData, setFormData] = useState({
    teamName: "",
    team_id: "",
    description: "",
    status: "active",
    headOfTeam: "",
  });
  const [memberFormData, setMemberFormData] = useState({
    userId: "",
  });

  const activeBusiness = useSelector((state) => state.auth.activeBusiness);

  const handleEdit = (team) => {
    setEditingTeam(team);
    setFormData({
      teamName: team.teamName,
      team_id: team.team_id,
      description: team.description,
      status: team.status || "active",
      headOfTeam: team.headOfTeam,
      id: team.id,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.teamName.trim()) {
      toast.error("Please enter team name");
      return;
    }

    setLoading2(true);
    const endpoint = editingTeam
      ? "/api/update/team/by-id"
      : "/api/add/team";

    _postApi(
      endpoint,
      {
        ...formData,
        facilityId: activeBusiness.id,
      },
      (res) => {
        if (res.success) {
          toast.success(
            res.message ||
              `Team ${editingTeam ? "updated" : "created"} successfully`
          );
          handleCancel();
          getTeams();
        } else {
          toast.error(res.message || "Failed to submit");
          setLoading2(false);
        }
      },
      (err) => {
        toast.error("An error occurred while submitting");
        console.error(err);
        setLoading2(false);
      }
    );
  };

  const handleDelete = (team) => {
    setLoading2(true);
    _deleteApi(
      "/api/team/" + team.id,
      { facilityId: activeBusiness.id },
      (res) => {
        if (res.success) {
          toast.success(res.message || "Team deleted successfully");
          setShowDeleteModal(false)
          getTeams();
        } else {
          toast.error(res.message || "Failed to delete");
          setLoading2(false);
        }
      },
      (err) => {
        toast.error("An error occurred while deleting");
        console.error(err);
        setLoading2(false);
      }
    );
  };

  const handleStatusUpdate = (status) => {
    setLoading2(true);
    _postApi(
      "/api/update/team/status",
      {
        teamId: selectedTeam.id,
        status,
        facilityId: activeBusiness.id,
      },
      (res) => {
        if (res.success) {
          toast.success(res.message || "Status updated successfully");
          setShowStatusModal(false);
          getTeams();
        } else {
          toast.error(res.message || "Failed to update status");
        }
        setLoading2(false);
      },
      (err) => {
        console.error(err);
        setLoading2(false);
        toast.error("Server error occurred.");
      }
    );
  };

  const handleCancel = () => {
    setIsModalOpen(false);
    setShowDeleteModal(false);
    setShowMembersModal(false);
    setEditingTeam(null);
    setSelectedTeam(null);
    setLoading2(false);
    setFormData({
      name: "",
      description: "",
      status: "active",
      leader: "",
    });
    setMemberFormData({
      userId: "",
    });
  };

  const handleView = (team) => {
    setSelectedTeam(team);
    setShowTeamModal(true);
  };

  const handleViewMembers = (team) => {
    setSelectedTeam(team);
    getTeamMembers(team.id);
    setShowMembersModal(true);
  };

  const handleShowDelete = (team) => {
    setSelectedTeam(team);
    setShowDeleteModal(true);
  };

  const handleShowStatus = (team) => {
    setSelectedTeam(team);
    setShowStatusModal(true);
  };

  const addMember = () => {
    if (!memberFormData.userId) {
      toast.error("Please select a staff member");
      return;
    }

    setLoading2(true);
    _postApi(
      "/api/add/team/member",
      {
        userId: memberFormData.userId,
        teamId: selectedTeam.id,
        facilityId: activeBusiness.id,
      },
      (res) => {
        if (res.success) {
          toast.success(res.message || "Member added successfully");
          setMemberFormData({ userId: "" });
          getTeamMembers(selectedTeam.id);
          getUsers();
        } else {
          toast.error(res.message || "Failed to add member");
        }
        setLoading2(false);
      },
      (err) => {
        console.error(err);
        setLoading2(false);
        toast.error("Server error occurred.");
      }
    );
  };

  const getTeams = useCallback(() => {
    setLoading(true);
    _fetchApi(
      `/api/get/team?facilityId=${activeBusiness.id}`,
      (data) => {
        if (data.success) {
          setTeams(data.results);
        }
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setLoading(false);
      }
    );
  }, [activeBusiness.id]);

  const getTeamMembers = (teamId) => {
    _fetchApi(
      `/api/get/team/members/${activeBusiness.id}/${teamId}`,
      (data) => {
        if (data.success) {
          setTeamMembers(data.results);
        }
      },
      (err) => {
        console.error(err);
      }
    );
  };

  const getUsers = useCallback(() => {
    _fetchApi(
      `/api/v1/get-users-by-facility/${activeBusiness.id}`,
      (data) => {
        if (data.success) {
          setStaffMembers(data.results);
        }
      },
      (err) => {
        console.error(err);
      }
    );
  }, [activeBusiness.id]);

  useEffect(() => {
    getTeams();
    getUsers();
  }, [getTeams, getUsers]);

  const getStatusBadge = (status) => {
    const colors = {
      active: "bg-green-100 text-green-800",
      inactive: "bg-red-100 text-red-800",
    };
    return `px-3 py-1 rounded-full text-xs font-medium ${
      colors[status] || "bg-gray-100 text-gray-800"
    }`;
  };

  const fields = [
    {
      title: "Team",
      custom: true,
      component: (item) => (
        <div className="">
          <div className="font-medium text-gray-900">{item.teamName}</div>
          {item.leaderName && (
            <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
              <Crown className="h-3 w-3 text-yellow-500" />
              <span>{item.leaderName}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Description",
      custom: true,
      component: (item) => (
        <div className="text-gray-600">
          {item.description || "No description"}
        </div>
      ),
    },
    {
      title: "Team Leader",
      custom: true,
      component: (item) => (
        <div className="text-gray-900">
          {item.headFirstname && item.headLastname
            ? `${item.headFirstname} ${item.headLastname}`
            : "Not assigned"}
        </div>
      ),
    },
    {
      title: "Member Count",
      custom: true,
      component: (item) => (
        <div className="flex items-center space-x-2 justify-center">
          <Users className="h-4 w-4 text-gray-400" />
          <span className="text-gray-900">{item.memberCount || 0}</span>
        </div>
      ),
    },
    {
      title: "Status",
      custom: true,
      component: (item) => (
        <div className="text-center">
          <span className={`${getStatusBadge(item.status)}`}>
            {item.status || "active"}
          </span>
        </div>
      ),
    },
    {
      title: "Action",
      custom: true,
      component: (item) => (
        <div className="text-center flex gap-1 justify-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex size-8 text-slate-500 data-[state=open]:bg-slate-100 dark:text-slate-400 dark:data-[state=open]:bg-slate-800"
                size="icon"
              >
                <MoreVerticalIcon />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-32">
              <DropdownMenuItem onClick={() => handleEdit(item)}>
                Edit Team
              </DropdownMenuItem>
              {/* <DropdownMenuItem onClick={() => handleView(item)}>
                View Team
              </DropdownMenuItem> */}
              <DropdownMenuItem onClick={() => handleViewMembers(item)}>
                Manage Team
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleShowStatus(item)}>
                {item.status === "active" ? "Deactivate" : "Activate"}
              </DropdownMenuItem>
              {/* <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleShowDelete(item)}>
                Delete Team
              </DropdownMenuItem> */}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  const filteredTeams = teams.filter(
    (team) =>
      team.teamName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      team.leaderName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <div className={embedded ? "pb-2" : "min-h-screen"}>
        <div className="max-w-7xl mx-auto">
          <div className="">
            <div className="p-">
              <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900">
                  Manage Teams
                </h1>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600">
                    Total:{" "}
                    <span className="font-semibold text-gray-900">
                      {teams.length}
                    </span>
                  </span>
                  <span className="text-sm text-gray-600">
                    Active:{" "}
                    <span className="font-semibold text-green-600">
                      {teams.filter((t) => t.status === "active").length}
                    </span>
                  </span>
                  <span className="text-sm text-gray-600">
                    Inactive:{" "}
                    <span className="font-semibold text-red-600">
                      {teams.filter((t) => t.status === "inactive").length}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search teams by name or leader..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-transparent"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <CustomButton onClick={() => setIsModalOpen(true)}>
                <Plus className="w-5 h-5" />
                Add Team
              </CustomButton>
            </div>

            <div className="overflow-x-auto">
              {loading && <div className="flex mx-auto"><Loader className="animate-spin w-7 h-7 mx-auto" /></div>}
              {!loading ? (
                <CustomTable1 data={filteredTeams} fields={fields} message="No data to view" />
              ) : (
                <Alert className="mt-3 text-center" color="info">
                  Loading
                </Alert>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create/Edit Team Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingTeam ? "Edit Team" : "Add New Team"}
                </h2>
                <button
                  onClick={handleCancel}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Team Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-transparent"
                    value={formData.teamName}
                    onChange={(e) =>
                      setFormData({ ...formData, teamName: e.target.value })
                    }
                    placeholder="Enter team name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Team ID
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-transparent"
                    value={formData.team_id}
                    onChange={(e) =>
                      setFormData({ ...formData, team_id: e.target.value })
                    }
                    placeholder="e.g., TEM-001"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-transparent resize-none"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Brief description of the team's purpose"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Team Leader <span className="text-red-500">*</span>
                    </label>
                    <select
                      className="w-full px-3 py-2 bg-transparent border border-gray-300 rounded-md focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-transparent"
                      value={formData.headOfTeam}
                      onChange={(e) =>
                        setFormData({ ...formData, headOfTeam: e.target.value })
                      }
                    >
                      <option value="">Select team leader</option>
                      {staffMembers.map((staff) => (
                        <option key={staff.id} value={staff.id}>
                          {staff.firstname} {staff.lastname} ({staff.email})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status <span className="text-red-500">*</span>
                    </label>
                    <select
                      className="w-full px-3 py-2 bg-transparent border border-gray-300 rounded-md focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-transparent"
                      value={formData.status}
                      onChange={(e) =>
                        setFormData({ ...formData, status: e.target.value })
                      }
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <CustomButton
                    type="button"
                    onClick={handleSubmit}
                    disabled={loading2}
                    className="flex-1 bg-[var(--aa-accent)] hover:bg-[var(--aa-accent-hover)] text-white py-2 px-4 rounded-md transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading2 ? (
                      <>
                        <Loader className="animate-spin w-4 h-4 mx-auto" />
                      </>
                    ) : editingTeam ? (
                      "Update Team"
                    ) : (
                      "Create Team"
                    )}
                  </CustomButton>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded-md transition-colors font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Team Modal */}
      {/* {showTeamModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  Team Details
                </h2>
                <button
                  onClick={() => setShowTeamModal(false)}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-medium">
                      {selectedTeam?.teamName?.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">
                      {selectedTeam?.teamName}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {selectedTeam?.headFirstname && selectedTeam?.headLastname ? `${selectedTeam?.headFirstname} ${selectedTeam?.headLastname}` : "Not assigned"}
                    </p>
                    <p className="text-xs text-gray-500">
                      Status:{" "}
                      <span
                        className={`font-medium ${
                          selectedTeam?.status === "active"
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {selectedTeam?.status || "active"}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700 mb-3">
                    Description:{" "}
                    <span className="font-normal">
                      {selectedTeam?.description ||
                        "No description available"}
                    </span>
                  </p>
                  <p className="text-sm font-medium text-gray-700 mb-3">
                    Leader:{" "}
                    <span className="font-normal">
                      {selectedTeam?.headFirstname && selectedTeam?.headLastname ? `${selectedTeam?.headFirstname} ${selectedTeam?.headLastname}` : "Not assigned"}
                    </span>
                  </p>
                  <p className="text-sm font-medium text-gray-700 mb-3">
                    Member Count:{" "}
                    <span className="font-normal">
                      {selectedTeam?.memberCount || 0}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowTeamModal(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded-md transition-colors font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )} */}

      {/* Members Management Modal */}
      {showMembersModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  Manage Team Members
                </h2>
                <button
                  onClick={handleCancel}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Team Info */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">
                      Team
                    </h3>
                    <p className="mt-1 text-lg font-semibold text-gray-900">
                      {selectedTeam?.teamName}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Leader</h3>
                    <p className="mt-1 text-lg font-semibold text-gray-900">
                      {selectedTeam?.headFirstname && selectedTeam?.headLastname ? `${selectedTeam?.headFirstname} ${selectedTeam?.headLastname}` : "Not assigned"}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">
                      Total Members
                    </h3>
                    <p className="mt-1 text-lg font-semibold text-gray-900">
                      {teamMembers.length}
                    </p>
                  </div>
                </div>
              </div>

              {/* Add Member Section */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="flex items-end gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Add Team Member
                    </label>
                    <select
                      value={memberFormData.userId}
                      onChange={(e) =>
                        setMemberFormData({ userId: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-[var(--aa-accent)] outline-none"
                    >
                      <option value="">Select staff member</option>
                      {staffMembers
                        .filter(
                          (staff) =>
                            !teamMembers.some(
                              (teamMember) => teamMember.id === staff.id
                            )
                        )
                        .map((staff) => (
                          <option key={staff.id} value={staff.id}>
                            {staff.firstname} {staff.lastname} ({staff.email})
                          </option>
                        ))}
                    </select>
                  </div>
                  <CustomButton
                    loading={loading2}
                    onClick={addMember}
                    disabled={!memberFormData.userId}
                  >
                    <UserPlus className="h-4 w-4" />
                    Add Member
                  </CustomButton>
                </div>
              </div>

              {/* Members List */}
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">
                          Name
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">
                          Email
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">
                          Status
                        </th>
                        <th className="text-center py-3 px-4 font-medium text-gray-600">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {teamMembers.map((member) => (
                        <tr
                          key={member.id}
                          className="hover:bg-gray-50 transition-colors duration-150"
                        >
                          <td className="py-3 px-4">
                            <div className="font-medium text-gray-900">
                              {member.firstname} {member.lastname}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-gray-600">{member.email}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`${getStatusBadge(member.status)}`}>
                              {member.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                              title="Remove from team"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {teamMembers.length === 0 && (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No team members found</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Add your first team member to get started
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Update Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  Update Team Status
                </h2>
                <button
                  onClick={() => setShowStatusModal(false)}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-medium">
                      {selectedTeam?.teamName?.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">
                      {selectedTeam?.teamName}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {selectedTeam?.headFirstname && selectedTeam?.headLastname ? `${selectedTeam?.headFirstname} ${selectedTeam?.headLastname}` : "Not assigned"}
                    </p>
                    <p className="text-xs text-gray-500">
                      Current Status:{" "}
                      <span
                        className={`font-medium ${
                          selectedTeam?.status === "active"
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {selectedTeam?.status || "active"}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700 mb-3">
                    Select new status for this team:
                  </p>

                  <button
                    onClick={() => handleStatusUpdate("active")}
                    className={`w-full p-3 rounded-lg border-2 transition-colors text-left ${
                      selectedTeam?.status === "active"
                        ? "border-gray-300 bg-gray-50 cursor-not-allowed opacity-50"
                        : "border-green-200 bg-green-50 hover:bg-green-100 hover:border-green-300 cursor-pointer"
                    }`}
                    disabled={
                      selectedTeam?.status === "active" || loading2
                    }
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                        <Power className="w-4 h-4 text-green-600" />
                      </div>
                      <div>
                        <div className="font-medium text-green-700">
                          Activate Team
                        </div>
                        <div className="text-sm text-green-600">
                          The team will be active in the system.
                        </div>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleStatusUpdate("inactive")}
                    className={`w-full p-3 rounded-lg border-2 transition-colors text-left ${
                      selectedTeam?.status === "inactive"
                        ? "border-gray-300 bg-gray-50 cursor-not-allowed opacity-50"
                        : "border-red-200 bg-red-50 hover:bg-red-100 hover:border-red-300 cursor-pointer"
                    }`}
                    disabled={
                      selectedTeam?.status === "inactive" || loading2
                    }
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                        <PowerOff className="w-4 h-4 text-red-600" />
                      </div>
                      <div>
                        <div className="font-medium text-red-700">
                          Deactivate Team
                        </div>
                        <div className="text-sm text-red-600">
                          The team will be inactive in the system.
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowStatusModal(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded-md transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {/* {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  Confirm Delete
                </h2>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-6">
                <p className="text-gray-700 mb-3">
                  Are you sure you want to delete the following team?
                </p>
                <div className="p-3 bg-gray-100 rounded-lg">
                  <p>
                    <strong>Team:</strong> {selectedTeam?.teamName}
                  </p>
                  <p>
                    <strong>Leader:</strong>{" "}
                      {selectedTeam?.headFirstname && selectedTeam?.headLastname ? `${selectedTeam?.headFirstname} ${selectedTeam?.headLastname}` : "Not assigned"}
                  </p>
                  <p>
                    <strong>Member Count:</strong>{" "}
                    {selectedTeam?.memberCount || 0}
                  </p>
                </div>
                <p className="text-red-600 text-sm mt-3">
                  <strong>Warning:</strong> This action cannot be undone. All
                  team data and associations will be permanently deleted.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    handleDelete(selectedTeam);
                    setShowDeleteModal(false);
                  }}
                  disabled={loading2}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-md transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading2 ? (
                    <>
                      <Loader className="animate-spin w-4 h-4 mx-auto" />
                    </>
                  ) : (
                    "Delete Team"
                  )}
                </button>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded-md transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )} */}
    </>
  );
};

export default TeamTable;