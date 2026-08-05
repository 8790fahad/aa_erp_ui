import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, User, Clock, FileText, Eye, RefreshCw } from 'lucide-react';
import { useSelector } from 'react-redux';
import { _fetchApi } from '@/redux/actions/api';
import { toast } from 'sonner';

const AuditTrail = ({ selectedAccount }) => {
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState('all');
  const [auditEntries, setAuditEntries] = useState([]);
  const [statistics, setStatistics] = useState({
    totalEntries: 0,
    uniqueUsers: 0,
    matchedTransactions: 0,
    lastActivity: null
  });

  const fetchAuditTrail = useCallback(() => {
    if (!activeBusiness?.id) {
      return;
    }

    setLoading(true);
    const params = new URLSearchParams({
      facilityId: activeBusiness.id
    });

    if (selectedAccount) {
      params.append('bankAccountId', selectedAccount);
    }

    _fetchApi(
      `/api/get/audit-trail?${params.toString()}`,
      (data) => {
        if (data.success && data.results) {
          setAuditEntries(data.results.auditEntries || []);
          setStatistics(data.results.statistics || {
            totalEntries: 0,
            uniqueUsers: 0,
            matchedTransactions: 0,
            lastActivity: null
          });
        } else {
          toast.error(data.message || "Failed to fetch audit trail data");
        }
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching audit trail:", err);
        toast.error("Error fetching audit trail data");
        setLoading(false);
      }
    );
  }, [activeBusiness?.id, selectedAccount]);

  useEffect(() => {
    fetchAuditTrail();
  }, [fetchAuditTrail]);

  const getActionBadge = (action) => {
    const actionColors = {
      TRANSACTION_MATCHED: 'bg-green-100 text-green-800',
      TRANSACTION_UNMATCHED: 'bg-yellow-100 text-yellow-800',
      RECONCILIATION_LOCKED: 'bg-blue-100 text-blue-800',
      ADJUSTMENT_CREATED: 'bg-yellow-100 text-yellow-800',
      BANK_STATEMENT_IMPORTED: 'bg-purple-100 text-purple-800',
      DISCREPANCY_CREATED: 'bg-red-100 text-red-800',
      DISCREPANCY_UPDATED: 'bg-orange-100 text-orange-800',
      DISCREPANCY_RESOLVED: 'bg-green-100 text-green-800',
      USER_PERMISSION_CHANGED: 'bg-orange-100 text-orange-800',
      REPORT_EXPORTED: 'bg-gray-100 text-gray-800',
      AUTO_MATCH_EXECUTED: 'bg-blue-100 text-blue-800'
    };

    return (
      <Badge className={actionColors[action] || 'bg-gray-100 text-gray-800'}>
        {action.replace(/_/g, ' ')}
      </Badge>
    );
  };

  const getEntityTypeBadge = (entityType) => {
    const typeColors = {
      transaction: 'bg-blue-100 text-blue-800',
      reconciliation: 'bg-green-100 text-green-800',
      account: 'bg-purple-100 text-purple-800',
      discrepancy: 'bg-red-100 text-red-800',
      report: 'bg-gray-100 text-gray-800'
    };

    return (
      <Badge variant="outline" className={typeColors[entityType] || 'bg-gray-100 text-gray-800'}>
        {entityType}
      </Badge>
    );
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString();
  };

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return 'N/A';
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now - time;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    return `${diffDays}d`;
  };

  // Filter entries based on search and user selection
  const filteredEntries = auditEntries.filter((entry) => {
    const matchesSearch = 
      entry.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.user?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.entityId?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesUser = selectedUser === 'all' || entry.user === selectedUser;

    return matchesSearch && matchesUser;
  });

  const uniqueUsers = Array.from(new Set(auditEntries.map(entry => entry.user)));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Audit Trail</h2>
          <p className="text-gray-600">Complete log of all bank reconciliation activities and changes</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex items-center gap-2" onClick={fetchAuditTrail} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button className="flex items-center gap-2 bg-[#4267B2] hover:bg-[#365899]">
            <FileText className="h-4 w-4" />
            Export Audit Log
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Entries</CardTitle>
            <FileText className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.totalEntries || auditEntries.length}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <User className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.uniqueUsers || uniqueUsers.length}</div>
            <p className="text-xs text-muted-foreground">Total users</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transactions Matched</CardTitle>
            <Clock className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.matchedTransactions || 0}</div>
            <p className="text-xs text-muted-foreground">Total matched</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Activity</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statistics.lastActivity ? formatTimeAgo(statistics.lastActivity) : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">ago</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search audit entries..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={selectedUser === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedUser('all')}
              >
                All Users
              </Button>
              {uniqueUsers.map((user) => (
                <Button
                  key={user}
                  variant={selectedUser === user ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedUser(user)}
                >
                  {user.split(' ')[0]}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Trail Table */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Changes</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    Loading audit trail data...
                  </TableCell>
                </TableRow>
              ) : filteredEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    No audit trail entries found
                  </TableCell>
                </TableRow>
              ) : (
                filteredEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-mono text-sm">
                      {formatTimestamp(entry.timestamp)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-500" />
                        {entry.user}
                      </div>
                    </TableCell>
                    <TableCell>{getActionBadge(entry.action)}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {entry.description}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getEntityTypeBadge(entry.entityType)}
                        <span className="font-mono text-xs text-gray-500">
                          {entry.entityId}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      {entry.oldValue && entry.newValue ? (
                        <div className="text-sm">
                          <div className="text-red-600">- {entry.oldValue}</div>
                          <div className="text-green-600">+ {entry.newValue}</div>
                        </div>
                      ) : entry.newValue ? (
                        <div className="text-sm text-green-600">+ {entry.newValue}</div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-gray-500">
                      {entry.ipAddress || 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" className="h-8 w-8 p-0">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuditTrail;
