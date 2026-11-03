import { panelLogin } from "../../../helper/panelLogin";

// POST area-manager/login     body: { email, password }
export const areaManagerLogin = panelLogin({
  table: "areamanager",
  idColumn: "areaManagerId",
  role: "areaManager",
});