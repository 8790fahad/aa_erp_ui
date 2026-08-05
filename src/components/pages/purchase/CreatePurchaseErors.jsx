// import validator  from "validator";

const validate = values =>{
    const errors = {}
    
    // if(validator.isEmpty(values.name)){
    // }
    //     else if(!validator.isNumeric(values.name) && !validator.isLength(values.name,5,25)){
    //         errors.name = 'Invalid supplier name'
    //     }
    
    // if(!validator.isEmpty(values.phone)){
    //     if(!validator.isMobilePhone(values.phone) && !validator.isLength(values.phone,11,14)){
    //         errors.phone = 'Enter a valid phone number'
    //     }
    // }
    // if(validator.isEmpty(values.address)){
    //     errors.address = 'Enter a supplier\'s address'
    // }
    // else if(!validator.isNumeric(values.address) && !validator.isLength(values.address,5,256)){
    //     errors.address = 'Enter a valid address'
    // }
    // console.log('error')
    return errors;
}
export default validate;