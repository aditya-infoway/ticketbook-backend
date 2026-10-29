import { Router, Request, Response, NextFunction, Application } from "express";

import { errorResponse } from "../../helper/index";
import * as ticketCategory from "../../controllers/superadmin/controller/ticketcategorycontroller";
import {
  ticketCategoryCreateSchema,
  ticketCategoryUpdateSchema,
} from "../../controllers/superadmin/validator/ticketcategoryvalidator";
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

// ---- Ticket Category ----
routes.get("/next-number", ticketCategory.getNextTicketCategoryNo);
routes.get("/list", ticketCategory.getTicketCategoryList);
routes.post(
  "/create",
  validate(ticketCategoryCreateSchema),
  ticketCategory.createTicketCategory,
);
routes.put(
  "/update",
  validate(ticketCategoryUpdateSchema),
  ticketCategory.updateTicketCategory,
);
routes.delete("/delete", ticketCategory.deleteTicketCategory);

export default (app: Application): void => {
  app.use("/superadmin/ticket-category", routes);
};
