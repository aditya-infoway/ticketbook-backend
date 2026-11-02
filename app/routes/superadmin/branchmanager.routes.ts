import { Router, Request, Response, NextFunction, Application } from "express";

import { errorResponse } from "../../helper/index";
import * as branchmanager from "../../controllers/superadmin/controller/branchmanagercontroller";
import {
  branchManagerCreateSchema,
  branchManagerUpdateSchema,
} from "../../controllers/superadmin/validator/branchmanagervalidator";
import { checktoken } from "../../middleware/token";
import { createUploader } from "../../middleware/upload";

// folder name must stay "branchmanager": the controller deletes old photos from it
const photoUpload = createUploader("branchmanager");
const routes = Router();

// multer errors become normal { success: false } responses
const uploadPhoto = (req: Request, res: Response, next: NextFunction) => {
  photoUpload.single("profilePhoto")(req, res, (err: any) => {
    if (err) {
      errorResponse(
        res,
        err.code === "LIMIT_FILE_SIZE"
          ? "Profile photo must be 5MB or smaller."
          : err.message || "Invalid profile photo.",
      );
      return;
    }
    next();
  });
};

const validate = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: true,
      stripUnknown: true,
    });

    if (error) {
      errorResponse(res, error.details.map((i: any) => i.message).join(","));
      return;
    }

    req.body = value;
    next();
  };
};

// apitoken header check
routes.use(checktoken);

// ---- Branch Manager ----
routes.get("/next-number", branchmanager.getNextBranchManagerNo);
routes.get("/list", branchmanager.getBranchManagerList);
routes.post(
  "/create",
  uploadPhoto,
  validate(branchManagerCreateSchema),
  branchmanager.createBranchManager,
);
routes.put(
  "/update",
  uploadPhoto,
  validate(branchManagerUpdateSchema),
  branchmanager.updateBranchManager,
);
routes.delete("/delete", branchmanager.deleteBranchManager);

export default (app: Application): void => {
  app.use("/superadmin/branch-manager", routes);
};
