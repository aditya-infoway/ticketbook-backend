import Joi from "joi";

export const areaManagerProfileUpdateSchema = Joi.object({
  name: Joi.string().trim().max(50).required().messages({
    "string.empty": "Name is required",
    "any.required": "Name is required",
  }),
  mobileNumber: Joi.string()
    .trim()
    .pattern(/^[6-9]\d{9}$/)
    .required()
    .messages({ "string.pattern.base": "Invalid 10-digit number" }),
  alternateMobile: Joi.string()
    .trim()
    .pattern(/^[6-9]\d{9}$/)
    .allow("", null)
    .messages({ "string.pattern.base": "Invalid 10-digit number" }),

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