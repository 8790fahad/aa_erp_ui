import rules from "validator";

const validator = ({ email, password }) => {
  const errors = {};
  if (!email || rules.isEmpty(email)) {
    errors.email = "Email is required.";
  } else if (!rules.isEmail(email)) {
    errors.email = "Invalid Email.";
  }

  if (!password || rules.isEmpty(password)) {
    errors.password = "Password is required.";
  } else if (!rules.isLength(password, { min: 6, max: 32 })) {
    errors.password = "Password must be between 6 and 32 characters.";
  } 
  // else if (!rules.isAlphanumeric(password)) {
  //   errors.password = "Invalid password.";
  // }

  return errors;
};

export default validator;
