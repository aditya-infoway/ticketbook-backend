import { Application } from "express";

import authRoutes from "./branch.routes";
import branchProfileRoutes from "./branchprofile.route";
export default (app: Application): void => {
  authRoutes(app);
  branchProfileRoutes(app);
};
