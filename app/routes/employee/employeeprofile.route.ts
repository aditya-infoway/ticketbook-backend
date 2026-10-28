import { Router, Request, Response, NextFunction, Application } from "express";

import { errorResponse } from "../../helper/index";
import * as profile from "../../controllers/employee/controller/employeeprofilecontroller";
import { employeeProfileUpdateSchema } from "../../controllers/employee/validator/employeeprofilevalidator";
import { employeeAuth } from "../../middleware/employeeToken"; // <- is middleware file ka asli naam/path
import { createUploader } from "../../middleware/upload";

const routes = Router();

const validate = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.body);
    if (error) {
      errorResponse(res, error.details.map((i: any) => i.message).join(","));
      return;
    }
    next();
  };
};

const photoUpload = createUploader("employee_photo");

routes.use(employeeAuth);

routes.get("/profile", profile.getMyProfile);
routes.post(
  "/profile/update",
  photoUpload.single("profilePhoto"),
  validate(employeeProfileUpdateSchema),
  profile.updateMyProfile,
);

export default (app: Application): void => {
  app.use("/employee", routes);
};