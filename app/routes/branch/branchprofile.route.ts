import { Router, Request, Response, NextFunction, Application } from "express";

import { errorResponse } from "../../helper/index";
import * as profile from "../../controllers/branch/controllers/branchprofilecontroller";
import { branchProfileUpdateSchema } from "../../controllers/branch/validator/branchprofilevalidator";
import { branchAuth } from "../../middleware/branchToken"; // <- apna asli naam
import { createUploader } from "../../middleware/upload";

const photoUpload = createUploader("branch_photo");
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

routes.use(branchAuth);

routes.get("/profile", profile.getMyBranchProfile);
routes.post(
  "/profile/update",
  photoUpload.single("profilePhoto"),
  validate(branchProfileUpdateSchema),
  profile.updateMyBranchProfile,
);

export default (app: Application): void => {
  app.use("/branch", routes);
};