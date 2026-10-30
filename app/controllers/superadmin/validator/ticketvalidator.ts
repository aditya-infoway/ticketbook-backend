import Joi from "joi";

// Employee: ticket create (multipart/form-data, isliye ids string me aati hain;
// Joi unhe number me convert kar deta hai jab validate ka `value` use karo)
export const ticketCreateSchema = Joi.object({
  departmentId: Joi.number().integer().positive().required().messages({
    "number.base": "Department is required",
    "number.positive": "Department is required",
    "any.required": "Department is required",
  }),
  categoryId: Joi.number().integer().positive().required().messages({
    "number.base": "Category is required",
    "number.positive": "Category is required",
    "any.required": "Category is required",
  }),
  subject: Joi.string().trim().min(3).max(200).required().messages({
    "string.empty": "Subject is required",
    "string.min": "Subject must be at least 3 characters",
    "string.max": "Subject must be 200 characters or less",
    "any.required": "Subject is required",
  }),
  issueDescription: Joi.string().trim().min(5).max(2000).required().messages({
    "string.empty": "Description is required",
    "string.min": "Description must be at least 5 characters",
    "string.max": "Description must be 2000 characters or less",
    "any.required": "Description is required",
  }),
});

// Employee: ticket update (fields same hain, attachment multer se aata hai)
export const ticketUpdateSchema = ticketCreateSchema;

// Branch / Superadmin: status update
export const ticketStatusUpdateSchema = Joi.object({
  ticketStatusId: Joi.number().integer().positive().required().messages({
    "number.base": "Status is required",
    "number.positive": "Status is required",
    "any.required": "Status is required",
  }),
});