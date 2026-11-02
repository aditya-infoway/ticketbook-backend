import { Router, Request, Response, NextFunction, Application } from "express";

import { errorResponse } from "../../helper/index";
import * as areamanager from "../../controllers/superadmin/controller/areamanagercontroller";
import {
  areaManagerCreateSchema,
  areaManagerUpdateSchema,
} from "../../controllers/superadmin/validator/areamanagervalidator";
import { checktoken } from "../../middleware/token";
import { createUploader } from "../../middleware/upload";

// folder name must stay "areamanager": the controller deletes old photos from it
const photoUpload = createUploader("areamanager");
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
      const message = error.details.map((i: any) => i.message).join(",");
      errorResponse(res, message);
      return;
    }

    // use the converted values ("true" -> true, "3" -> 3)
    req.body = value;
    next();
  };
};

// apitoken header check
routes.use(checktoken);

// ---- Area Manager ----
routes.get("/next-number", areamanager.getNextAreaManagerNo);
routes.get("/list", areamanager.getAreaManagerList);
routes.post(
  "/create",
  uploadPhoto,
  validate(areaManagerCreateSchema),
  areamanager.createAreaManager,
);
routes.put(
  "/update",
  uploadPhoto,
  validate(areaManagerUpdateSchema),
  areamanager.updateAreaManager,
);
routes.delete("/delete", areamanager.deleteAreaManager);

export default (app: Application): void => {
  app.use("/superadmin/area-manager", routes);
};
