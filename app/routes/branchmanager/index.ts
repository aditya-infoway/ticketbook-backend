import { Application } from "express";
import authRoutes from "./auth.routes";
import branchManagerProfileRoutes from "./branchmanagerprofile.route";
export default (app: Application): void => {
  authRoutes(app);
  branchManagerProfileRoutes(app);
};