import Joi from "joi";

const optionalString = (max: number) =>
  Joi.string().trim().max(max).allow("", null);

export const branchCreateSchema = Joi.object({
  financialYearId: Joi.alternatives()
    .try(Joi.number().integer(), Joi.string().trim())
    .optional(),

  branchCode: Joi.string()
    .trim()
    .pattern(/^[A-Za-z0-9_-]{2,30}$/)
    .required()
    .messages({
      "string.pattern.base":
        "Branch code must be 2-30 characters (letters, numbers, - or _)",
      "string.empty": "Branch code is required",
      "any.required": "Branch code is required",
    }),
  branchName: Joi.string().trim().max(150).required().messages({
    "string.empty": "Branch name is required",
    "any.required": "Branch name is required",
  }),

  regionId: Joi.alternatives()
    .try(Joi.number().integer(), Joi.string().trim().allow(""))
    .allow(null)
    .optional(),

  country: Joi.string().trim().max(100).required().messages({
    "string.empty": "Country is required",
    "any.required": "Country is required",
  }),
  state: Joi.string().trim().max(100).required().messages({
    "string.empty": "State is required",
    "any.required": "State is required",
  }),
  city: Joi.string().trim().max(100).required().messages({
    "string.empty": "City is required",
    "any.required": "City is required",
  }),
  fullAddress: Joi.string().trim().max(500).required().messages({
    "string.empty": "Full address is required",
    "any.required": "Full address is required",
  }),
  pinCode: optionalString(20),

  contactNumber: Joi.string()
    .trim()
    .pattern(/^[0-9]{10}$/)
    .required()
    .messages({
      "string.pattern.base": "Contact number must be 10 digits",
      "string.empty": "Contact number is required",
      "any.required": "Contact number is required",
    }),
  phoneNumber: optionalString(20),

  branchEmail: Joi.string().trim().email().max(150).required().messages({
    "string.email": "Enter a valid branch email",
    "string.empty": "Branch email is required",
    "any.required": "Branch email is required",
  }),

  password: Joi.string().min(6).max(50).required().messages({
    "string.min": "Password must be at least 6 characters",
    "string.empty": "Password is required",
    "any.required": "Password is required",
  }),
  confirmPassword: Joi.any().valid(Joi.ref("password")).required().messages({
    "any.only": "Password and confirm password do not match",
    "any.required": "Confirm password is required",
  }),

 branchManagerId: Joi.alternatives()
  .try(Joi.number().integer(), Joi.string().trim().allow(""))
  .allow(null)
  .optional(),
areaManagerId: Joi.alternatives()
  .try(Joi.number().integer(), Joi.string().trim().allow(""))
  .allow(null)
  .optional(),
  openingDate: optionalString(20),
  workingHours: optionalString(50),

  status: Joi.string().valid("Active", "Inactive").required().messages({
    "any.only": "Status must be Active or Inactive",
    "any.required": "Status is required",
  }),
});

// Update: password is optional (blank = keep the old password)
export const branchUpdateSchema = branchCreateSchema.keys({
  branchId: Joi.alternatives()
    .try(Joi.number().integer(), Joi.string().trim())
    .required()
    .messages({ "any.required": "branchId is required" }),

  password: Joi.string().min(6).max(50).allow("", null).messages({
    "string.min": "Password must be at least 6 characters",
  }),
  confirmPassword: Joi.when("password", {
    is: Joi.string().min(1).required(),
    then: Joi.any().valid(Joi.ref("password")).required().messages({
      "any.only": "Password and confirm password do not match",
      "any.required": "Confirm password is required",
    }),
    otherwise: Joi.any().allow("", null),
  }),
});
