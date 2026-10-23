import { Application } from "express";

import masterRoutes from "./master.routes";
import companyRoutes from "./company.routes";

export default (app: Application): void => {
  masterRoutes(app);
  companyRoutes(app);
};