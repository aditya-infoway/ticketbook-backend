import Joi from "joi";

export const employeeLoginSchema = Joi.object({
  email: Joi.string().trim().email().max(150).required().messages({
    "string.email": "Enter a valid email",
    "string.empty": "Email is required",
    "any.required": "Email is required",
  }),
  // no minimum length here: login should never hint at the password policy
  password: Joi.string().max(100).required().messages({
    "string.empty": "Password is required",
    "any.required": "Password is required",
    "string.max": "Password is too long",
  }),
});
