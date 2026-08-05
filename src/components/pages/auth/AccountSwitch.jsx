import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate} from "react-router-dom";
// import "./AccountSwitch.css";
export default function AccountSwitch() {
  const { business } = useSelector((state) => state.auth);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  return (
    <div className="bg-[#4267b2]  min-h-screen w-full">
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h2 className="text-3xl font-semibold mb-4 text-white">
          Choose Account you want to Access
        </h2>
        <p className="text-lg text-white mb-6 max-w-3xl text-center">
          You have multiple accounts available for you. Please select one to
          proceed with your login. Each account has its own unique features and
          access levels.
        </p>
        {business && business?.length > 0 && (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4 h-full p-10">
            {[...business].map((item, idx) => (
              <div
                key={idx}
                className="w-full mx-auto bg-white rounded-lg shadow-lg overflow-hidden transform transition-transform hover:scale-105 cursor-pointer"
                onClick={() => {
                  if (item.status === "Pending") {
                    alert("This account is currently pending approval.")
                    // toas.error(
                    //   "This account is currently pending approval. Please check back later."
                    // );
                  } else {
                    dispatch({ type: "UPDATE_USER", payload: item });
                    navigate(`/app/home`);
                  }
                }}
              >
                <Link className="flex items-center p-3.5">
                  {item.business_logo ? (
                    <img
                      className="h-16 w-16 rounded-full border-2 border-gray-300"
                      alt={`${item.business_name} logo`}
                      src={item.business_logo}
                    />
                  ) : (
                    <div className="h-16 w-16 flex items-center justify-center bg-gray-200 rounded-full border-2 border-gray-300">
                      <p className="text-3xl font-bold text-gray-700">
                        {item?.business_name.split(" ")[0].slice(0, 2)}
                      </p>
                    </div>
                  )}
                  <div className="ml-6">
                    <div className="font-bold text-xl text-gray-800">
                      {item?.business_name}
                    </div>
                    <Badge
                      variant={
                        item?.status === "Approved" ? "success" : "warning"
                      }
                      className="mt-1"
                    >
                      {item?.status}
                    </Badge>
                    <p className="text-sm text-gray-500 mt-1">
                      {item?.business_type || "No description available."}
                    </p>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}

        {business?.length == 0 && (
          <>
            <div className=" items-center justify-center">
              <p className="text-xl font-bold text-white">No business found.</p>
            </div>
            <div className="pt-6 pl-3">
              <Button
                className="px-8 py-4 text-white transition"
                onClick={() => {
                  localStorage.removeItem("@@token");
                  navigate("/");
                }}
              >
                Go back to login
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
