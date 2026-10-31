import { Router, Request, Response, NextFunction, Application } from "express";

import { errorResponse } from "../../helper/index";
import * as ticket from "../../controllers/superadmin/controller/superadminticketcontroller";
import { ticketStatusUpdateSchema } from "../../controllers/superadmin/validator/ticketvalidator";
import { checktoken } from "../../middleware/token";

const routes = Router();

const validate = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body);

    if (error) {
      const message = error.details.map((i: any) => i.message).join(",");
      console.log("error", message);
      errorResponse(res, message);
      return;
    }

    req.body = value; // converted values (string id -> number)
    next();
  };
};

// apitoken header check (ticket-category wale routes jaisa)
routes.use(checktoken);

// ---- Superadmin Ticket Management ----
routes.get("/list", ticket.getSuperAdminTicketList);
routes.get("/form-data", ticket.getSuperAdminTicketFormData);
routes.get("/details/:id", ticket.getSuperAdminTicketDetails);
routes.put(
  "/status/:id",
  validate(ticketStatusUpdateSchema),
  ticket.updateSuperAdminTicketStatus,
);

export default (app: Application): void => {
  app.use("/superadmin/ticket", routes);
};