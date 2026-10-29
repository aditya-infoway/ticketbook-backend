import { Request, Response } from "express";
import fs from "fs";

import {
  errorResponse,
  successResponse,
  requiredmessage,
  saveModel,
  selectWithJoins,
} from "../../../helper/index";
import { getFinancialYearById } from "../../../helper/financialYear";
import { generateVoucherNo } from "../../../helper/billNoGenerator";

// ---- Helpers ----
const IST = "Asia/Kolkata";
const istDate = (d: Date): string =>
  d.toLocaleDateString("en-CA", { timeZone: IST }); // YYYY-MM-DD
const istDateTime = (value: unknown): string => {
  const d = new Date(value as any);
  const time = d.toLocaleTimeString("en-US", {
    timeZone: IST,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  return `${istDate(d)} ${time}`;
};

const removeUploaded = (file?: Express.Multer.File) => {
  if (file?.path) fs.unlink(file.path, () => {});
};

// employeeAuth has already set req.employeeId and req.companyId
const getEmployeeContext = async (req: Request) => {
  const employeeId = Number((req as any).employeeId);
  const companyId = Number((req as any).companyId);

  const rows: any[] = await selectWithJoins(
    "employee",
    [],
    { employeeId, companyId, delete: 0 },
    [
      "employeeId",
      "employeeCode",
      "employeeName",
      "mobileCountryCode",
      "mobileNumber",
    ],
  );

  if (!rows.length) return null;

  const e = rows[0];

  return {
    employeeId,
    companyId,
    employeeName: e.employeeName as string,
    employeeCode: e.employeeCode as string,
    branchId: null, // no branch on employee table
    branchName: "",
    contactNumber:
      `${e.mobileCountryCode || ""} ${e.mobileNumber || ""}`.trim(),
  };
};

// Employee login has no select-company step, so use the company's latest FY.
const getCurrentFinancialYear = async (companyId: number): Promise<any> => {
  const rows: any[] = await selectWithJoins(
    "financialyear",
    [],
    { companyId },
    ["financialYearId"],
    [["financialYearId", "DESC"]],
  );
  if (!rows.length) return null;
  return getFinancialYearById(rows[0].financialYearId, companyId);
};

// Unique Ticket No (prefix + FY + running number), retry on collision
const generateUniqueTicketNo = async (
  companyId: number,
  financialYearId: number,
): Promise<string | null> => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { billNo } = await generateVoucherNo({
      companyId,
      financialYearId,
      tableName: "ticket", // number column defaults to "ticketNo"
      idColumn: "ticketId",
      prefixFor: "TICKET",
    });

    const existing: any[] = await selectWithJoins(
      "ticket",
      [],
      { companyId, financialYearId, ticketNo: billNo, delete: 0 },
      ["ticketId"],
    );
    if (existing.length === 0) return billNo;

    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return null;
};

// Ticket Code = company prefix + running number (TKT-01, TKT-02 ... TKT-10).
// Not filtered by delete, so a deleted ticket's number is never reused.
const generateUniqueTicketCode = async (
  companyId: number,
): Promise<string | null> => {
  const prefixRows: any[] = await selectWithJoins(
    "companyprefix",
    [],
    { companyId, prefixFor: "TICKET", delete: 0 },
    ["prefix"],
  );
  const prefix = prefixRows[0]?.prefix ? String(prefixRows[0].prefix) : "";

  for (let attempt = 0; attempt < 5; attempt++) {
    const rows: any[] = await selectWithJoins("ticket", [], { companyId }, [
      "ticketId",
      "ticketCode",
    ]);

    let maxSeq = 0;
    for (const row of rows) {
      const m = String(row.ticketCode || "").match(/(\d+)$/);
      if (m) maxSeq = Math.max(maxSeq, parseInt(m[1], 10));
    }

    const seq = String(maxSeq + 1).padStart(2, "0");
    const code = prefix ? `${prefix}-${seq}` : seq;

    const existing: any[] = await selectWithJoins(
      "ticket",
      [],
      { companyId, ticketCode: code },
      ["ticketId"],
    );
    if (existing.length === 0) return code;

    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return null;
};

// ---- Next Ticket No (drawer preview) ----
export const getNextTicketNo = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const companyId = Number((req as any).companyId);
    const fy: any = await getCurrentFinancialYear(companyId);
    if (!fy) return errorResponse(res, "Financial Year not found.");

    const ticketNo = await generateUniqueTicketNo(
      companyId,
      fy.financialYearId,
    );
    const ticketCode = await generateUniqueTicketCode(companyId);
    if (!ticketNo || !ticketCode) {
      return errorResponse(
        res,
        "Could not generate a unique Ticket No. Please try again.",
      );
    }
    return successResponse(
      res,
      { ticketNo, ticketCode },
      "Ticket No generated successfully",
    );
  } catch (error) {
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Form data: employee details + dropdowns ----
export const getTicketFormData = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const ctx = await getEmployeeContext(req);
    if (!ctx) return requiredmessage(res, "Employee not found.");

    const [depts, cats, statuses]: any[][] = await Promise.all([
      selectWithJoins(
        "department",
        [],
        { companyId: ctx.companyId, delete: 0, status: "Active" },
        ["departmentId", "departmentName"],
        [["departmentName", "ASC"]],
      ),
      selectWithJoins(
        "ticketcategory",
        [],
        { companyId: ctx.companyId, delete: 0, status: "Active" },
        ["ticketCategoryId", "categoryName", "departmentId", "displayOrder"],
        [["categoryName", "ASC"]],
      ),
      selectWithJoins(
        "ticketstatus",
        [],
        { companyId: ctx.companyId, delete: 0 },
        ["ticketStatusId", "statusName", "displayOrder"],
        [["displayOrder", "ASC"]],
      ),
    ]);

    return successResponse(
      res,
      {
        employee: {
          employeeName: ctx.employeeName,
          employeeCode: ctx.employeeCode,
          branchName: ctx.branchName,
          contactNumber: ctx.contactNumber,
        },
        departments: depts.map((d) => ({
          id: String(d.departmentId),
          label: d.departmentName,
        })),
        categories: cats.map((c) => ({
          id: String(c.ticketCategoryId),
          label: c.categoryName,
          departmentId: String(c.departmentId),
        })),
        statuses: statuses.map((s) => ({
          id: String(s.ticketStatusId),
          label: s.statusName,
        })),
      },
      "Form data fetched successfully.",
    );
  } catch (error) {
    console.error("getTicketFormData error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Create Ticket (multipart: optional "attachment" file) ----
export const createTicket = async (
  req: Request,
  res: Response,
): Promise<any> => {
  const reject = (message: string) => {
    removeUploaded(req.file);
    return errorResponse(res, message);
  };

  try {
    const ctx = await getEmployeeContext(req);
    if (!ctx) {
      removeUploaded(req.file);
      return requiredmessage(res, "Employee not found.");
    }

    // req.body is already validated + cleaned by the route middleware
    const value = req.body;

    const { companyId } = ctx;

    // Department
    const deptRows: any[] = await selectWithJoins(
      "department",
      [],
      { departmentId: value.departmentId, companyId, delete: 0 },
      ["departmentId", "status"],
    );
    if (!deptRows.length) return reject("Selected department was not found.");
    if (deptRows[0].status !== "Active") {
      return reject("Selected department is inactive.");
    }

    // ... rest of the function stays exactly the same

    // Category must be Active and belong to the department
    const catRows: any[] = await selectWithJoins(
      "ticketcategory",
      [],
      { ticketCategoryId: value.categoryId, companyId, delete: 0 },
      ["ticketCategoryId", "departmentId", "status"],
    );
    if (!catRows.length) return reject("Selected category was not found.");
    if (catRows[0].status !== "Active") {
      return reject("Selected category is inactive.");
    }
    if (Number(catRows[0].departmentId) !== value.departmentId) {
      return reject("Selected category does not belong to the department.");
    }

    // Default status = the company's "Open" status
    const statusRows: any[] = await selectWithJoins(
      "ticketstatus",
      [],
      { companyId, delete: 0, status: "Active" },
      ["ticketStatusId", "statusName"],
    );
    const openStatus = statusRows.find(
      (s) => String(s.statusName).trim().toLowerCase() === "open",
    );
    if (!openStatus) {
      return reject(
        'Ticket status "Open" is not set up. Ask your admin to add it in Ticket Status.',
      );
    }

    const fy: any = await getCurrentFinancialYear(companyId);
    if (!fy) return reject("Financial Year not found.");

    const ticketNo = await generateUniqueTicketNo(
      companyId,
      fy.financialYearId,
    );
    if (!ticketNo) {
      return reject("Could not generate a unique Ticket No. Please try again.");
    }

    const ticketCode = await generateUniqueTicketCode(companyId);
    if (!ticketCode) {
      return reject(
        "Could not generate a unique Ticket Number. Please try again.",
      );
    }

    const saved: any = await saveModel("ticket", {
      companyId,
      financialYearId: fy.financialYearId,
      ticketNo,
      ticketCode,
      employeeId: ctx.employeeId,
      branchId: null, // or just remove the line if the model allows null
      departmentId: value.departmentId,
      ticketCategoryId: value.categoryId,
      subject: value.subject,
      issueDescription: value.issueDescription,
      attachment: req.file ? req.file.path.replace(/\\/g, "/") : null,
      contactNumber: ctx.contactNumber,
      ticketStatusId: openStatus.ticketStatusId,
      createdBy: String(ctx.employeeId),
      createdType: "Employee",
      delete: 0,
    });

    if (!saved?.ticketId) return reject("Failed to save ticket");

    return successResponse(
      res,
      { ticketId: saved.ticketId, ticketNo, ticketCode },
      "Ticket created successfully.",
    );
  } catch (error) {
    removeUploaded(req.file);
    console.error("createTicket error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- My Tickets list (own tickets only) ----
// Query: search, departmentId, categoryId, ticketStatusId, fromDate, toDate (YYYY-MM-DD)
export const getTicketList = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const ctx = await getEmployeeContext(req);
    if (!ctx) return requiredmessage(res, "Employee not found.");

    const { companyId, employeeId } = ctx;
    const q = req.query as Record<string, string | undefined>;

    const rows: any[] = await selectWithJoins(
      "ticket",
      [],
      { companyId, employeeId, delete: 0 },
      [
        "ticketId",
        "ticketNo",
        "ticketCode",
        "branchId",
        "departmentId",
        "ticketCategoryId",
        "subject",
        "issueDescription",
        "attachment",
        "contactNumber",
        "ticketStatusId",
        "createdBy",
        "created",
      ],
      [["ticketId", "DESC"]],
    );

    const mapOf = async (
      table: string,
      idCol: string,
      nameCol: string,
    ): Promise<Record<string, string>> => {
      const list: any[] = await selectWithJoins(
        table,
        [],
        { companyId, delete: 0 },
        [idCol, nameCol],
      );
      const map: Record<string, string> = {};
      list.forEach((r) => {
        map[String(r[idCol])] = r[nameCol];
      });
      return map;
    };

    const [deptMap, catMap, statusMap] = await Promise.all([
      mapOf("department", "departmentId", "departmentName"),
      mapOf("ticketcategory", "ticketCategoryId", "categoryName"),
      mapOf("ticketstatus", "ticketStatusId", "statusName"),
    ]);

    const search = (q.search || "").trim().toLowerCase();

    const data = rows
      .filter((r) => {
        if (search) {
          const hit =
            String(r.ticketCode || "")
              .toLowerCase()
              .includes(search) ||
            String(r.ticketNo || "")
              .toLowerCase()
              .includes(search) ||
            String(r.subject || "")
              .toLowerCase()
              .includes(search);
          if (!hit) return false;
        }
        if (q.departmentId && String(r.departmentId) !== q.departmentId) {
          return false;
        }
        if (q.categoryId && String(r.ticketCategoryId) !== q.categoryId) {
          return false;
        }
        if (q.ticketStatusId && String(r.ticketStatusId) !== q.ticketStatusId) {
          return false;
        }
        const day = istDate(new Date(r.created));
        if (q.fromDate && day < q.fromDate) return false;
        if (q.toDate && day > q.toDate) return false;
        return true;
      })
      .map((r) => ({
        id: String(r.ticketId),
        ticketId: r.ticketId,
        ticketNo: r.ticketNo || "",
        ticketNumber: r.ticketCode || r.ticketNo || "",
        employeeId: String(employeeId),
        employeeName: ctx.employeeName,
        employeeCode: ctx.employeeCode,
        branchName: ctx.branchName,
        departmentId: String(r.departmentId),
        departmentName: deptMap[String(r.departmentId)] || "",
        categoryId: String(r.ticketCategoryId),
        categoryName: catMap[String(r.ticketCategoryId)] || "",
        subject: r.subject,
        issueDescription: r.issueDescription,
        attachment: r.attachment || null,
        contactNumber: r.contactNumber || "",
        statusId: String(r.ticketStatusId),
        status: statusMap[String(r.ticketStatusId)] || "Open",
        createdBy: r.createdBy || "",
        createdAt: istDateTime(r.created),
      }));

    return successResponse(res, data, "Tickets fetched successfully.");
  } catch (error) {
    console.error("getTicketList error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};
