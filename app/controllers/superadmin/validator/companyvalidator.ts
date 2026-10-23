import Joi from "joi";

export const companyLogin = Joi.object().keys({
  email: Joi.string().trim().email().required(),
  password: Joi.string().required(),
});