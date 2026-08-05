import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AuditTrail from './bank-reconciliation/AuditTrail';

const AuditTrailPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const bankId = searchParams.get('bankId');

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto py-6">
        <div className="mb-6 flex items-center gap-4">
          <Button
            onClick={() => navigate(bankId ? `/app/audit/bank-reconciliation?bankId=${bankId}` : `/app/audit/bank-reconciliation`)}
            variant="outline"
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Reconciliation
          </Button>
        </div>
        <AuditTrail selectedAccount={bankId} />
      </div>
    </div>
  );
};

export default AuditTrailPage;
