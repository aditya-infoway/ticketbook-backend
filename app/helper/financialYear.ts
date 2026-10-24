import moment from "moment";
import { selectWithJoins } from "./index";

interface FinancialYearRow {
  financialYearId: number;
  startDate: Date | string;
  endDate: Date | string;
}

export interface FinancialYearInfo {
  financialYearId: number;
  fyLabel: string;
  startDate: Date | string;
  endDate: Date | string;
}

/**
 * Session/middleware se aaya hua financialYearId valid hai ya nahi
 * (companyId ka hi hai ya nahi) — validate karke poori row return karta hai.
 */
export const getFinancialYearById = async (
  financialYearId: number | null | undefined,
  companyId: number
): Promise<FinancialYearInfo | null> => {                                                                                                                                                                
  if (!financialYearId) return null;

  const rows = (await selectWithJoins(
    "financialyear",
    [],
    { financialYearId, companyId, delete: 0 },
    ["financialYearId", "startDate", "endDate"]
  )) as FinancialYearRow[];

  if (!rows.length) return null;

  const fy = rows[0];
  return {
    financialYearId: fy.financialYearId,
    fyLabel: `${moment(fy.startDate).format("YY")}-${moment(fy.endDate).format("YY")}`,
    startDate: fy.startDate,
    endDate: fy.endDate,
  };
};