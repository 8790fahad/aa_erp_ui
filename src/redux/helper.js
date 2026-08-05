/* eslint-disable no-unused-vars */
import { BadgeCheck, CircleAlert } from "lucide-react";
import { toast } from "sonner";

const _warningNotify = (msg) => {
  toast(msg, {
    className: 'custom-error-toast',
    // icon: <CircleAlert className="text-red-500" />
  });
};
const _customNotify = (msg) => {
  toast(msg, {
    className: 'custom-toast',
    // icon: <BadgeCheck className="text-blue-500" />
  });
};

export { _customNotify, _warningNotify };
