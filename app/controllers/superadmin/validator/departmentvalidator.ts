import Joi from "joi";

export const departmentCreateSchema = Joi.object({
  companyId: Joi.number().integer().required().messages({
    "number.base": "Company Id is required",
    "any.required": "Company Id is required",
  }),

  financialYearId: Joi.number().required().messages({
    "number.base": "Financial Year Id is required",
    "any.required": "Financial Year Id is required",
  }),

  departmentCode: Joi.string().trim().max(50).required().messages({
    "string.empty": "Department code is required",
    "any.required": "Department code is required",
  }),

  departmentName: Joi.string().trim().max(150).required().messages({
    "string.empty": "Department name is required",
    "any.required": "Department name is required",
  }),

  description: Joi.string().allow(null, "").optional(),

  departmentTypeId: Joi.number().integer().required().messages({
    "number.base": "Department type is required",
    "any.required": "Department type is required",
  }),

  parentDepartmentId: Joi.number()
    .integer()
    .allow(null, "")
    .optional(),

  scope: Joi.string().trim().required().messages({
    "string.empty": "Department scope is required",
    "any.required": "Department scope is required",
  }),

  status: Joi.string()
    .valid("Active", "Inactive")
    .optional(),

  displayOrder: Joi.number()
    .integer()
    .min(0)
    .allow(null, "")
    .optional(),

  createdBy: Joi.alternatives()
    .try(Joi.number(), Joi.string())
    .allow(null, ""),

  createdType: Joi.string().allow(null, ""),
});

// Update me financialYearId optional hai, departmentId required
export const departmentUpdateSchema = departmentCreateSchema
  .fork(["financialYearId"], (schema) => schema.optional())
  .keys({
    departmentId: Joi.number().integer().required().messages({
      "number.base": "Department id is required",
      "any.required": "Department id is required",
    }),
  });