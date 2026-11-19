import Joi from "joi";

export const roleCreateSchema = Joi.object({
  // companyId token se aata hai, frontend bheje to bhi chalega
  companyId: Joi.number().integer().optional(),

  financialYearId: Joi.number().required().messages({
    "number.base": "Financial Year Id is required",
    "any.required": "Financial Year Id is required",
  }),

  departmentId: Joi.number().integer().required().messages({
    "number.base": "Department is required",
    "any.required": "Department is required",
  }),

  roleName: Joi.string().trim().max(150).required().messages({
    "string.empty": "Role name is required",
    "any.required": "Role name is required",
  }),

  status: Joi.string().valid("Active", "Inactive").optional(),

  createdBy: Joi.alternatives().try(Joi.number(), Joi.string()).allow(null, ""),

  createdType: Joi.string().allow(null, ""),
});

// Update me financialYearId optional, roleId required
export const roleUpdateSchema = roleCreateSchema
  .fork(["financialYearId"], (schema) => schema.optional())
  .keys({
    roleId: Joi.number().integer().required().messages({
      "number.base": "Role id is required",
      "any.required": "Role id is required",
    }),
  });
