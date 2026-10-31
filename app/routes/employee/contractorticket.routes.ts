import { Router, Request, Response, NextFunction, Application } from "express";
import * as contractorTicket from "../../controllers/employee/controller/contractorticketcontroller";
import { employeeAuth } from "../../middleware/employeeToken";

const routes = Router();

// Assigned tickets list
routes.get(
  "/ticket/assigned",
  employeeAuth,
  contractorTicket.getContractorAssignedTickets,
);

// Filter dropdowns
routes.get(
  "/ticket/filter-data",
  employeeAuth,
  contractorTicket.getContractorTicketFilterData,
);

routes.put("/ticket/status/:id", contractorTicket.updateContractorTicketStatus);

export default (app: Application): void => {
  app.use("/employee/contractorticket", routes);
};
