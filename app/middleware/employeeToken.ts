import { selectWithJoins } from "../helper/index";

export const checkEmployeeToken = async (
  token: string
) => {
  return await selectWithJoins(
    "employee",
    [],
    {
      token,
      delete: 0,
    },
    ["companyId", "employeeId", "employeeName", "email"]
  );
};