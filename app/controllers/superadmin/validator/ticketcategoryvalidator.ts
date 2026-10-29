import Joi from "joi";

const optionalId = Joi.alternatives()
  .try(Joi.number().integer(), Joi.string().trim().allow(""))
  .allow(null)
  .optional();

const optionalDisplayOrder = Joi.alternatives()
  .try(Joi.number().integer().min(0), Joi.string().trim().allow(""))
  .allow(null)
  .optional();

export const ticketCategoryCreateSchema = Joi.object({
  financialYearId: Joi.alternatives()
    .try(Joi.number().integer(), Joi.string().trim())
    .optional(),

  categoryCode: Joi.string()
    .trim()
    .pattern(/^[A-Za-z0-9_-]{2,30}$/)
    .required()
    .messages({
      "string.pattern.base":
        "Category code must be 2-30 characters (letters, numbers, - or _)",
      "string.empty": "Category code is required",
      "any.required": "Category code is required",
    }),
  categoryName: Joi.string().trim().max(150).required().messages({
    "string.empty": "Category name is required",
    "any.required": "Category name is required",
    "string.max": "Category name must be at most 150 characters",
  }),
  description: Joi.string().trim().max(500).allow("", null).messages({
    "string.max": "Description must be at most 500 characters",
  }),

  departmentId: Joi.alternatives()
    .try(Joi.number().integer(), Joi.string().trim())
    .required()
    .messages({
      "any.required": "Department is required",
      "alternatives.match": "Department is required",
    }),
  defaultResolverTeamId: optionalId,

  displayOrder: optionalDisplayOrder,
  status: Joi.string().valid("Active", "Inactive").required().messages({
    "any.only": "Status must be Active or Inactive",
    "any.required": "Status is required",
  }),
});

export const ticketCategoryUpdateSchema = ticketCategoryCreateSchema.keys({
  ticketCategoryId: Joi.alternatives()
    .try(Joi.number().integer(), Joi.string().trim())
    .required()
    .messages({ "any.required": "ticketCategoryId is required" }),
});
