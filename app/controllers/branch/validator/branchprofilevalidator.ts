import Joi from "joi";

const optionalString = (max: number) =>
  Joi.string().trim().max(max).allow("", null);

export const branchProfileUpdateSchema = Joi.object({
  contactNumber: Joi.string().trim().pattern(/^[0-9]{10}$/).required().messages({
    "string.pattern.base": "Contact number must be 10 digits",
    "string.empty": "Contact number is required",
    "any.required": "Contact number is required",
  }),
  phoneNumber: optionalString(20),
  fullAddress: Joi.string().trim().max(500).required().messages({
    "string.empty": "Full address is required",
    "any.required": "Full address is required",
  }),
  pinCode: optionalString(20),

  currentPassword: Joi.string().allow("", null),
  newPassword: Joi.string().min(6).max(50).allow("", null).messages({
    "string.min": "New password must be at least 6 characters",
  }),
  confirmPassword: Joi.when("newPassword", {
    is: Joi.string().min(1).required(),
    then: Joi.any().valid(Joi.ref("newPassword")).required().messages({
      "any.only": "Password and confirm password do not match",
      "any.required": "Confirm password is required",
    }),
    otherwise: Joi.any().allow("", null),
  }),
});