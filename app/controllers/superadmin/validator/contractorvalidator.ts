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

// Helper for array of IDs (comes as JSON string from FormData)
const idArray = (label: string) =>
  Joi.alternatives()
    .try(
      Joi.array().items(Joi.number().integer().positive()).min(1),
      Joi.string().custom((value, helpers) => {
        try {
          const parsed = JSON.parse(value);
          if (!Array.isArray(parsed) || parsed.length === 0) {
            return helpers.error("any.invalid");
          }
          const nums = parsed.map(Number);
          if (nums.some((n) => isNaN(n) || n <= 0)) {
            return helpers.error("any.invalid");
          }
          return nums;
        } catch {
          return helpers.error("any.invalid");
        }
      }),
    )
    .messages({
      "any.invalid": `At least one ${label} is required`,
      "array.min": `At least one ${label} is required`,
    });

export const contractorCreateSchema = Joi.object({
  financialYearId: Joi.alternatives()
    .try(Joi.number().integer(), Joi.string().trim())
    .optional(),

  contractorName: Joi.string().trim().max(150).required().messages({
    "string.empty": "Contractor name is required",
    "any.required": "Contractor name is required",
    "string.max": "Contractor name must be at most 150 characters",
  }),
  companyName: Joi.string().trim().max(150).allow("", null),
  mobileNumber: Joi.string()
    .trim()
    .pattern(/^[0-9]{10}$/)
    .required()
    .messages({
      "string.empty": "Mobile number is required",
      "any.required": "Mobile number is required",
      "string.pattern.base": "Enter a 10-digit mobile number",
    }),
  email: Joi.string().trim().email().max(150).allow("", null).messages({
    "string.email": "Enter a valid email",
  }),
  specialization: Joi.string().trim().max(150).allow("", null),
  address: Joi.string().trim().max(500).allow("", null).messages({
    "string.max": "Address must be at most 500 characters",
  }),

  areaId: requiredId("Area"),

  // Support both old single + new multi
  branchId: Joi.number().integer().positive().optional(),
  branchIds: idArray("Branch").optional(),

  contractorDepartmentId: Joi.number()
    .integer()
    .positive()
    .allow("", null)
    .optional(),
  status: Joi.string().valid("Active", "Inactive").required().messages({
    "any.only": "Status must be Active or Inactive",
    "any.required": "Status is required",
  }),

  password: Joi.string().min(6).max(100).required().messages({
    "string.empty": "Password is required",
    "any.required": "Password is required",
    "string.min": "Password must be at least 6 characters",
  }),
  confirmPassword: Joi.any().valid(Joi.ref("password")).required().messages({
    "any.only": "Passwords do not match",
    "any.required": "Confirm password is required",
  }),
}).or("branchId", "branchIds"); // at least one of them required

export const contractorUpdateSchema = contractorCreateSchema.keys({
  contractorId: requiredId("Contractor"),
  password: Joi.string().min(6).max(100).optional().messages({
    "string.min": "Password must be at least 6 characters",
  }),
  confirmPassword: Joi.string().allow("", null).optional(),
  existingDocuments: Joi.string().allow("").optional(),
});
