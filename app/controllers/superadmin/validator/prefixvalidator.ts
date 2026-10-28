import Joi from "joi";

export const prefixCreateSchema = Joi.object({
  prefixFor: Joi.string()
    .trim()
    .uppercase()
    .required()
    .messages({
      "string.empty": "Prefix For is required",
      "any.required": "Prefix For is required",
    }),

  prefix: Joi.string()
    .trim()
    .uppercase()
    .max(20)
    .required()
    .messages({
      "string.empty": "Prefix is required",
      "any.required": "Prefix is required",
      "string.max": "Prefix cannot exceed 20 characters",
    }),
});

export const prefixUpdateSchema = Joi.object({
  prefixId: Joi.number()
    .required()
    .messages({
      "any.required": "prefixId is required",
      "number.base": "prefixId must be a number",
    }),

  prefixFor: Joi.string()
    .trim()
    .uppercase()
    .required()
    .messages({
      "string.empty": "Prefix For is required",
      "any.required": "Prefix For is required",
    }),

  prefix: Joi.string()
    .trim()
    .uppercase()
    .max(20)
    .required()
    .messages({
      "string.empty": "Prefix is required",
      "any.required": "Prefix is required",
      "string.max": "Prefix cannot exceed 20 characters",
    }),
});