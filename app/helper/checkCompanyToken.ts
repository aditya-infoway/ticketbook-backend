import db from "../models/index";

export interface CompanyTokenRow {
  companyId: number;
  companyName: string;
  status: number | string;
  expiryDate: Date | string | null;
  tokenDate: string | null;
}

// today's date in India time, e.g. "2026-09-24"
export const todayIST = (): string =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

export const checkCompanyToken = async (
  token: string
): Promise<CompanyTokenRow[]> => {
  const company = await db.company.findAll({
    where: { token: token, delete: 0 },
    attributes: ["companyId", "companyName", "status", "expiryDate", "tokenDate"],
    raw: true,
  });
  return company as unknown as CompanyTokenRow[];
};