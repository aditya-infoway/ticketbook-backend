import { Router, Request, Response, NextFunction, Application } from "express";

import { errorResponse } from "../../helper/index";
import * as review from "../../controllers/branch/controllers/Branchcontractorreviewcontroller";
import { contractorReassignSchema } from "../../controllers/branch/validator/Contractorreviewvalidator";
import { branchAuth } from "../../middleware/branchToken";

const routes = Router();

const validate = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body);

    if (error) {
      errorResponse(res, error.details.map((i: any) => i.message).join(","));
      return;
    }

    req.body = value; // converted values (string id -> number)
    next();
  };
};

// branchAuth har route par alag se (ticket routes jaisa)

// Review pending list
routes.get(
  "/contractor-review/list",
  branchAuth,
  review.getContractorReviewList,
);

// Reassign dropdown (contractors)
routes.get(
  "/contractor-review/form-data",
  branchAuth,
  review.getContractorReviewFormData,
);

// Reassign   body: { contractorId, remarks }
routes.put(
  "/contractor-review/reassign/:id",
  branchAuth,
  validate(contractorReassignSchema),
  review.reassignContractorWork,
);

export default (app: Application): void => {
  app.use("/branch", routes);
};
