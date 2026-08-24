import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader } from "lucide-react";
import logo from "../../../assets/aa_erp.png";
import registerBg from "../../../assets/register-bg.png";
import { Textarea } from "@/components/ui/textarea";
import { useDispatch } from "react-redux";
import { signup } from "@/redux/actions/auth";
import { getSidebarByAppType } from "@/components/sidebars/sidebarModules";

export default function Register() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [form, setForm] = useState({
    query_type: "new_admin",
    username: "",
    email: "",
    phone: "",
    role: "Admin",
    password: "",
    confirmPassword: "",
    busName: "",
    busType: "",
    address: "",
  });

  const dSame = form.password === form.confirmPassword;

  const busType = [
    { name: "--select--", value: "" },
    { name: "Retailers", value: "retailers" },
    { name: "Manufacturing", value: "manufacturing" },
    { name: "Recycling", value: "recycling" },
    { name: "Services", value: "services" },
  ];

  const handleChange = ({ target: { name, value } }) => {
    setForm((p) => ({
      ...p,
      [name]: value,
    }));
  };

  const accessDefiner = () => {
    const functionalities = [];

    const sidebarItems = getSidebarByAppType(form.busType);

    const accessTo = sidebarItems.map((item) => item?.title);

    sidebarItems.forEach((item) => {
      if (Array.isArray(item.items)) {
        item?.items?.forEach((child) => {
          functionalities.push(child.title);
          child.subFunctionalities?.forEach((sub) => {
            if (sub?.title) functionalities.push(sub.title);
          });
        });
      }
    });

    return { accessTo, functionalities };
  };


  const resetForm = () => {
    setForm({
      firstname: "",
      lastname: "",
      username: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      busName: "",
      busType: "",
      address: "",
    });
  };

  // const goHome = () => {
  //   resetForm();
  //   setIsLoading(false);
  //   navigate("/app");
  // };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (form.firstname === "" || form.lastname === "" || form.phone === "") {
      alert("Incomplete form");
      return;
    }

    if (!dSame) {
      return;
    }

    setIsLoading(true);
    const { accessTo, functionalities } = accessDefiner();
    // console.log(accessDefiner());
    form.accessTo = accessTo;
    form.functionalities = functionalities;

    const goHome = () => {
      resetForm();
      setIsLoading(false);
      navigate("/app");
    };

    const error = (err) => {
      console.log(err);
      setIsLoading(false);
    };

    // console.log(form);

    dispatch(signup(form, goHome, error));
  };

  let passwordErr = dSame ? "The password matched!" : "Password does not match";

  return (
    <div className="flex flex-col lg:flex-row min-h-screen w-full">
      <div className="flex-1 flex items-center justify-center p-10 bg-background">
        <div className="w-full max-w-md space-y-8">
          {/* {JSON.stringify(sidebarItems)} */}
          <div className="space-y-2 text-center">
            <img
              src={logo}
              alt="Login background"
              className="mx-auto"
              style={{ width: "10rem", height: "5rem" }}
            />
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Firstname</Label>
                <Input
                  className="border-2 border-[var(--aa-navy)] focus:ring-[var(--aa-accent)] focus:border-[var(--aa-navy)]"
                  id="firstName"
                  name="firstName"
                  placeholder="John"
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Lastname</Label>
                <Input
                  className="border-2 border-[var(--aa-navy)] focus:ring-[var(--aa-accent)] focus:border-[var(--aa-navy)]"
                  id="lastname"
                  name="lastname"
                  placeholder="Doe"
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="userName">Username</Label>
                <Input
                  className="border-2 border-[var(--aa-navy)] focus:ring-[var(--aa-accent)] focus:border-[var(--aa-navy)]"
                  id="username"
                  name="username"
                  // placeholder="Doe"
                  onChange={handleChange}
                  // required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="busName">Business Name</Label>
                <Input
                  className="border-2 border-[var(--aa-navy)] focus:ring-[var(--aa-accent)] focus:border-[var(--aa-navy)]"
                  id="busName"
                  name="busName"
                  // placeholder="Doe"
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="busName">Business Type</Label>
                <select
                  className="form-select border-2 border-[var(--aa-navy)] focus:ring-[var(--aa-accent)] focus:border-[var(--aa-navy)] bg-transparent"
                  id="busType"
                  type="select"
                  name="busType"
                  onChange={handleChange}
                  required
                >
                  {busType.map((i, index) => (
                    <option key={index} value={i.value}>
                      {i.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Business address</Label>
              <Textarea
                className="border-2 border-[var(--aa-navy)] focus:ring-[var(--aa-accent)] focus:border-[var(--aa-navy)]"
                id="address"
                name="address"
                onChange={handleChange}
                rows={3}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  className="border-2 border-[var(--aa-navy)] focus:ring-[var(--aa-accent)] focus:border-[var(--aa-navy)]"
                  id="phone"
                  name="phone"
                  type="tel"
                  onChange={handleChange}
                  placeholder="+1 (555) 000-0000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  className="border-2 border-[var(--aa-navy)] focus:ring-[var(--aa-accent)] focus:border-[var(--aa-navy)]"
                  id="email"
                  name="email"
                  onChange={handleChange}
                  required
                  type="email"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    className="border-2 border-[var(--aa-navy)] focus:ring-[var(--aa-accent)] focus:border-[var(--aa-navy)] pr-10"
                    id="password"
                    name="password"
                    onChange={handleChange}
                    required
                    type={showPassword ? "text" : "password"}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 rounded-r border-0 right-0 px-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 !text-dark" />
                    ) : (
                      <Eye className="h-5 w-5 !text-dark" />
                    )}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Input
                    className="border-2 border-[var(--aa-navy)] focus:ring-[var(--aa-accent)] focus:border-[var(--aa-navy)] pr-10"
                    id="confirmPassword"
                    name="confirmPassword"
                    onChange={handleChange}
                    required
                    type={showConfirmPassword ? "text" : "password"}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 rounded-r border-0 px-3 flex items-center"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-5 w-5 !text-dark" />
                    ) : (
                      <Eye className="h-5 w-5 !text-dark" />
                    )}
                  </button>
                </div>
              </div>
            </div>
            {/* <div className="flex items-center space-x-2">
              <input type="checkbox" id="terms" />
              <Label htmlFor="terms" className="text-sm">
                I agree to the{" "}
                <Link href="/terms" className="underline">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="underline">
                  Privacy Policy
                </Link>
              </Label>
            </div> */}
            <Button
              className="w-full bg-[var(--aa-navy)] hover:bg-[var(--aa-navy)]/80 border-0"
              type="submit"
              disabled={isLoading}
            >
              {isLoading && <Loader className="mr-2 h-4 w-4 animate-spin" />}
              Sign Up
            </Button>
          </form>
          <div className="mt-3">
            <div
              style={{ color: dSame ? "green" : "red", textAlign: "center" }}
            >
              {form.password !== "" && passwordErr}
            </div>
          </div>
          <div className="mt-4 text-center text-sm">
            Already have an account?{" "}
            <Link to="/login" className="underline">
              Sign in
            </Link>
          </div>
        </div>
      </div>
      <div
        className="lg:w-2/5 bg-cover bg-center hidden lg:block"
        style={{ backgroundImage: `url(${registerBg})` }}
        role="img"
        aria-label="Background image of a desk with a laptop and coffee"
      ></div>
    </div>
  );
}
