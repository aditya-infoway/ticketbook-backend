import { Application } from "express";

import authRoutes from "./auth.routes";
import employeeProfileRoutes from "./employeeprofile.route";
import ticketRoutes from "./ticket.routes";
import contractorticketRoutes from "./contractorticket.routes";

export default (app: Application): void => {
  authRoutes(app);
  employeeProfileRoutes(app);
  ticketRoutes(app);
  contractorticketRoutes(app);
};