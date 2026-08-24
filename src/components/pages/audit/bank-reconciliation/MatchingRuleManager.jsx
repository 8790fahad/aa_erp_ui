import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
// import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Download, Upload, X } from 'lucide-react';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import { _fetchApi, _postApi } from '@/redux/actions/api';
// import { MatchingRule } from '@/utils/matchingRulesEngine';



const MatchingRulesManager = ({ rules, onRulesChange, onRuleSelected, selectedRule = null }) => {
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const [isAddingRule, setIsAddingRule] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [newRule, setNewRule] = useState({
    name: '',
    priority: 1,
    threshold: 0.7,
    autoApprove: false,
    conditions: []
  });

  // Fetch rules from backend on mount
  useEffect(() => {
    if (activeBusiness?.id) {
      fetchRules();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBusiness?.id]);

  const fetchRules = () => {
    if (!activeBusiness?.id) {
      return;
    }

    setIsLoading(true);
    _fetchApi(
      `/api/get/matching-rules?facilityId=${activeBusiness.id}`,
      (data) => {
        if (data.success && data.results) {
          // Ensure conditions is always an array
          const normalizedRules = data.results.map(rule => {
            let conditions = rule.conditions || [];
            
            // If conditions is a string (JSON), parse it
            if (typeof conditions === 'string') {
              try {
                conditions = JSON.parse(conditions);
              } catch (e) {
                console.error('Error parsing conditions:', e);
                conditions = [];
              }
            }
            
            // Ensure conditions is an array
            if (!Array.isArray(conditions)) {
              conditions = [];
            }
            
            return {
              ...rule,
              conditions: conditions
            };
          });
          
          onRulesChange(normalizedRules);
        } else {
          console.error("Failed to fetch rules:", data.message);
          // If no rules found, initialize with empty array
          if (data.success && (!data.results || data.results.length === 0)) {
            onRulesChange([]);
          }
        }
        setIsLoading(false);
      },
      (err) => {
        console.error("Error fetching rules:", err);
        setIsLoading(false);
      }
    );
  };

  const addCondition = () => {
    setNewRule(prev => ({
      ...prev,
      conditions: [
        ...(prev.conditions || []),
        {
          field: 'amount',
          operator: 'equals',
          value: '',
          weight: 1
        }
      ]
    }));
  };

  const updateCondition = (index, updates) => {
    setNewRule(prev => ({
      ...prev,
      conditions: prev.conditions?.map((condition, i) => 
        i === index ? { ...condition, ...updates } : condition
      ) || []
    }));
  };

  const removeCondition = (index) => {
    setNewRule(prev => ({
      ...prev,
      conditions: prev.conditions?.filter((_, i) => i !== index) || []
    }));
  };

  const applyTemplate = (type) => {
    let template = {
      name: '',
      priority: 1,
      threshold: 0.8,
      autoApprove: false,
      conditions: []
    };

    if (type === 'exact') {
      template.name = 'Exact Amount & Reference Match';
      template.conditions = [
        { field: 'amount', operator: 'equals', value: '', weight: 0.6 },
        { field: 'reference', operator: 'equals', value: '', weight: 0.4 }
      ];
    } else if (type === 'partial') {
      template.name = 'Partial Description Match';
      template.threshold = 0.6;
      template.conditions = [
        { field: 'amount', operator: 'equals', value: '', weight: 0.7 },
        { field: 'description', operator: 'contains', value: '', weight: 0.3 }
      ];
    }

    setNewRule(template);
    setIsAddingRule(true);
  };

  const handleCancel = () => {
    setIsAddingRule(false);
    setNewRule({
      name: '',
      priority: 1,
      threshold: 0.7,
      autoApprove: false,
      conditions: []
    });
  };

  const saveRule = async () => {
    if (!newRule.name || !newRule.conditions || newRule.conditions.length === 0) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!activeBusiness?.id) {
      toast.error("Active business not found");
      return;
    }

    setIsLoading(true);
    
    // Validate conditions
    const validConditions = newRule.conditions.every(cond => 
      cond.field && cond.operator && cond.hasOwnProperty('value') && cond.weight
    );

    if (!validConditions) {
      toast.error("Please fill in all condition fields");
      setIsLoading(false);
      return;
    }

    const ruleData = {
      name: newRule.name,
      priority: newRule.priority || 1,
      threshold: newRule.threshold || 0.7,
      autoApprove: newRule.autoApprove || false,
      conditions: newRule.conditions,
      facilityId: activeBusiness.id
    };

    _postApi(
      `/api/add/matching-rule`,
      ruleData,
      (data) => {
        if (data.success && data.data) {
          let conditions = data.data.conditions || [];
          
          // If conditions is a string (JSON), parse it
          if (typeof conditions === 'string') {
            try {
              conditions = JSON.parse(conditions);
            } catch (e) {
              console.error('Error parsing conditions:', e);
              conditions = [];
            }
          }
          
          // Ensure conditions is an array
          if (!Array.isArray(conditions)) {
            conditions = [];
          }
          
          const savedRule = {
            id: data.data.id.toString(),
            name: data.data.name,
            priority: data.data.priority,
            threshold: parseFloat(data.data.threshold),
            autoApprove: data.data.auto_approve,
            conditions: conditions
          };
          onRulesChange([...rules, savedRule]);
          handleCancel();
          toast.success("Rule saved successfully");
        } else {
          toast.error(data.message || "Failed to save rule");
        }
        setIsLoading(false);
      },
      (err) => {
        console.error(err);
        toast.error("Error saving rule");
        setIsLoading(false);
      }
    );
  };

  const deleteRule = async (ruleId) => {
    if (!activeBusiness?.id) {
      toast.error("Active business not found");
      return;
    }

    setIsLoading(true);
    _postApi(
      `/api/matching-rule/${ruleId}`,
      { facilityId: activeBusiness.id },
      (data) => {
        if (data.success) {
          onRulesChange(rules.filter(rule => rule.id !== ruleId));
          toast.success("Rule deleted successfully");
        } else {
          toast.error(data.message || "Failed to delete rule");
        }
        setIsLoading(false);
      },
      (err) => {
        console.error(err);
        toast.error("Error deleting rule");
        setIsLoading(false);
      },
      "DELETE"
    );
  };

  const exportRules = () => {
    const rulesJson = JSON.stringify(rules, null, 2);
    const blob = new Blob([rulesJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'matching-rules.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importRules = (event    ) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedRules = JSON.parse(e.target?.result);
          onRulesChange([...rules, ...importedRules]);
        } catch (error) {
          console.error('Error importing rules:', error);
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Matching Rules</h3>
          <p className="text-gray-600">Configure automated transaction matching rules</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => applyTemplate('exact')} className="text-xs h-8">
            Exact Match Template
          </Button>
          <Button variant="outline" size="sm" onClick={() => applyTemplate('partial')} className="text-xs h-8">
            Partial Match Template
          </Button>
          <div className="w-[1px] bg-slate-200 mx-1" />
          <Button variant="outline" onClick={exportRules} className="flex items-center gap-2 h-9">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <label className="cursor-pointer">
            <Button variant="outline" className="flex items-center gap-2 h-9">
              <Upload className="h-4 w-4" />
              Import
            </Button>
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={importRules}
            />
          </label>
          <Button onClick={() => setIsAddingRule(true)} className="flex items-center gap-2 bg-[var(--aa-navy)] hover:bg-[var(--aa-navy-hover)] h-9">
            <Plus className="h-4 w-4" />
            Add Custom Rule
          </Button>
        </div>
      </div>

      {/* Existing Rules */}
      <div className="space-y-4">
        {isLoading && rules.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-gray-500 mb-4">Loading rules...</p>
            </CardContent>
          </Card>
        ) : rules.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-gray-500 mb-4">No matching rules configured yet.</p>
              <Button onClick={() => setIsAddingRule(true)}>
                Create Your First Rule
              </Button>
            </CardContent>
          </Card>
        ) : (
          rules.map((rule) => (
            <Card 
              key={rule.id} 
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedRule?.id === rule.id 
                  ? "border-2 border-[var(--aa-accent)] bg-blue-50/50 shadow-sm ring-1 ring-blue-200" 
                  : "hover:border-slate-300 border-slate-200"
              }`}
              onClick={() => onRuleSelected && onRuleSelected(rule)}
            >
              <CardHeader className="py-3 px-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${selectedRule?.id === rule.id ? 'bg-[var(--aa-navy)]' : 'bg-slate-300'}`} />
                      {rule.name}
                      {rule.autoApprove && <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200 text-[10px] px-1.5 h-4 uppercase">Auto</Badge>}
                      {selectedRule?.id === rule.id && <Badge className="bg-[var(--aa-navy)] text-white text-[10px] px-1.5 h-4 uppercase ml-auto">Selected</Badge>}
                    </CardTitle>
                    <div className="flex gap-2 mt-1 ml-4">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Priority: {rule.priority}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">•</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Threshold: {(rule.threshold * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteRule(rule.id);
                      }}
                      className="h-7 w-7 text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {(!selectedRule || selectedRule?.id === rule.id) && (
                <CardContent className="pb-3 px-4 pt-0 animate-in slide-in-from-top-2 duration-200">
                  <div className={`flex flex-wrap gap-1.5 mt-2 p-2 rounded border shadow-inner ${selectedRule?.id === rule.id ? 'bg-white border-blue-100' : 'bg-slate-50 border-slate-200 opacity-80'}`}>
                    <p className="w-full text-[9px] font-bold text-slate-400 uppercase mb-1">
                      {selectedRule?.id === rule.id ? 'Active Conditions:' : 'Conditions:'}
                    </p>
                    {rule.conditions.map((condition, index) => (
                      <Badge key={index} variant="secondary" className="bg-white border-slate-100 text-[11px] font-normal py-0 px-2 h-5 text-slate-600">
                        <span className="font-bold text-slate-400 mr-1 uppercase text-[9px]">{condition.field}</span>
                        {condition.operator}
                        <span className="font-bold text-blue-600 ml-1">"{condition.value || '*'}"</span>
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>

      {/* Add New Rule Modal */}
      {isAddingRule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center px-4 pt-0 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  Add New Matching Rule
                </h2>
                <button
                  onClick={handleCancel}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Rule Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-transparent"
                      value={newRule.name || ''}
                      onChange={(e) => setNewRule(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Payroll Matching"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Priority
                    </label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-transparent"
                      value={newRule.priority || 1}
                      onChange={(e) => setNewRule(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Match Threshold (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-transparent"
                      value={(newRule.threshold || 0.7) * 100}
                      onChange={(e) => setNewRule(prev => ({ ...prev, threshold: parseInt(e.target.value) / 100 }))}
                    />
                  </div>
                  <div className="flex items-center space-x-2 pt-6">
                    <input
                      type="checkbox"
                      id="autoApprove"
                      checked={newRule.autoApprove || false}
                      onChange={(e) => setNewRule(prev => ({ ...prev, autoApprove: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-[var(--aa-accent)]"
                    />
                    <label htmlFor="autoApprove" className="text-sm font-medium text-gray-700">
                      Auto-approve matches
                    </label>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Conditions <span className="text-red-500">*</span>
                    </label>
                    <Button onClick={addCondition} size="sm" variant="outline">
                      <Plus className="h-4 w-4 mr-1" />
                      Add Condition
                    </Button>
                  </div>

                  {newRule.conditions?.length === 0 ? (
                    <div className="text-center py-4 text-gray-500 border border-dashed rounded-md">
                      No conditions added. Click "Add Condition" to add matching criteria.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {newRule.conditions?.map((condition, index) => (
                        <div key={index} className="grid grid-cols-5 gap-2 p-3 border rounded-md bg-gray-50">
                          <Select
                            value={condition.field}
                            onValueChange={(value) => updateCondition(index, { field: value })}
                          >
                            <SelectTrigger className="bg-white">
                              <SelectValue placeholder="Field" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="amount">Amount</SelectItem>
                              <SelectItem value="description">Description</SelectItem>
                              <SelectItem value="date">Date</SelectItem>
                              <SelectItem value="reference">Reference</SelectItem>
                            </SelectContent>
                          </Select>

                          <Select
                            value={condition.operator}
                            onValueChange={(value) => updateCondition(index, { operator: value })}
                          >
                            <SelectTrigger className="bg-white">
                              <SelectValue placeholder="Operator" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="equals">Equals</SelectItem>
                              <SelectItem value="contains">Contains</SelectItem>
                              <SelectItem value="startsWith">Starts With</SelectItem>
                              <SelectItem value="endsWith">Ends With</SelectItem>
                              <SelectItem value="between">Between</SelectItem>
                              <SelectItem value="fuzzy">Fuzzy Match</SelectItem>
                            </SelectContent>
                          </Select>

                          <input
                            type="text"
                            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-transparent bg-white"
                            value={condition.value.toString()}
                            onChange={(e) => updateCondition(index, { value: e.target.value })}
                            placeholder="Value"
                          />

                          <input
                            type="number"
                            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-transparent bg-white"
                            value={condition.weight}
                            onChange={(e) => updateCondition(index, { weight: parseFloat(e.target.value) })}
                            placeholder="Weight"
                            step="0.1"
                          />

                          <Button
                            onClick={() => removeCondition(index)}
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={saveRule}
                    disabled={isLoading}
                    className="flex-[2] flex items-center justify-center gap-2 bg-[var(--aa-navy)] hover:bg-[var(--aa-navy-hover)]"
                  >
                    {isLoading ? "Saving..." : "Save Rule"}
                  </Button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={isLoading}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md transition-colors font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MatchingRulesManager;