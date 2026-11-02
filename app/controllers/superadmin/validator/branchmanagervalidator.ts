import Joi from "joi";

const requiredId = (label: string) =>
  Joi.number()
    .integer()
    .positive()
    .required()
    .messages({
      "any.required": `${label} is required`,
      "number.base": `${label} is required`,
      "number.positive": `${label} is required`,
    });

const MOBILE = /^[6-9]\d{9}$/;

// The body arrives as multipart strings; Joi converts "3" to 3
export const branchManagerCreateSchema = Joi.object({
  financialYearId: Joi.alternatives()
    .try(Joi.number().integer(), Joi.string().trim())
    .optional(),

  name: Joi.string().trim().min(2).max(50).required().messages({
    "string.empty": "Name is required",
    "any.required": "Name is required",
    "string.min": "Name must be at least 2 characters",
    "string.max": "Name must be at most 50 characters",
  }),
  gender: Joi.string().valid("Male", "Female", "Other").allow("", null),
  status: Joi.string().valid("Active", "Inactive").required().messages({
    "any.only": "Status must be Active or Inactive",
    "any.required": "Status is required",
  }),

  mobileNumber: Joi.string().trim().pattern(MOBILE).required().messages({
    "string.empty": "Mobile number is required",
    "any.required": "Mobile number is required",
    "string.pattern.base": "Enter a valid 10-digit mobile number",
  }),
  alternateMobile: Joi.string()
    .trim()
    .pattern(MOBILE)
    .allow("", null)
    .messages({
      "string.pattern.base": "Enter a valid 10-digit alternate mobile number",
    }),
  email: Joi.string().trim().email().max(150).required().messages({
    "string.empty": "Email is required",
    "any.required": "Email is required",
    "string.email": "Enter a valid email",
  }),
  address: Joi.string().trim().max(250).allow("", null),
  city: Joi.string().trim().max(50).allow("", null),
  state: Joi.string().trim().max(50).allow("", null),
  pinCode: Joi.string()
    .trim()
    .pattern(/^\d{6}$/)
    .allow("", null)
    .messages({
      "string.pattern.base": "PIN Code must be exactly 6 digits",
    }),

  areaId: requiredId("Area"),
  branchId: requiredId("Branch"),
  reportingTo: requiredId("Reporting manager"),
  joiningDate: Joi.string()
    .trim()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .required()
    .messages({
      "string.empty": "Joining date is required",
      "any.required": "Joining date is required",
      "string.pattern.base": "Joining date must be YYYY-MM-DD",
    }),
  description: Joi.string().trim().max(500).allow("", null).messages({
    "string.max": "Description must be at most 500 characters",
  }),

  password: Joi.string().max(100).required().messages({
    "string.empty": "Password is required",
    "any.required": "Password is required",
  }),
  confirmPassword: Joi.any().valid(Joi.ref("password")).required().messages({
    "any.only": "Passwords do not match",
    "any.required": "Confirm password is required",
  }),
});

// On update the password is optional (blank = keep current).
// The match with confirmPassword is checked in the controller.
export const branchManagerUpdateSchema = branchManagerCreateSchema.keys({
  branchManagerId: requiredId("Branch manager"),
  password: Joi.string().max(100).allow("", null).optional(),
  confirmPassword: Joi.string().allow("", null).optional(),
});
