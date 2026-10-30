import { Router, Request, Response, NextFunction, Application } from "express";

import { errorResponse } from "../../helper/index";
import * as contractor from "../../controllers/superadmin/controller/contractorcontroller";

import {
  contractorCreateSchema,
  contractorUpdateSchema,
} from "../../controllers/superadmin/validator/contractorvalidator";

import { checktoken } from "../../middleware/token";
import { createUploader } from "../../middleware/upload";

const upload = createUploader(
  "contractor",
  /^\.(jpeg|jpg|png|pdf)$/,
  "Only PDF, JPG or PNG documents are allowed",
);

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

// API token header check
routes.use(checktoken);

// ---- Contractor ----
routes.get("/list", contractor.getContractorList);

routes.post(
  "/register",
  upload.array("documents", 10),
  validate(contractorCreateSchema),
  contractor.createContractor,
);

routes.put(
  "/update",
  upload.array("documents", 10),
  validate(contractorUpdateSchema),
  contractor.updateContractor,
);

routes.delete("/delete", contractor.deleteContractor);

export default (app: Application): void => {
  app.use("/superadmin/contractor", routes);
};
                