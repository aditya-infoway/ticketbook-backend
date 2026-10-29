import Joi from "joi";

const optionalDisplayOrder = Joi.alternatives()
  .try(Joi.number().integer().min(0), Joi.string().trim().allow(""))
  .allow(null)
  .optional();

export const ticketStatusCreateSchema = Joi.object({
  financialYearId: Joi.alternatives() // ← ADD THIS
    .try(Joi.number().integer(), Joi.string().trim())
    .optional(),
  statusCode: Joi.string()
    .trim()
    .pattern(/^[A-Za-z0-9_-]{2,30}$/)
    .required()
    .messages({
      "string.pattern.base":
        "Status code must be 2-30 characters (letters, numbers, - or _)",
      "string.empty": "Status code is required",
      "any.required": "Status code is required",
    }),
  statusName: Joi.string().trim().max(150).required().messages({
    "string.empty": "Status name is required",
    "any.required": "Status name is required",
    "string.max": "Status name must be at most 150 characters",
  }),
  description: Joi.string().trim().max(500).allow("", null).messages({
    "string.max": "Description must be at most 500 characters",
  }),

  displayOrder: optionalDisplayOrder,
  status: Joi.string().valid("Active", "Inactive").required().messages({
    "any.only": "Status must be Active or Inactive",
    "any.required": "Status is required",
  }),
});

export const ticketStatusUpdateSchema = ticketStatusCreateSchema.keys({
  ticketStatusId: Joi.alternatives()
    .try(Joi.number().integer(), Joi.string().trim())
    .required()
    .messages({ "any.required": "ticketStatusId is required" }),
});
