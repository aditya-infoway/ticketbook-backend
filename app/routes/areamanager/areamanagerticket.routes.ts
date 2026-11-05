import { Application, Router } from "express";

import { areaManagerAuth } from "../../middleware/areaManagerToken";
import * as branch from "../../controllers/areamanager/controllers/areamanagerbranchcontroller";
import * as ticket from "../../controllers/areamanager/controllers/areamanagerticketcontroller"; // 👈 Import

const routes = Router();

// Existing Branch Routes
routes.get("/branch/list", areaManagerAuth, branch.getAreaManagerBranchList);
routes.get(
  "/branch/form-data",
  areaManagerAuth,
  branch.getAreaManagerBranchFormData,
);
routes.get("/branch/:id", areaManagerAuth, branch.getAreaManagerBranchDetail);

// 👇 New Ticket Routes
routes.get("/ticket/list", areaManagerAuth, ticket.getAreaManagerTicketList);
routes.get(
  "/ticket/form-data",
  areaManagerAuth,
  ticket.getAreaManagerTicketFormData,
);
routes.get("/ticket/:id", areaManagerAuth, ticket.getAreaManagerTicketDetail);

export default (app: Application): void => {
  app.use("/area-manager", routes);
};
