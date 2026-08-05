import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Sparkles } from 'lucide-react';

const SuggestedMatches = ({ 
  suggestions, 
  bankTransactions, 
  inAppTransactions, 
  onAccept, 
  onReject, 
  onAcceptAll 
}) => {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <Card className="mb-6 border-blue-200 bg-blue-50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg">Suggested Matches ({suggestions.length})</CardTitle>
          </div>
          <Button onClick={onAcceptAll} size="sm" variant="default">
            Accept All
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {suggestions.map((suggestion, index) => {
            const bankTx = bankTransactions.find(t => t.id === suggestion.bankTransactionId);
            const appTx = inAppTransactions.find(t => t.id === suggestion.inAppTransactionId);

            if (!bankTx || !appTx) return null;

            return (
              <div
                key={`${suggestion.bankTransactionId}-${suggestion.inAppTransactionId}`}
                className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200"
              >
                <div className="flex-1 grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      Bank: {bankTx.description || 'N/A'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {bankTx.date} ? {bankTx.reference || 'No ref'} ? {Math.abs(bankTx.amount || 0).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      Ledger: {appTx.description || 'N/A'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {appTx.date} ? {appTx.reference || 'No ref'} ? {Math.abs(appTx.amount || 0).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <div className="flex flex-col items-end">
                    <Badge 
                      variant={suggestion.confidence >= 80 ? "default" : suggestion.confidence >= 60 ? "secondary" : "outline"}
                      className="mb-1"
                    >
                      {suggestion.confidence}%
                    </Badge>
                    {suggestion.matchedBy && suggestion.matchedBy.length > 0 && (
                      <span className="text-xs text-gray-500">
                        {suggestion.matchedBy[0]}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => onAccept(suggestion)}
                      size="sm"
                      variant="default"
                      className="gap-1"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Accept
                    </Button>
                    <Button
                      onClick={() => onReject(suggestion)}
                      size="sm"
                      variant="outline"
                      className="gap-1"
                    >
                      <XCircle className="h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default SuggestedMatches;
