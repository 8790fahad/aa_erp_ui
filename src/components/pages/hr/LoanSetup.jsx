import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { _fetchApi, _postApi, _putApi } from "@/redux/actions/api";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Settings,
  Banknote,
  MoreVertical,
  Trash2,
  Edit,
  Eye,
  Filter,
  X,
  Info
} from "lucide-react";
import {
  formatNumberWithCommas,
  parseFormattedNumber
} from "@/utils/numberUtils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import TypeaheadCustom from "@/common/Custom/TypeaheadCustom";
import { Label } from "@/components/ui/label";
import { getAaBrandColors } from "@/lib/aaBrand";

const LoanSetup = () => {
  const { user, activeBusiness } = useSelector((state) => state.auth);
  const facilityId = activeBusiness?.id || user?.facilityId;
  const {
    primaryColor,
    secondaryColor,
    accentColor,
    headerGradient: brandHeaderGradient,
    brandButtonStyle: brandBtn,
    appColorStyle: brandAppStyle,
  } = getAaBrandColors();
  const headerGradient = brandHeaderGradient;
  const brandButtonStyle = brandBtn;

  const [setups, setSetups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editingSetupId, setEditingSetupId] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    amount: ""
  });

  useEffect(() => {
    if (facilityId) {
      fetchSetups();
      fetchAccounts();
    }
  }, [facilityId]);

  const fetchSetups = () => {
    setLoading(true);
    _fetchApi(
      `/api/hr/loan-setups?facilityId=${facilityId}`,
      (data) => {
        if (data.success) setSetups(data.data);
        setLoading(false);
      },
      (error) => {
        toast.error("Error fetching loan setups");
        setLoading(false);
      }
    );
  };

  const fetchAccounts = () => {
    _postApi(
      `/account/chart-of-account?query_type=select`,
      { facilityId },
      (data) => {
        if (data.success) setAccounts(data.results || []);
      },
      (error) => console.error("Error fetching accounts:", error)
    );
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveSetup = (e) => {
    e.preventDefault();
    if (!selectedAccount) return toast.error("Please select a receivable account");

    setSubmitting(true);
    const payload = {
      ...formData,
      amount: formData.amount ? parseFloat(formData.amount) : null,
      receivableHead: selectedAccount.head,
      facilityId,
      userId: user?.id
    };

    if (editMode) {
      _putApi(
        `/api/hr/loan-setups/${editingSetupId}`,
        payload,
        (data) => {
          if (data.success) {
            toast.success("Loan configuration updated");
            handleCloseForm();
            fetchSetups();
          } else {
            toast.error(data.message || "Error updating setup");
          }
          setSubmitting(false);
        },
        (error) => {
          toast.error("Error connecting to server");
          setSubmitting(false);
        }
      );
    } else {
      _postApi(
        "/api/hr/loan-setups",
        payload,
        (data) => {
          if (data.success) {
            toast.success("Loan configuration saved");
            handleCloseForm();
            fetchSetups();
          } else {
            toast.error(data.message || "Error saving setup");
          }
          setSubmitting(false);
        },
        (error) => {
          toast.error("Error connecting to server");
          setSubmitting(false);
        }
      );
    }
  };

  const handleEditSetup = (setup) => {
    setEditMode(true);
    setEditingSetupId(setup.id);
    setFormData({
      name: setup.name,
      description: setup.description || "",
      amount: setup.amount || ""
    });
    const acc = accounts.find(a => a.head === setup.receivableHead);
    setSelectedAccount(acc || { head: setup.receivableHead, description: "Unknown Account" });
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditMode(false);
    setEditingSetupId(null);
    setFormData({ name: "", description: "", amount: "" });
    setSelectedAccount(null);
  };

  const filteredSetups = setups.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50/50 pb-12">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header Section - Old Style */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Loan Configuration</h1>
            <p className="text-sm text-gray-500 mt-1">Define loan templates and accounting mappings</p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center -space-x-2 mr-4">
               <div className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-white text-xs font-bold z-10" style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }} title="Total Types">
                 {setups.length}
               </div>
            </div>
            <Button 
              onClick={() => {
                setEditMode(false);
                setShowForm(true);
              }}
              className="text-white shadow-sm transition-all hover:opacity-90"
              style={brandButtonStyle}
            >
              <Plus className="w-4 h-4 mr-2" />
              Define Loan Type
            </Button>
          </div>
        </div>

        {/* Filters and Search Bar - Old Style */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-col sm:flex-row gap-4 justify-between items-center relative z-20">
          <div className="relative w-full sm:max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all bg-gray-50 focus:bg-white"
              style={{ "--tw-ring-color": primaryColor }}
              placeholder="Search configurations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Table - Old Style */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden relative z-10">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100">
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Loan Name
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    GL Account
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Default Amount
                  </th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-12 text-center">
                      <div className="flex justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderBottomColor: primaryColor }}></div>
                      </div>
                    </td>
                  </tr>
                ) : filteredSetups.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-16 text-center text-gray-500">
                      <Settings className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                      <p className="text-lg font-medium text-gray-900">No loan types defined yet</p>
                      <Button onClick={() => setShowForm(true)} variant="outline" className="mt-4">
                        Add Loan Type
                      </Button>
                    </td>
                  </tr>
                ) : (
                  filteredSetups.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="p-2 bg-gray-100 rounded-lg text-gray-600 mr-3">
                            <Banknote size={18} />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-900">{item.name}</div>
                            <div className="text-xs text-gray-500">{item.description || 'No description'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold" style={{ color: primaryColor }}>{item.receivableHead}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {item.amount ? `₦${parseFloat(item.amount).toLocaleString()}` : "Not Set"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <div className="flex items-center justify-end gap-2">
                           <button 
                             onClick={() => handleEditSetup(item)}
                             className="p-2 text-gray-400 hover:opacity-80 transition-colors"
                             title="Edit"
                           >
                             <Edit size={18} />
                           </button>
                           <button className="p-2 text-gray-400 hover:text-red-600 transition-colors">
                             <Trash2 size={18} />
                           </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Form Modal - Simplified Style */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[200]">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col border border-gray-200 animate-in zoom-in-95 duration-200">
            <div className="p-6 text-white" style={{ background: headerGradient }}>
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold">{editMode ? "Edit Loan Type" : "Define Loan Type"}</h3>
                  <p className="text-white/80 text-xs mt-1 font-medium">
                    {editMode ? "Update loan template and GL mapping" : "Create loan template and GL mapping"}
                  </p>
                </div>
                <button onClick={handleCloseForm} className="p-1 hover:bg-white/20 rounded-full transition-all">
                   <X size={20} />
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveSetup} className="p-6 space-y-4">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-gray-700">Loan Product Name</Label>
                <input
                  type="text"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g. Staff Personal Loan"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2"
                  style={{ "--tw-ring-color": primaryColor }}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-gray-700">Receivable GL Account</Label>
                <TypeaheadCustom
                  options={accounts}
                  labelKey={(i) => `${i.head} - ${i.description}`}
                  onChange={(items) => setSelectedAccount(items[0] || null)}
                  placeholder="Select account..."
                  selected={selectedAccount ? [selectedAccount] : []}
                />
              </div>

              <div className="space-y-1">
                 <Label className="text-xs font-bold text-gray-700">Default Amount (Optional)</Label>
                  <input
                    type="text"
                    name="amount"
                    value={formatNumberWithCommas(formData.amount)}
                    onChange={(e) => {
                      const val = parseFormattedNumber(e.target.value);
                      setFormData(p => ({ ...p, amount: val }));
                    }}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2"
                    style={{ "--tw-ring-color": primaryColor }}
                  />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-gray-700">Description</Label>
                <textarea
                  name="description"
                  rows={2}
                  value={formData.description}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 resize-none"
                  style={{ "--tw-ring-color": primaryColor }}
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 mt-2">
                <Button type="button" variant="outline" onClick={handleCloseForm} className="rounded-xl font-bold">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl font-bold px-6 text-white hover:opacity-90"
                  style={brandButtonStyle}
                >
                  {submitting ? "Saving..." : (editMode ? "Update Configuration" : "Save Configuration")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoanSetup;
