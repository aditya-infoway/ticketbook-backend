import { selectWithJoins } from "./index";
import { getFinancialYearById } from "./financialYear";

export interface GenerateVoucherNoParams {
  companyId: number;
  financialYearId: number | null | undefined;
  tableName: string;
  idColumn?: string;
  prefixFor?: string; // companyprefix.prefixFor se match hoga, e.g. "LEAD", "PURCHASE"
  tag?: string;
  extraWhere?: Record<string, unknown>;
  padLength?: number;
  numberColumn?: string; // defaults to `${tableName}No`
}

export interface GenerateVoucherNoResult {
  voucherNo: string;
  billNo: string; // voucherNo ka hi alias, backward-compatible
  prefixUsed: string; // blank ho sakta hai agar company ne prefix save nahi kiya
  financialYearId: number;
  fyLabel: string;
}

// 👇 companyprefix table se company ka prefix nikalta hai.
// Agar company ne is prefixFor ke liye prefix save nahi kiya,
// to blank ("") return hoga — koi fixed/fallback prefix nahi.
const getCompanyPrefix = async (
  companyId: number,
  prefixFor?: string,
): Promise<string> => {
  if (!prefixFor) return "";

  const rows: any[] = await selectWithJoins(
    "companyprefix",
    [],
    { companyId, prefixFor, delete: 0 },
    ["prefix"],
  );

  return rows.length > 0 && rows[0].prefix ? String(rows[0].prefix) : "";
};

export const generateVoucherNo = async ({
  companyId,
  financialYearId,
  tableName,
  idColumn = "id",
  prefixFor,
  tag = "",
  extraWhere = {},
  padLength = 3,
  numberColumn,
}: GenerateVoucherNoParams): Promise<GenerateVoucherNoResult> => {
  if (!financialYearId) {
    throw new Error("Financial Year not found in session.");
  }

  const fy = await getFinancialYearById(financialYearId, companyId);
  if (!fy) {
    throw new Error("Invalid or inactive Financial Year for this company.");
  }

  // 👇 sirf database wala prefix — kuch save nahi to blank
  const prefix = await getCompanyPrefix(companyId, prefixFor);

  // NOTE: intentionally NOT filtering by delete: 0 here.
  // Numbering must stay sequential and never reuse a number, even after
  // a record is deleted — otherwise deleting all rows resets the count
  // back to 0 and the next voucher number restarts from 001.
  const whereClause = {
    companyId,
    financialYearId: fy.financialYearId,
    ...extraWhere,
  };
  const numberCol = numberColumn || `${tableName}No`;

  const existingRows: any[] = await selectWithJoins(
    tableName,
    [],
    whereClause,
    [idColumn, numberCol],
  );

  let maxSeq = 0;

  for (const row of existingRows) {
    const possibleNo = row[numberCol] || "";

    if (typeof possibleNo === "string" && possibleNo.includes("/")) {
      const lastPart = possibleNo.split("/").pop();
      const num = parseInt(lastPart || "0", 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  }

  const nextSeq = maxSeq + 1;
  const seqPadded = String(nextSeq).padStart(padLength, "0");
  // 👇 blank prefix ya blank tag ki wajah se voucherNo me khaali "//" na aaye,
  // isliye empty parts ko filter kar diya
  const parts = [prefix, tag, fy.fyLabel, seqPadded].filter(
    (p) => p !== "" && p != null,
  );

  const voucherNo = parts.join("/");

  return {
    voucherNo,
    billNo: voucherNo,
    prefixUsed: prefix,
    financialYearId: fy.financialYearId,
    fyLabel: fy.fyLabel,
  };
};
