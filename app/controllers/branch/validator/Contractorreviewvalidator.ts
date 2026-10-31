import Joi from "joi";

// PUT branch/contractor-review/reassign/:id
export const contractorReassignSchema = Joi.object({
  contractorId: Joi.number().integer().positive().required().messages({
    "number.base": "Contractor is required",
    "number.positive": "Contractor is required",
    "any.required": "Contractor is required",
  }),
  remarks: Joi.string().trim().min(3).max(500).required().messages({
    "string.empty": "Remarks are required",
    "string.min": "Remarks must be at least 3 characters",
    "string.max": "Remarks must be 500 characters or less",
    "any.required": "Remarks are required",
  }),
});