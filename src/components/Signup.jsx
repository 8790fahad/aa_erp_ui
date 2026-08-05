/* eslint-disable no-unused-vars */
import CustomCard from "@/common/Custom/CustomCard2";
import {
  BUSINESS_TYPES,
  moduleData,
  productsModuleData,
  servicesModuleData,
  subModuleData,
} from "@/constants";
import { signup } from "@/redux/actions/auth";
import { toast } from "sonner";
import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router";
import { accessData } from "./router/MainRoutes";
import CustomButton from "@/common/Custom/CustomButton";
import NewUserForm from "./NewUserForm";
import useQuery from "@/common/Custom/Hook/useQuery";
import { ArrowLeft } from "lucide-react";
import { getSidebarByAppType, modules } from "./sidebars/sidebarModules";

const SignUp = () => {
  const query = useQuery();
  const dispatch = useDispatch();
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);

  const userType = query.get("type") || "new_admin";

  const [form, setForm] = useState({
    username: "",
    email: "",
    phone: "",
    firstname: "",
    lastname: "",
    password: "",
    confirmPassword: "",
    busName: "",
    address: "",
    branch_name: "",
    accessTo: moduleData,
    // functionality: subModuleData,
    functionalities: subModuleData,
    businessType: BUSINESS_TYPES.PRODUCTS,
  });
  // const options = useSelector((state) => state.auth);
  const [signupLoading, setSignupLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [createUserError, setCreateUserError] = useState("");
  const [multiSelections, setMultiSelections] = useState([]);

  let multipleStore = multiSelections.map((i) => i.branch_name);
  const history = useNavigate();
  const resetForm = () => {
    setForm({
      username: "",
      email: "",
      phone: "",
      firstname: "",
      lastname: "",
      password: "",
      confirmPassword: "",
      busName: "",
      address: "",
      businessType: "PRODUCTS",
    });
  };

  const goHome = () => {
    resetForm();
    setSignupLoading(false);
    // navigation.navigate('Home')
  };

  const handleSubmit = () => {
    if (form.phone === "") {
      if (form.store === "") {
        toast.error("please select store");
      } else {
        toast.error("Incomplete form");
      }
      // } else if (!dSame) {
      //   Alert.alert('Unmatch password!')
    } else {
      setSignupLoading(true);
      const error = () => setSignupLoading(false);

      let accs =
        form.businessType === "PRODUCTS"
          ? productsModuleData
          : form.businessType === "SERVICES"
          ? servicesModuleData
          : [...productsModuleData, ...servicesModuleData];
      // form.branch_name = activeBusiness.business_name;
      form.busName = activeBusiness.business_name;
      form.accessTo = [...moduleData, ...accs];
      form.store = multipleStore.toString();
      form.firstname = form.firstname.toString();
      form.lastname = form.lastname.toString();
      dispatch(
        signup(
          form,
          (resp) => {
            setSignupLoading(false);
            history("/app/admin/manage-user");
            toast.success("User created successfully");
          },
          error,
          userType
        )
      );
    }
  };

  const handleChange = ({ target }) => {
    setForm((p) => ({
      ...p,
      error: "",
      [target.name]: target.value,
    }));
  };
  const handleTypeaheadChange = (val) => {
    if (val) {
      setForm((p) => ({
        ...p,
        branch_name: val.storeName,
      }));
    }
  };

  // resetForm = () => {
  //   this.setState({
  //     fullname: '',
  //     username: '',
  //     phone: '',
  //     password: '',
  //     role: '',
  //     accessTo: [],
  //   })
  // }

  // handleSubmit = (e) => {
  //   this.setState({ loading: true })
  //   e.preventDefault()
  //   const { fullname, username, phone, password, role, accessTo } = this.state
  //   if (
  //     fullname === ''
  //     // username === '' ||
  //     // phone === '' ||
  //     // password === '' ||
  //     // role === ''
  //   ) {
  //     this.setState({ error: 'Please complete the form' })
  //   } else {
  //     const data = {
  //       fullname,
  //       username,
  //       phone,
  //       password,
  //       role,
  //       accessTo: accessTo.join(','),
  //     }
  //     let callback = () => {
  //       console.log('success')
  //       this.setState({ loading: false })
  //       toast.success('User created successfully!')
  //       this.resetForm()
  //     }
  //     let error = () => {
  //       console.log('error')
  //       this.setState({ loading: false })
  //     }
  //     _postApi(`${apiURL}/auth/sign-up`, data, callback, error)
  //     // console.log(data)
  //   }
  // }

  const handleCheckboxChange = (item) => {
    setForm((prevForm) => {
      const isChecked = prevForm.accessTo.includes(item.title);

      const newAccessTo = isChecked
        ? prevForm.accessTo.filter((access) => access !== item.title)
        : [...prevForm.accessTo, item.title];

      const subItemTitles = item.items?.map((subItem) => subItem.title) || [];

      const newFunctionalities = isChecked
        ? prevForm.functionalities.filter(
            (func) => !subItemTitles.includes(func)
          )
        : prevForm.functionalities;

      return {
        ...prevForm,
        accessTo: newAccessTo,
        functionalities: newFunctionalities,
      };
    });
  };

  const handleChildChechBoxChange = (subItem) => {
    setForm((prevForm) => {
      const isChecked = prevForm.functionalities.includes(subItem.title);

      const updatedFunctionalities = isChecked
        ? prevForm.functionalities.filter((func) => func !== subItem.title)
        : [...prevForm.functionalities, subItem.title];

      return {
        ...prevForm,
        functionalities: updatedFunctionalities,
      };
    });
  };

  // render() {
  //   const {
  //     handleChange,
  //     handleSubmit,
  //     handleCheckboxChange,
  //     state: { fullname, username, phone, password, role, accessTo, loading },
  //     props: { createUserError },
  //   } = this
  const formIsValid =
    form.phone !== "" && form.password !== "" && form.accessTo.length;

  const sidebarItems = getSidebarByAppType(activeBusiness.business_type);
  return (
    <div>
      <CustomCard back header={"Create User Account"}>
        <NewUserForm
          // fullname={fullname}
          email={form.email}
          username={form.username}
          form={form}
          phone={form.phone}
          handleTypeaheadChange={handleTypeaheadChange}
          password={form.password}
          role={form.role}
          fullname={form.fullname}
          accessTo={form.accessTo}
          handleChange={handleChange}
          handleCheckboxChange={handleCheckboxChange}
          handleChildChechBoxChange={handleChildChechBoxChange}
          userType={userType}
          multiSelections={multiSelections}
          setMultiSelections={setMultiSelections}
          accessData={sidebarItems}
          // accessData={accessData}
        />

        {createUserError !== "" ? (
          <center>
            <p style={{ color: "red" }}>{createUserError}</p>``
          </center>
        ) : null}

        <CustomButton
          disabled={!formIsValid}
          loading={signupLoading}
          type="submit"
          className="offset-md-5 col-md-2 offset-lg-5 col-lg-2"
          onClick={handleSubmit}
        >
          Create User
        </CustomButton>
      </CustomCard>
    </div>
  );
};

// function mapStateToProps({ auth }) {
//   return {
//     creatingUser: auth.creatingUser,
//     createUserError: auth.createUserError,
//   };
// }

// function mapDispatchToProps(dispatch) {
//   return {
//     createUser: (data) => dispatch(createUser(data)),
//   };
// }

export default SignUp;
