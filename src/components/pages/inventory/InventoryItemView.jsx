import React, { useState, useEffect } from "react";
import {
  Package,
  DollarSign,
  Calendar,
  Tag,
  Users,
  FileText,
  ArrowLeft,
  AlertCircle,
  TrendingUp,
  Package2,
  Filter,
  SortAsc,
  Download,
  Search,
} from "lucide-react";
import { formatNumber1 } from "@/components/router/utilities";
import { _fetchApi } from "@/redux/actions/api";
import { toast } from "sonner";
import { useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import moment from "moment";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import useQuery from "@/hooks/useQuery";

export default function InventoryItemView() {
  const { activeBusiness } = useSelector((state) => state.auth);
  const { id: productId } = useParams();
  const query = useQuery()
  const type = query.get('type')
  const navigate = useNavigate();
  
  const [item, setItem] = useState(null);
  const [transactionHistory, setTransactionHistory] = useState([]);
  const [filteredHistory, setFilteredHistory] = useState([]);
  const [summaryStats, setSummaryStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    type: 'all',
    searchTerm: '',
    sortBy: 'date',
    sortOrder: 'desc'
  });

  const fetchItemDetails = () => {
    if (!productId || !activeBusiness?.id) return;
    
    setLoading(true);
    const salesTypeParam = type || 'all';
    _fetchApi(
      `/inventory/store-entries/item-details?productId=${productId}&facilityId=${activeBusiness.id}&salesType=${salesTypeParam}`,
      (resp) => {
        setLoading(false);
        if (resp.success) {
          setItem(resp.data?.product || null);
          setTransactionHistory(resp.data?.transactionHistory || []);
          setFilteredHistory(resp.data?.transactionHistory || []);
          setSummaryStats(resp.data?.summaryStats || null);
        } else {
          toast.error("Failed to load item details.");
        }
      },
      (err) => {
        setLoading(false);
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching item details.");
      }
    );
  };

  useEffect(() => {
    fetchItemDetails();
  }, [productId, activeBusiness?.id]);

  // Set filtered history initially
  useEffect(() => {
    setFilteredHistory(transactionHistory);
  }, [transactionHistory]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  // Apply filters whenever filters or transaction history changes
  useEffect(() => {
    if (!transactionHistory.length) {
      setFilteredHistory([]);
      return;
    }

    let filtered = [...transactionHistory];

    // Filter by type
    if (filters.type !== 'all') {
      filtered = filtered.filter(tx => 
        filters.type === 'in' ? tx.movement_type === 'IN' : tx.movement_type === 'OUT'
      );
    }

    // Filter by search term
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(tx => 
        (tx.reference_number && tx.reference_number.toLowerCase().includes(term)) ||
        (tx.source_info && tx.source_info.toLowerCase().includes(term)) ||
        (tx.destination_info && tx.destination_info.toLowerCase().includes(term)) ||
        (tx.transaction_description && tx.transaction_description.toLowerCase().includes(term))
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (filters.sortBy) {
        case 'date':
          comparison = new Date(b.createdAt) - new Date(a.createdAt);
          break;
        case 'quantity':
          const qtyA = a.movement_type === 'IN' ? a.quantity_in : a.quantity_out;
          const qtyB = b.movement_type === 'IN' ? b.quantity_in : b.quantity_out;
          comparison = qtyB - qtyA;
          break;
        case 'value':
          comparison = (b.transaction_value || 0) - (a.transaction_value || 0);
          break;
        default:
          comparison = new Date(b.createdAt) - new Date(a.createdAt);
      }
      
      return filters.sortOrder === 'desc' ? comparison : -comparison;
    });

    setFilteredHistory(filtered);
  }, [transactionHistory, filters]);

  const exportToCSV = () => {
    // Create CSV content
    const headers = [
      'Date', 'Type', 'Reference', 'Source', 'Destination', 
      'Quantity In', 'Quantity Out', 'Unit Cost', 'Total Value'
    ];
    
    const csvContent = [
      headers.join(','),
      ...filteredHistory.map(tx => [
        `"${moment(tx.inserted_time).format('YYYY-MM-DD HH:mm')}"`,
        `"${tx.movement_type}"`,
        `"${tx.reference_number || ''}"`,
        `"${tx.source_info || ''}"`,
        `"${tx.destination_info || ''}"`,
        `"${tx.qty_in || 0}"`,
        `"${tx.qty_out || 0}"`,
        `"${tx.unit_cost || 0}"`,
        `"${tx.transaction_value || 0}"`
      ].join(','))
    ].join('\n');

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `inventory_history_${item?.sku || 'item'}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGoBack}
              className="mb-2 flex items-center text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Main Content */}
            <div className="lg:col-span-3 space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Item Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span>Transaction History</span>
                    <Badge variant="outline">{filteredHistory.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-48 w-full" />
                </CardContent>
              </Card>
            </div>
            
            {/* Sidebar */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Inventory Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Filters</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="p-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGoBack}
              className="mb-2 flex items-center text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </div>
          
          <div className="flex flex-col items-center justify-center py-8">
            <AlertCircle className="h-12 w-12 text-gray-400 mb-3" />
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Item Not Found</h2>
            <p className="text-sm text-gray-600 mb-4">The requested inventory item could not be found.</p>
            <Button onClick={handleGoBack} size="sm">Go Back to Inventory</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleGoBack}
            className="mb-2 flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h1 className="text-xl font-bold text-gray-900 truncate">{item.item_name}</h1>
              <div className="flex items-center gap-2 mt-1">
                {item.category && (
                  <Badge variant="secondary" className="text-xs">
                    {item.category}
                  </Badge>
                )}
                {item.type && (
                  <Badge 
                    variant={item.type === "Finished Good" ? "default" : 
                            item.type === "Raw Material" ? "outline" : "secondary"}
                    className="text-xs"
                  >
                    {item.type}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-4">
            {/* Item Details Card */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Item Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Item Name</p>
                    <p className="text-sm font-medium text-gray-900">{item.name || item.item_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">SKU / Code</p>
                    <p className="text-sm text-gray-900">{item.sku || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Category</p>
                    <p className="text-sm text-gray-900">{item.category || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Item Type</p>
                    <p className="text-sm text-gray-900">{item.item_type || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Unit of Measure</p>
                    <p className="text-sm text-gray-900">{item.unit_of_measure || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Status</p>
                    <Badge variant={item.status === 'Active' ? 'default' : 'destructive'} className="text-xs">
                      {item.status || 'N/A'}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Cost Price</p>
                    <p className="text-sm font-medium text-gray-900">₦{formatNumber1(item.cost_price || 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Selling Price</p>
                    <p className="text-sm font-medium text-gray-900">₦{formatNumber1(item.selling_price || 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Mark-up</p>
                    <p className="text-sm text-gray-900">
                      {item.mark_up != null
                        ? `${item.mark_up}${item.markup_mode === 'percentage' ? '%' : ' (fixed)'}`
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Current Stock</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {formatNumber1(item.current_stock || 0)}
                      <span className="text-xs font-normal text-gray-500 ml-1">{item.unit_of_measure || 'units'}</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Total Stock Value</p>
                    <p className="text-sm font-medium text-green-600">₦{formatNumber1(item.total_value || 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Taxable</p>
                    <Badge variant={item.taxable === 'Taxable' ? 'default' : 'outline'} className="text-xs">
                      {item.taxable || 'N/A'}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Reorder Level</p>
                    <p className="text-sm text-gray-900">{formatNumber1(item.reorder_level || 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Warehouse</p>
                    <p className="text-sm text-gray-900">{item.warehouse_id || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Tags</p>
                    <p className="text-sm text-gray-900">{item.tags || 'None'}</p>
                  </div>
                </div>
                {item.notes && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs text-gray-500 mb-0.5">Notes</p>
                    <p className="text-sm text-gray-700">{item.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Transaction History Card */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Transaction History
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{filteredHistory.length} records</Badge>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={exportToCSV}
                      title="Export to CSV"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {/* Filters */}
                <div className="p-4 border-b flex flex-wrap gap-2 items-center">
                  <Select 
                    value={filters.type} 
                    onValueChange={(value) => handleFilterChange('type', value)}
                  >
                    <SelectTrigger className="w-32 h-8 text-xs">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="in">Received (IN)</SelectItem>
                      <SelectItem value="out">Issued (OUT)</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select 
                    value={filters.sortBy} 
                    onValueChange={(value) => handleFilterChange('sortBy', value)}
                  >
                    <SelectTrigger className="w-32 h-8 text-xs">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date">Date</SelectItem>
                      <SelectItem value="quantity">Quantity</SelectItem>
                      <SelectItem value="value">Value</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select 
                    value={filters.sortOrder} 
                    onValueChange={(value) => handleFilterChange('sortOrder', value)}
                  >
                    <SelectTrigger className="w-24 h-8 text-xs">
                      <SelectValue placeholder="Order" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="desc">Descending</SelectItem>
                      <SelectItem value="asc">Ascending</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <div className="relative flex-1 min-w-32">
                    <Input
                      type="text"
                      placeholder="Search..."
                      value={filters.searchTerm}
                      onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                      className="h-8 text-xs pl-7"
                    />
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400" />
                  </div>
                </div>
                
                {/* Transaction Table */}
                <div className="max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-white z-10">
                      <TableRow>
                        <TableHead className="text-xs py-2 whitespace-nowrap">Date</TableHead>
                        <TableHead className="text-xs py-2">Movement</TableHead>
                        <TableHead className="text-xs py-2">Entry Type</TableHead>
                        <TableHead className="text-xs py-2">Reference</TableHead>
                        <TableHead className="text-xs py-2">Source</TableHead>
                        <TableHead className="text-xs py-2">Destination</TableHead>
                        <TableHead className="text-xs py-2">Warehouse</TableHead>
                        <TableHead className="text-xs py-2 whitespace-nowrap">Expiry Date</TableHead>
                        <TableHead className="text-xs py-2 text-right">Qty In</TableHead>
                        <TableHead className="text-xs py-2 text-right">Qty Out</TableHead>
                        <TableHead className="text-xs py-2 text-right">Unit Cost</TableHead>
                        <TableHead className="text-xs py-2 text-right">Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredHistory.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={12} className="text-center py-8 text-gray-500">
                            <FileText className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                            No transaction history found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredHistory.map((tx, index) => (
                          <TableRow key={index} className="text-xs hover:bg-gray-50">
                            <TableCell className="py-1.5 whitespace-nowrap">
                              <div className="font-medium">{moment(tx.createdAt).format('DD/MM/YYYY')}</div>
                              <div className="text-gray-400">{moment(tx.createdAt).format('HH:mm')}</div>
                            </TableCell>

                            <TableCell className="py-1.5">
                              <Badge
                                variant={tx.movement_type === 'IN' ? 'default' : 'destructive'}
                                className="text-xs"
                              >
                                {tx.movement_type}
                              </Badge>
                              <div className="text-gray-500 text-xs mt-0.5">{tx.transaction_description || '-'}</div>
                            </TableCell>

                            <TableCell className="py-1.5">
                              <span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 text-xs">
                                {tx.type || '-'}
                              </span>
                            </TableCell>

                            <TableCell className="py-1.5">
                              <div className="font-medium">{tx.reference_number || '-'}</div>
                              {tx.supplier_code && (
                                <div className="text-gray-400">{tx.supplier_code}</div>
                              )}
                            </TableCell>

                            <TableCell className="py-1.5 max-w-[100px] truncate" title={tx.source_info}>
                              {tx.source_info || '-'}
                            </TableCell>

                            <TableCell className="py-1.5 max-w-[100px] truncate" title={tx.destination_info}>
                              {tx.destination_info || '-'}
                            </TableCell>

                            <TableCell className="py-1.5">
                              {tx.location || tx.branch_name || '-'}
                            </TableCell>

                            <TableCell className="py-1.5 whitespace-nowrap">
                              {tx.expiry_date
                                ? <span className={moment(tx.expiry_date).isBefore(moment()) ? 'text-red-600 font-medium' : 'text-gray-700'}>
                                    {moment(tx.expiry_date).format('DD/MM/YY')}
                                  </span>
                                : <span className="text-gray-300">-</span>
                              }
                            </TableCell>

                            <TableCell className="py-1.5 text-right">
                              {parseFloat(tx.qty_in || 0) > 0 ? (
                                <span className="text-green-600 font-medium">+{formatNumber1(tx.qty_in)}</span>
                              ) : <span className="text-gray-300">-</span>}
                            </TableCell>

                            <TableCell className="py-1.5 text-right">
                              {parseFloat(tx.qty_out || 0) > 0 ? (
                                <span className="text-red-600 font-medium">-{formatNumber1(tx.qty_out)}</span>
                              ) : <span className="text-gray-300">-</span>}
                            </TableCell>

                            <TableCell className="py-1.5 text-right text-gray-700">
                              ₦{formatNumber1(tx.unit_cost || 0)}
                            </TableCell>

                            <TableCell className="py-1.5 text-right font-medium">
                              ₦{formatNumber1(tx.transaction_value || 0)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Inventory Summary Card */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package2 className="h-4 w-4" />
                  Inventory Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between items-center py-1 border-b">
                  <span className="text-xs text-gray-600 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-green-500" />
                    Total Received
                  </span>
                  <span className="text-sm font-medium text-green-600">
                    {formatNumber1(summaryStats?.totalReceived || 0)} {item.unit_of_measure || ''}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b">
                  <span className="text-xs text-gray-600 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-red-500 rotate-180" />
                    Total Issued
                  </span>
                  <span className="text-sm font-medium text-red-600">
                    {formatNumber1(summaryStats?.totalIssued || 0)} {item.unit_of_measure || ''}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b">
                  <span className="text-xs text-gray-600 flex items-center gap-1">
                    <Package className="h-3 w-3 text-blue-500" />
                    Current Balance
                  </span>
                  <span className="text-sm font-bold text-gray-900">
                    {formatNumber1(item.current_stock || 0)} {item.unit_of_measure || ''}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-xs text-gray-500">Total Transactions</span>
                  <span className="text-sm font-medium">{summaryStats?.transactionCount || 0}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-xs text-gray-500">Purchases</span>
                  <span className="text-sm">{summaryStats?.purchaseCount || 0}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-xs text-gray-500">Sales</span>
                  <span className="text-sm">{summaryStats?.salesCount || 0}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-xs text-gray-500">WIP</span>
                  <span className="text-sm">{summaryStats?.wipCount || 0}</span>
                </div>
                {item.current_stock <= item.reorder_level && item.current_stock > 0 && (
                  <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                    <p className="text-xs text-yellow-800">
                      <AlertCircle className="h-3 w-3 inline mr-1" />
                      Reorder level reached
                    </p>
                  </div>
                )}
                {parseFloat(item.current_stock) === 0 && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                    <p className="text-xs text-red-800">
                      <AlertCircle className="h-3 w-3 inline mr-1" />
                      Out of stock
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Additional Info Card */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Additional Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Reorder Level</p>
                  <p className="text-sm text-gray-900">{formatNumber1(item.reorder_level || 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Cost Price</p>
                  <p className="text-sm font-medium text-gray-900">₦{formatNumber1(item.cost_price || 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Selling Price</p>
                  <p className="text-sm font-medium text-gray-900">₦{formatNumber1(item.selling_price || 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Mark-up</p>
                  <p className="text-sm text-gray-900">
                    {item.mark_up != null
                      ? `${item.mark_up}${item.markup_mode === 'percentage' ? '%' : ' fixed'}`
                      : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Stock Value</p>
                  <p className="text-sm font-semibold text-green-600">₦{formatNumber1(item.total_value || 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Avg. Unit Cost</p>
                  <p className="text-sm text-gray-900">₦{formatNumber1(summaryStats?.averageCost || 0)}</p>
                </div>
                {item.supplier_id && (
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Supplier Code</p>
                    <p className="text-sm text-gray-900">{item.supplier_id}</p>
                  </div>
                )}
                {item.notes && (
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Notes</p>
                    <p className="text-sm text-gray-700">{item.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}