import Joi from "joi";

const optionalId = Joi.alternatives()
  .try(Joi.number().integer(), Joi.string().trim().allow(""))
  .allow(null)
  .optional();

export const resolverTeamCreateSchema = Joi.object({
  financialYearId: Joi.alternatives()
    .try(Joi.number().integer(), Joi.string().trim())
    .optional(),

  teamName: Joi.string().trim().max(150).required().messages({
    "string.empty": "Team name is required",
    "any.required": "Team name is required",
    "string.max": "Team name must be at most 150 characters",
  }),
  teamDescription: Joi.string().trim().max(500).allow("", null).messages({
    "string.max": "Description must be at most 500 characters",
  }),

  departmentId: Joi.alternatives()
    .try(Joi.number().integer(), Joi.string().trim())
    .required()
    .messages({
      "any.required": "Department is required",
      "alternatives.match": "Department is required",
    }),
  teamLeaderId: optionalId,

  teamMemberIds: Joi.array()
    .items(Joi.number().integer())
    .min(1)
    .required()
    .messages({
      "array.min": "At least one team member is required",
      "any.required": "At least one team member is required",
    }),

  coverageType: Joi.string().valid("All", "Specific").required().messages({
    "any.only": "Coverage type must be All or Specific",
    "any.required": "Coverage type is required",
  }),
  regionId: optionalId,
  assignedBranchIds: Joi.array().items(Joi.number().integer()).default([]),

  assignmentMethod: Joi.string().valid("Auto", "Manual").required().messages({
    "any.only": "Assignment method must be Auto or Manual",
    "any.required": "Assignment method is required",
  }),
  teamEmail: Joi.string().trim().email().max(150).allow("", null).messages({
    "string.email": "Enter a valid team email",
  }),

  status: Joi.string().valid("Active", "Inactive").required().messages({
    "any.only": "Status must be Active or Inactive",
    "any.required": "Status is required",
  }),
});

export const resolverTeamUpdateSchema = resolverTeamCreateSchema.keys({
  resolverTeamId: Joi.alternatives()
    .try(Joi.number().integer(), Joi.string().trim())
    .required()
    .messages({ "any.required": "resolverTeamId is required" }),
});
