import Joi from "joi";

export const login = Joi.object().keys({
  email: Joi.string().required(),
  password: Joi.string().required(),
});

export const otpVerification = Joi.object().keys({
  token: Joi.string().required(),
  otp: Joi.string().required(),
});

export const resendOtp = Joi.object().keys({
  token: Joi.string().required(),
});