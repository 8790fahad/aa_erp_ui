import { BadgeCheck } from "lucide-react";
import { toast } from "sonner"

function CustomSuccessAlert(message) {
  toast(message, {
    className: 'custom-toast',
    icon: <BadgeCheck className="text-blue-500" />
  });
}

export default CustomSuccessAlert;
