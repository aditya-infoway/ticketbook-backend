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

// Body arrives as multipart strings; Joi converts "3" to 3
export const ticketCreateSchema = Joi.object({
  departmentId: requiredId("Department"),
  categoryId: requiredId("Category"),
  subject: Joi.string().trim().max(200).required().messages({
    "string.empty": "Subject is required",
    "any.required": "Subject is required",
    "string.max": "Subject must be at most 200 characters",
  }),
  issueDescription: Joi.string().trim().max(2000).required().messages({
    "string.empty": "Description is required",
    "any.required": "Description is required",
    "string.max": "Description must be at most 2000 characters",
  }),
});

export const ticketUpdateSchema = ticketCreateSchema.keys({
  ticketId: requiredId("Ticket"),
    ticketStatusId: Joi.number().integer().positive().optional().messages({
    "number.base": "Invalid status",
  }),
});
