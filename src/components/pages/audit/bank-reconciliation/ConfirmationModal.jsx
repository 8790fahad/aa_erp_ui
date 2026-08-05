import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  bankTransaction,
  inAppTransaction
}) => {
  if (!bankTransaction || !inAppTransaction) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Confirm Match</DialogTitle>
          <DialogDescription>
            Are you sure you want to match these transactions?
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-500">Bank Statement</span>
              <Badge variant="outline">{bankTransaction.source === 'statement' ? 'Statement' : 'Ledger'}</Badge>
            </div>
            <div className="text-sm space-y-1">
              <div><strong>Description:</strong> {bankTransaction.description || 'N/A'}</div>
              <div><strong>Date:</strong> {bankTransaction.date}</div>
              <div><strong>Reference:</strong> {bankTransaction.reference || 'No reference'}</div>
              <div><strong>Amount:</strong> {Math.abs(bankTransaction.amount || 0).toLocaleString()}</div>
            </div>
          </div>

          <div className="text-center text-gray-400">?</div>

          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-500">General Ledger</span>
              <Badge variant="outline">{inAppTransaction.source === 'ledger' ? 'Ledger' : 'Statement'}</Badge>
            </div>
            <div className="text-sm space-y-1">
              <div><strong>Description:</strong> {inAppTransaction.description || 'N/A'}</div>
              <div><strong>Date:</strong> {inAppTransaction.date}</div>
              <div><strong>Reference:</strong> {inAppTransaction.reference || 'No reference'}</div>
              <div><strong>Amount:</strong> {Math.abs(inAppTransaction.amount || 0).toLocaleString()}</div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onConfirm} variant="default">
            Confirm Match
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConfirmationModal;
