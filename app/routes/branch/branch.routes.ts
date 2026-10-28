import { Application, Router } from "express";
import { branchLogin } from "../../controllers/branch/controllers/branchauthcontroller";
import { branchLoginValidator } from "../../controllers/branch/validator/branchauthvalidator";

export default (app: Application): void => {
  const router = Router();
  router.post("/login", branchLoginValidator, branchLogin);
  app.use("/branch", router);
};