import { Application, Router } from "express";

import { checktoken } from "../../middleware/token";
import { panelLoginValidator } from "../../middleware/panelLoginValidator";
import { areaManagerLogin } from "../..//controllers/areamanager/controllers/areamanagerauthcontroller";

export default (app: Application): void => {
  const routes = Router();
  routes.post("/login", checktoken, panelLoginValidator, areaManagerLogin);
  app.use("/area-manager", routes);
};
