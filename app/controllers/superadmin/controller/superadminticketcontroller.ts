import { Request, Response } from "express";

import {
  errorResponse,
  successResponse,
  updateModel,
  selectWithJoins,
} from "../../../helper/index";

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

// Full public URL for a stored upload, e.g. http://localhost:8001/Uploadimages/ticket/x.jpg
const toPublicUrl = (req: Request, storedPath?: string | null): string => {
  if (!storedPath) return "";
  const clean = String(storedPath).replace(/\\/g, "/").replace(/^\/+/, "");
  return `${req.protocol}://${req.get("host")}/${clean}`;
};

// Superadmin token (checktoken) req me companyId set nahi karta, isliye OPTIONAL:
//   - query / body me companyId aaye to sirf us company ka data
//   - na aaye to saari companies/branches ka data
const getCompanyId = (req: Request): number | null => {
  const r = req as any;
  const n = Number(r.companyId ?? r.query?.companyId ?? r.body?.companyId);
  return n ? n : null;
};

// where condition me companyId sirf tab jodo jab mila ho
const withCompany = (companyId: number | null) =>
  companyId ? { companyId } : {};

const mapOf = async (
  companyId: number | null,
  table: string,
  idCol: string,
  nameCol: string,
): Promise<Record<string, string>> => {
  const list: any[] = await selectWithJoins(
    table,
    [],
    { ...withCompany(companyId), delete: 0 },
    [idCol, nameCol],
  );
  const map: Record<string, string> = {};
  list.forEach((r) => {
    map[String(r[idCol])] = r[nameCol];
  });
  return map;
};

const TICKET_COLUMNS = [
  "ticketId",
  "ticketNo",
  "ticketCode",
  "employeeId",
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
];

// Lookup maps + row -> response shape (list aur details dono me same)
const buildLookups = async (companyId: number | null) => {
  const empRows: any[] = await selectWithJoins(
    "employee",
    [],
    { ...withCompany(companyId), delete: 0 },
    ["employeeId", "employeeName", "employeeCode"],
  );
  const empMap: Record<string, { name: string; code: string }> = {};
  empRows.forEach((e) => {
    empMap[String(e.employeeId)] = {
      name: e.employeeName,
      code: e.employeeCode,
    };
  });

  const [branchMap, deptMap, catMap, statusMap] = await Promise.all([
    mapOf(companyId, "branch", "branchId", "branchName"),
    mapOf(companyId, "department", "departmentId", "departmentName"),
    mapOf(companyId, "ticketcategory", "ticketCategoryId", "categoryName"),
    mapOf(companyId, "ticketstatus", "ticketStatusId", "statusName"),
  ]);

  return { empMap, branchMap, deptMap, catMap, statusMap };
};

const toRow = (
  req: Request,
  r: any,
  l: Awaited<ReturnType<typeof buildLookups>>,
) => {
  const emp = l.empMap[String(r.employeeId)];
  return {
    id: String(r.ticketId),
    ticketId: r.ticketId,
    ticketNo: r.ticketNo || "",
    ticketNumber: r.ticketCode || r.ticketNo || "",
    employeeId: String(r.employeeId),
    employeeName: emp?.name || "",
    employeeCode: emp?.code || "",
    branchId: String(r.branchId || ""),
    branchName: l.branchMap[String(r.branchId)] || "",
    departmentId: String(r.departmentId),
    departmentName: l.deptMap[String(r.departmentId)] || "",
    categoryId: String(r.ticketCategoryId),
    categoryName: l.catMap[String(r.ticketCategoryId)] || "",
    subject: r.subject,
    issueDescription: r.issueDescription,
    attachment: r.attachment || null,
    attachmentUrl: toPublicUrl(req, r.attachment),
    contactNumber: r.contactNumber || "",
    statusId: String(r.ticketStatusId),
    status: l.statusMap[String(r.ticketStatusId)] || "Open",
    createdBy: r.createdBy || "",
    createdAt: istDateTime(r.created),
  };
};

