import { Application, Router } from "express";

import { checktoken } from "../../middleware/token";
import { panelLoginValidator } from "../../middleware/panelLoginValidator";
import { branchManagerLogin } from "../../controllers/branchmanager/controllers/branchmanagerauthcontroller";

export default (app: Application): void => {
  const routes = Router();
  routes.post("/login", checktoken, panelLoginValidator, branchManagerLogin);
  app.use("/branch-manager", routes);
};