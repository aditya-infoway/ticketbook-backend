import { Application } from "express";

import authRoutes from "./auth.routes";
import employeeProfileRoutes from "./employeeprofile.route";

export default (app: Application): void => {
  authRoutes(app);
  employeeProfileRoutes(app);
};