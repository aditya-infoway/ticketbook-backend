import { Router, Request, Response, NextFunction, Application } from "express";

import { errorResponse } from "../../helper/index";
import * as branch from "../../controllers/superadmin/controller/branchcontroller";
import {
  branchCreateSchema,
  branchUpdateSchema,
} from "../../controllers/superadmin/validator/branchvalidator";
import { checktoken } from "../../middleware/token";
import { createUploader } from "../../middleware/upload";

const photoUpload = createUploader("branch_photo");
const routes = Router();

const validate = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.body);

    if (error) {
      const message = error.details.map((i: any) => i.message).join(",");
      console.log("error", message);
      errorResponse(res, message);
      return;
    }

    next();
  };
};

// apitoken header check
routes.use(checktoken);

// ---- Branch ----
routes.get("/next-number", branch.getNextBranchNo);
routes.get("/list", branch.getBranchList);
routes.post(
  "/create",
  photoUpload.single("profilePhoto"),
  validate(branchCreateSchema),
  branch.createBranch,
);
routes.put(
  "/update",
  photoUpload.single("profilePhoto"),
  validate(branchUpdateSchema),
  branch.updateBranch,
);
routes.delete("/delete", branch.deleteBranch);

export default (app: Application): void => {
  app.use("/superadmin/branch", routes);
};