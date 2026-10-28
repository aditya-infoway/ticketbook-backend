import Joi from "joi";

export const roleCategoryCreateSchema = Joi.object({
  // companyId token se aata hai, frontend bheje to bhi chalega
  companyId: Joi.number().integer().optional(),

  financialYearId: Joi.number().required().messages({
    "number.base": "Financial Year Id is required",
    "any.required": "Financial Year Id is required",
  }),

  roleCategoryCode: Joi.string().trim().max(50).required().messages({
    "string.empty": "Role category code is required",
    "any.required": "Role category code is required",
  }),

  roleCategoryName: Joi.string().trim().max(150).required().messages({
    "string.empty": "Role category name is required",
    "any.required": "Role category name is required",
  }),

  description: Joi.string().allow(null, "").optional(),

  displayOrder: Joi.number().integer().min(0).allow(null, "").optional(),

  status: Joi.string().valid("Active", "Inactive").optional(),

  createdBy: Joi.alternatives()
    .try(Joi.number(), Joi.string())
    .allow(null, ""),

  createdType: Joi.string().allow(null, ""),
});

// Update me financialYearId optional, roleCategoryId required
export const roleCategoryUpdateSchema = roleCategoryCreateSchema
  .fork(["financialYearId"], (schema) => schema.optional())
  .keys({
    roleCategoryId: Joi.number().integer().required().messages({
      "number.base": "Role category id is required",
      "any.required": "Role category id is required",
    }),
  });