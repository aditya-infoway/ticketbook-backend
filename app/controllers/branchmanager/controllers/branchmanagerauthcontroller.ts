import { panelLogin } from "../../../helper/panelLogin";
import { selectWithJoins } from "../../../helper/index";

const getBranch = async (user: any) => {
  const rows: any[] = await selectWithJoins(
    "branch",
    [],
    { branchId: user.branchId, companyId: user.companyId, delete: 0 },
    ["branchId", "branchName", "status"],
  );
  return rows[0];
};

// POST branch-manager/login     body: { email, password }
export const branchManagerLogin = panelLogin({
  table: "branchmanager",
  idColumn: "branchManagerId",
  role: "branchManager",
  extraColumns: ["branchId"],
  // a manager can't log in when their branch is inactive
  extraCheck: async (user) => {
    const branch = await getBranch(user);
    return !branch || branch.status !== "Active"
      ? "This branch is inactive. Please contact the administrator."
      : null;
  },
  extraResponse: async (user) => {
    const branch = await getBranch(user);
    return { branchId: user.branchId, branchName: branch?.branchName || "" };
  },
});
