import { Navigate } from "react-router-dom";

/**
 * Second approval stage removed.
 * Approve tab uses AdministrativeReview (pending → approved in one step).
 */
export default function ApprovalByMD() {
  return <Navigate to="/app/account/administrative-review" replace />;
}
