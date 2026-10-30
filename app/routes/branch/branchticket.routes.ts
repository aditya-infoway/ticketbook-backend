import { Router, Request, Response, NextFunction, Application } from "express";

import { errorResponse } from "../../helper/index";
import * as ticket from "../../controllers/branch/controllers/branchticketcontroller";
import { ticketStatusUpdateSchema } from "../../controllers/branch/validator/ticketvalidator"; // <- validator ka path
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

// NOTE: yaha routes.use(branchAuth) nahi lagaya, har route par alag se lagaya hai.
// Kyunki ye router bhi "/branch" par mount hota hai, aur router-level use(branchAuth)
// us order me aane wale baaki /branch/* (jaise login) requests ko bhi rok sakta hai.

// Table list (query: departmentId, categoryId, ticketStatusId, fromDate, toDate)
routes.get("/ticket/list", branchAuth, ticket.getBranchTicketList);

// Filters + status drawer dropdowns (departments, categories, statuses)
routes.get("/ticket/form-data", branchAuth, ticket.getBranchTicketFormData);

// Status update   body: { ticketStatusId }
routes.put(
  "/ticket/status/:id",
  branchAuth,
  validate(ticketStatusUpdateSchema),
  ticket.updateBranchTicketStatus,
);

export default (app: Application): void => {
  app.use("/branch", routes);
};