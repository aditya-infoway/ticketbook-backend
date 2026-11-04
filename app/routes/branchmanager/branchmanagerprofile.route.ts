import { Router, Request, Response, NextFunction, Application } from "express";

import { errorResponse } from "../../helper/index";
import * as profile from "../../controllers/branchmanager/controllers/branchmanagerprofilecontroller";
import { branchManagerProfileUpdateSchema } from "../../controllers/branchmanager/validator/branchmanagerprofilevalidator";
import { branchManagerAuth } from "../../middleware/branchManagerToken"; // <- file ka asli naam/path
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

// branchmanager create/update wala hi folder
const photoUpload = createUploader("branchmanager");

routes.use(branchManagerAuth);

routes.get("/profile", profile.getMyProfile);
routes.post(
  "/profile/update",
  photoUpload.single("profilePhoto"),
  validate(branchManagerProfileUpdateSchema),
  profile.updateMyProfile,
);

export default (app: Application): void => {
  app.use("/branch-manager", routes);
};