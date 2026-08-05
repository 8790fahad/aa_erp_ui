import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import BankReconciliationReport from './bank-reconciliation/BankReconciliationReport';

const ReportsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const bankId = searchParams.get('bankId');

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="max-w-7xl mx-auto">
        <div className=" flex items-center justify-between no-print">
          <div className="flex items-center gap-4">
            {bankId && (
              <Button
                onClick={() => navigate(`/app/audit/bank-reconciliation?bankId=${bankId}`)}
                variant="ghost"
                className="group hover:bg-white hover:shadow-sm"
              >
                <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                Back to Reconciliation
              </Button>
            )}
          </div>
        </div>

        <BankReconciliationReport />
      </div>
    </div>
  );
};

export default ReportsPage;
