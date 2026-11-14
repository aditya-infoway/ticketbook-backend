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

  departmentName: Joi.string().trim().max(150).required().messages({
    "string.empty": "Department name is required",
    "any.required": "Department name is required",
  }),

  status: Joi.string().valid("Active", "Inactive").optional(),

  createdBy: Joi.alternatives().try(Joi.number(), Joi.string()).allow(null, ""),

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
