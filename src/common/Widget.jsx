import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PropTypes from "prop-types";

const Widget = ({ icon, title, content }) => {
//   const navigate = useNavigate();

  return (
    <Card
      className="bg-[var(--aa-navy)] text-white"
    //   onClick={
    //     navigate(link)
    //   }
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{content}</div>
      </CardContent>
    </Card>
  );
};

export default Widget;

Widget.propTypes = {
  icon: PropTypes.node,
  title: PropTypes.string,
  content: PropTypes.string,
};
