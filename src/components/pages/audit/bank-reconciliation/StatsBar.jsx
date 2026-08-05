import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, CheckCircle2, AlertCircle } from 'lucide-react';

const StatsBar = ({ bankTransactions, inAppTransactions, matchedPairs }) => {
  const bankTotal = bankTransactions.filter(t => t.source === 'statement').length;
  const ledgerTotal = inAppTransactions.filter(t => t.source === 'ledger').length;
  const matchedCount = matchedPairs?.length || 0;
  const unmatchedBank = bankTransactions.filter(t => t.source === 'statement' && t.reconciled === 'unmatched').length;
  const unmatchedLedger = inAppTransactions.filter(t => t.source === 'ledger' && t.reconciled === 'unmatched').length;

  const stats = [
    {
      label: 'Bank Transactions',
      value: bankTotal,
      icon: TrendingDown,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      label: 'Ledger Transactions',
      value: ledgerTotal,
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      label: 'Matched',
      value: matchedCount,
      icon: CheckCircle2,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      label: 'Unmatched',
      value: unmatchedBank + unmatchedLedger,
      icon: AlertCircle,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                </div>
                <div className={`${stat.bgColor} p-3 rounded-full`}>
                  <Icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default StatsBar;
