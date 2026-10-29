import Joi from "joi";

const optionalString = (max: number) =>
  Joi.string().trim().max(max).allow("", null);

const optionalId = Joi.alternatives()
  .try(Joi.number().integer(), Joi.string().trim().allow(""))
  .allow(null)
  .optional();

const optionalPhone = Joi.string()
  .trim()
  .pattern(/^[0-9]{6,15}$/)
  .allow("", null)
  .messages({
    "string.pattern.base": "Enter a valid phone number (digits only)",
  });

export const employeeCreateSchema = Joi.object({
  financialYearId: Joi.alternatives()
    .try(Joi.number().integer(), Joi.string().trim())
    .optional(),

  employeeCode: Joi.string()
    .trim()
    .pattern(/^[A-Za-z0-9_-]{2,30}$/)
    .required()
    .messages({
      "string.pattern.base":
        "Employee code must be 2-30 characters (letters, numbers, - or _)",
      "string.empty": "Employee code is required",
      "any.required": "Employee code is required",
    }),
  employeeName: Joi.string().trim().max(150).required().messages({
    "string.empty": "Employee name is required",
    "any.required": "Employee name is required",
  }),
  profilePhoto: optionalString(500),

  officialEmail: Joi.string().trim().email().max(150).allow("", null).messages({
    "string.email": "Enter a valid official email",
  }),
  branchId: Joi.alternatives()
    .try(Joi.number().integer(), Joi.string().trim().min(1))
    .required()
    .messages({
      "any.required": "Branch is required",
      "alternatives.match": "Branch is required",
    }),
  mobileCountryCode: optionalString(10),
  mobileNumber: optionalPhone,
  alternateCountryCode: optionalString(10),
  alternateContact: optionalPhone,

  employeeTypeId: optionalId,
  designationId: optionalId,

  dateOfJoining: optionalString(20),
  employmentStatus: Joi.string()
    .valid("Active", "Inactive")
    .required()
    .messages({
      "any.only": "Employment status must be Active or Inactive",
      "any.required": "Employment status is required",
    }),
  employmentEndDate: optionalString(20),
  remarks: optionalString(500),

  roleCategoryId: optionalId,
  roleId: optionalId,

  // array of department ids (or a JSON string of that array if sent as form-data)
  additionalDepartments: Joi.alternatives()
    .try(Joi.array().items(Joi.number().integer()), Joi.string().allow(""))
    .allow(null)
    .optional(),

  // Password is optional; when given it needs a matching confirm password
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

export const employeeUpdateSchema = employeeCreateSchema.keys({
  employeeId: Joi.alternatives()
    .try(Joi.number().integer(), Joi.string().trim())
    .required()
    .messages({ "any.required": "employeeId is required" }),
});
