import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { CheckCircle, Clock } from "lucide-react";

export function BatchCard({ id, name, quantity, date, status, grnNumber, po_no, pr_no, requisitor, reason }) {
  const actionButtonText = status === "processed" ? "Transfer" : "Process";

  return (
    <Card className="h-full">
      <CardHeader className="pb-2 px-3">
        <div className="flex justify-between items-start">
          <StatusBadge status={status} />
        </div>
      </CardHeader>
      <CardContent className="pb-2 px-3">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>GRN:</span>
            <span className="font-medium">{grnNumber}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">PO No.:</span>
            <span className="font-medium">{po_no}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Requisitor:</span>
            <span className="font-medium">{requisitor}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Reason:</span>
            <span className="font-medium">{reason}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Date:</span>
            <span className="font-medium">{date}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-2 px-2 pb-2 border-t flex justify-end gap-2">
        <Link to={`view/${encodeURIComponent(pr_no)}`}>
          <Button
            variant="outline"
            size="sm"
            className="text-xs text-dark h-7 px-2 shadow-none"
          >
            View
          </Button>
        </Link>
        {status === "Approved" && (
          <Link to={`process/${encodeURIComponent(pr_no)}`}>
            <Button
              size="sm"
              className="text-xs h-7 px-2 shadow-none bg-[var(--aa-navy)] hover:bg-[var(--aa-navy)] text-white"
            >
              Process
            </Button>
          </Link>
        )}
      </CardFooter>
    </Card>
  );
}

function StatusBadge({ status }) {
  switch (status) {
    case "processed":
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-200 flex gap-1 items-center shadow-none">
          <CheckCircle className="h-3 w-3" />
          Processed
        </Badge>
      );
    case "pending":
      return (
        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 flex gap-1 items-center shadow-none">
          <Clock className="h-3 w-3" />
          Pending
        </Badge>
      );
    default:
      return null;
  }
}
