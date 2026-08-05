import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckSquare, Square, X } from 'lucide-react';

const BulkMatchControls = ({
  bulkMode,
  onToggleBulkMode,
  bankSelectedCount,
  appSelectedCount,
  onClearSelection,
  onBulkMatch
}) => {
  if (!bulkMode) return null;

  const canMatch = bankSelectedCount > 0 && 
                   appSelectedCount > 0 && 
                   bankSelectedCount === appSelectedCount;

  return (
    <Card className="mb-6 border-orange-200 bg-orange-50">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-orange-600" />
              <span className="font-medium">Bulk Match Mode</span>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline">
                Bank: {bankSelectedCount} selected
              </Badge>
              <Badge variant="outline">
                Ledger: {appSelectedCount} selected
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(bankSelectedCount > 0 || appSelectedCount > 0) && (
              <Button
                onClick={onClearSelection}
                size="sm"
                variant="outline"
                className="gap-1"
              >
                <X className="h-4 w-4" />
                Clear
              </Button>
            )}
            <Button
              onClick={onBulkMatch}
              size="sm"
              variant="default"
              disabled={!canMatch}
            >
              Match {bankSelectedCount} Pairs
            </Button>
            <Button
              onClick={onToggleBulkMode}
              size="sm"
              variant="outline"
            >
              Exit Bulk Mode
            </Button>
          </div>
        </div>
        {bankSelectedCount !== appSelectedCount && bankSelectedCount > 0 && appSelectedCount > 0 && (
          <p className="text-sm text-orange-600 mt-2">
            Select equal number of transactions from both sides to match
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default BulkMatchControls;
