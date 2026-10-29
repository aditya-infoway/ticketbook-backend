import { Router, Request, Response, NextFunction, Application } from "express";

import { errorResponse } from "../../helper/index";
import * as ticketStatus from "../../controllers/superadmin/controller/ticketstatuscontroller";
import {
  ticketStatusCreateSchema,
  ticketStatusUpdateSchema,
} from "../../controllers/superadmin/validator/ticketstatusvalidator";
import { checktoken } from "../../middleware/token";

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

// ---- Ticket Status ----
routes.get("/next-number", ticketStatus.getNextTicketStatusNo);
routes.get("/list", ticketStatus.getTicketStatusList);
routes.post(
  "/create",
  validate(ticketStatusCreateSchema),
  ticketStatus.createTicketStatus,
);
routes.put(
  "/update",
  validate(ticketStatusUpdateSchema),
  ticketStatus.updateTicketStatus,
);
routes.delete("/delete", ticketStatus.deleteTicketStatus);

export default (app: Application): void => {
  app.use("/superadmin/ticket-status", routes);
};
