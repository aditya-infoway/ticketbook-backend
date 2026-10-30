import Joi from "joi";

export const contractorDepartmentCreateSchema = Joi.object({
  financialYearId: Joi.alternatives()
    .try(Joi.number().integer(), Joi.string().trim())
    .optional(),

  departmentName: Joi.string().trim().max(150).required().messages({
    "string.empty": "Department name is required",
    "any.required": "Department name is required",
    "string.max": "Department name must be at most 150 characters",
  }),
  departmentCode: Joi.string().trim().max(50).required().messages({
    "string.empty": "Department code is required",
    "any.required": "Department code is required",
    "string.max": "Department code must be at most 50 characters",
  }),
  description: Joi.string().trim().max(500).allow("", null).messages({
    "string.max": "Description must be at most 500 characters",
  }),

  status: Joi.string().valid("Active", "Inactive").required().messages({
    "any.only": "Status must be Active or Inactive",
    "any.required": "Status is required",
  }),
});

export const contractorDepartmentUpdateSchema =
  contractorDepartmentCreateSchema.keys({
    contractorDepartmentId: Joi.alternatives()
      .try(Joi.number().integer(), Joi.string().trim())
      .required()
      .messages({ "any.required": "contractorDepartmentId is required" }),
  });