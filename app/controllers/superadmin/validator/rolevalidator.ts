import Joi from "joi";

export const roleCreateSchema = Joi.object({
  // companyId token se aata hai, frontend bheje to bhi chalega
  companyId: Joi.number().integer().optional(),

  financialYearId: Joi.number().required().messages({
    "number.base": "Financial Year Id is required",
    "any.required": "Financial Year Id is required",
  }),

  roleCode: Joi.string().trim().max(50).required().messages({
    "string.empty": "Role code is required",
    "any.required": "Role code is required",
  }),

  roleName: Joi.string().trim().max(150).required().messages({
    "string.empty": "Role name is required",
    "any.required": "Role name is required",
  }),

  roleCategoryId: Joi.number().integer().required().messages({
    "number.base": "Role category is required",
    "any.required": "Role category is required",
  }),

  description: Joi.string().allow(null, "").optional(),

  defaultDataScope: Joi.string()
    .valid("own", "team", "department", "region", "branch", "all")
    .required()
    .messages({
      "any.only": "Default data scope is invalid",
      "string.empty": "Default data scope is required",
      "any.required": "Default data scope is required",
    }),

  departmentRestriction: Joi.string()
    .valid("all", "selected")
    .required()
    .messages({
      "any.only": "Department restriction is invalid",
      "any.required": "Department restriction is required",
    }),

  // "selected" par kam se kam 1 department chahiye, "all" par khali
  departmentIds: Joi.when("departmentRestriction", {
    is: "selected",
    then: Joi.array()
      .items(Joi.number().integer())
      .min(1)
      .required()
      .messages({
        "array.min": "Select at least one department",
        "any.required": "Select at least one department",
      }),
    otherwise: Joi.array().items(Joi.number().integer()).optional(),
  }),

  status: Joi.string().valid("Active", "Inactive").optional(),

  createdBy: Joi.alternatives()
    .try(Joi.number(), Joi.string())
    .allow(null, ""),

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