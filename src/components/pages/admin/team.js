<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingTeam ? "Edit Team" : "Create New Team"}
                </h2>
                <button
                  onClick={handleCancel}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-2">
                    Team Leader
                  </h3>
                  <div className="flex items-center gap-3 p-3 rounded-lg">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                      <SearchUserInput
                        onChange={(selectedUserArray) => {
                          const selectedUser = selectedUserArray[0];
                          if (!selectedUser) return;
                          setFormData((prev) => ({
                            ...prev,
                            firstname: selectedUser.firstname,
                            lastname: selectedUser.lastname,
                            user_id: selectedUser.id,
                          }));
                          handleUserChange(selectedUser);
                        }}
                        disabled={false}
                        size="sm"
                      />

                      <input
                        type="text"
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-100"
                        value="Team Leader"
                        readOnly
                      />

                      <select
                        className="px-3 py-2 bg-transparent border border-gray-300 rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-transparent text-sm"
                        value={formData.status}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            status: e.target.value,
                          }))
                        }
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      Team Members ({formData.members.length})
                    </h3>
                    <button
                      type="button"
                      onClick={addMember}
                      className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                    >
                      <UserPlus className="h-4 w-4" />
                      Add Member
                    </button>
                  </div>

                  {formData.members.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No team members added yet. Click "Add Member" to start
                      building your team.
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {formData.members.map((member, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                            <SearchUserInput
                              onChange={(selectedUserArray) => {
                                const selectedUser = selectedUserArray[0];
                                if (!selectedUser) return;
                                updateMember(
                                  index,
                                  "firstname",
                                  selectedUser.firstname
                                );
                                updateMember(
                                  index,
                                  "lastname",
                                  selectedUser.lastname
                                );
                                updateMember(index, "user_id", selectedUser.id);
                              }}
                              disabled={false}
                              size="sm"
                            />
                            <select
                              className="px-3 py-2 bg-transparent border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                              value={member.team_position || "Member"}
                              onChange={(e) =>
                                updateMember(
                                  index,
                                  "team_position",
                                  e.target.value
                                )
                              }
                            >
                              <option value="member">Member</option>
                              <option value="leader">Team leader</option>
                            </select>
                            <select
                              className="px-3 py-2 bg-transparent border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                              value={member.status || "active"}
                              onChange={(e) =>
                                updateMember(index, "status", e.target.value)
                              }
                            >
                              <option value="active">Active</option>
                              <option value="inactive">Inactive</option>
                            </select>
                          </div>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => promoteToLeader(index)}
                              className="p-2 text-yellow-600 hover:text-yellow-800 hover:bg-yellow-50 rounded-lg transition-colors"
                              title="Promote to Team Leader"
                            >
                              <Crown className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeMember(index)}
                              className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                              title="Remove member"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer Buttons */}
                <div className="flex gap-3 pt-4">
                  <CustomButton
                    type="button"
                    onClick={handleSubmit}
                    disabled={loading2}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading2 ? (
                      <Loader className="animate-spin w-4 h-4 mx-auto" />
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