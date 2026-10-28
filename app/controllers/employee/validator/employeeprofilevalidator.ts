import Joi from "joi";

const optionalString = (max: number) =>
  Joi.string().trim().max(max).allow("", null);

export const employeeProfileUpdateSchema = Joi.object({
  employeeName: Joi.string().trim().max(150).required().messages({
    "string.empty": "Employee name is required",
    "any.required": "Employee name is required",
  }),

  mobileCountryCode: optionalString(10),
  mobileNumber: Joi.string()
    .trim()
    .pattern(/^[0-9]{6,15}$/)
    .allow("", null)
    .messages({ "string.pattern.base": "Mobile number must be 6-15 digits" }),

  alternateCountryCode: optionalString(10),
  alternateContact: Joi.string()
    .trim()
    .pattern(/^[0-9]{6,15}$/)
    .allow("", null)
    .messages({ "string.pattern.base": "Alternate number must be 6-15 digits" }),

  // password change optional
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