// ---- Superadmin ticket list ----
// GET superadmin/ticket/list
// Query: search, companyId(optional), branchId, departmentId, categoryId, ticketStatusId, fromDate, toDate
export const getSuperAdminTicketList = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const companyId = getCompanyId(req);
    const q = req.query as Record<string, string | undefined>;

    const rows: any[] = await selectWithJoins(
      "ticket",
      [],
      { ...withCompany(companyId), delete: 0 },
      TICKET_COLUMNS,
      [["ticketId", "DESC"]],
    );

    const lookups = await buildLookups(companyId);
    const search = (q.search || "").trim().toLowerCase();

    const data = rows
      .filter((r) => {
        if (search) {
          const emp = lookups.empMap[String(r.employeeId)];
          const hit =
            String(r.ticketCode || "").toLowerCase().includes(search) ||
            String(r.ticketNo || "").toLowerCase().includes(search) ||
            String(r.subject || "").toLowerCase().includes(search) ||
            String(emp?.name || "").toLowerCase().includes(search);
          if (!hit) return false;
        }
        if (q.branchId && String(r.branchId) !== q.branchId) return false;
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
      .map((r) => toRow(req, r, lookups));

    return successResponse(res, data, "Tickets fetched successfully.");
  } catch (error) {
    console.error("getSuperAdminTicketList error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Single ticket (details page) ----
// GET superadmin/ticket/details/:id
export const getSuperAdminTicketDetails = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const companyId = getCompanyId(req);
    const ticketId = Number(req.params.id);
    if (!ticketId) return errorResponse(res, "Invalid ticket id.");

    const rows: any[] = await selectWithJoins(
      "ticket",
      [],
      { ...withCompany(companyId), ticketId, delete: 0 },
      TICKET_COLUMNS,
    );
    if (!rows.length) return errorResponse(res, "Ticket not found.");

    const lookups = await buildLookups(companyId);

    return successResponse(
      res,
      toRow(req, rows[0], lookups),
      "Ticket fetched successfully.",
    );
  } catch (error) {
    console.error("getSuperAdminTicketDetails error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Form data: filters + status dropdown ----
// GET superadmin/ticket/form-data
export const getSuperAdminTicketFormData = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const companyId = getCompanyId(req);
    const base = { ...withCompany(companyId), delete: 0 };

    const [branches, depts, cats, statuses]: any[][] = await Promise.all([
      selectWithJoins(
        "branch",
        [],
        base,
        ["branchId", "branchName"],
        [["branchName", "ASC"]],
      ),
      selectWithJoins(
        "department",
        [],
        { ...base, status: "Active" },
        ["departmentId", "departmentName"],
        [["departmentName", "ASC"]],
      ),
      selectWithJoins(
        "ticketcategory",
        [],
        { ...base, status: "Active" },
        ["ticketCategoryId", "categoryName", "departmentId"],
        [["categoryName", "ASC"]],
      ),
      selectWithJoins(
        "ticketstatus",
        [],
        { ...base, status: "Active" },
        ["ticketStatusId", "statusName", "displayOrder"],
        [["displayOrder", "ASC"]],
      ),
    ]);

    return successResponse(
      res,
      {
        branches: branches.map((b) => ({
          id: String(b.branchId),
          label: b.branchName,
        })),
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
    console.error("getSuperAdminTicketFormData error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Update ticket status ----
// PUT superadmin/ticket/status/:id     body: { ticketStatusId }
export const updateSuperAdminTicketStatus = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const companyId = getCompanyId(req);
    const ticketId = Number(req.params.id);
    const ticketStatusId = Number(req.body?.ticketStatusId);

    if (!ticketId) return errorResponse(res, "Invalid ticket id.");
    if (!ticketStatusId) return errorResponse(res, "Status is required.");

    const ticketRows: any[] = await selectWithJoins(
      "ticket",
      [],
      { ...withCompany(companyId), ticketId, delete: 0 },
      ["ticketId", "companyId", "ticketStatusId"],
    );
    if (!ticketRows.length) return errorResponse(res, "Ticket not found.");

    // Status usi company ka hona chahiye jiska ticket hai
    const statusRows: any[] = await selectWithJoins(
      "ticketstatus",
      [],
      {
        ticketStatusId,
        companyId: ticketRows[0].companyId,
        delete: 0,
        status: "Active",
      },
      ["ticketStatusId", "statusName"],
    );
    if (!statusRows.length) {
      return errorResponse(res, "Selected status was not found or is inactive.");
    }

    if (Number(ticketRows[0].ticketStatusId) === ticketStatusId) {
      return errorResponse(res, "Ticket is already in this status.");
    }

    // saveModel sirf create karta hai, update ke liye updateModel use hota hai
    await updateModel(
      "ticket",
      { ticketStatusId, updated: new Date() },
      { ticketId, companyId: ticketRows[0].companyId, delete: 0 },
    );

    return successResponse(
      res,
      { ticketId, ticketStatusId, status: statusRows[0].statusName },
      "Ticket status updated successfully.",
    );
  } catch (error) {
    console.error("updateSuperAdminTicketStatus error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};