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

// Superadmin token (checktoken) req me companyId set nahi karta (headers me sirf apitoken/x-token/elevel aate hain).
// Isliye companyId OPTIONAL hai:
//   - query / body me companyId aaye to sirf us company ka data
//   - na aaye to superadmin ko saari companies/branches ka data dikhta hai
const getCompanyId = (req: Request): number | null => {
  const r = req as any;
  const raw = r.companyId ?? r.query?.companyId ?? r.body?.companyId;
  const n = Number(raw);
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
      [
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
      ],
      [["ticketId", "DESC"]],
    );

    // Employee name/code map
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

    const search = (q.search || "").trim().toLowerCase();

    const data = rows
      .filter((r) => {
        if (search) {
          const emp = empMap[String(r.employeeId)];
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
      .map((r) => {
        const emp = empMap[String(r.employeeId)];
        return {
          id: String(r.ticketId),
          ticketId: r.ticketId,
          ticketNo: r.ticketNo || "",
          ticketNumber: r.ticketCode || r.ticketNo || "",
          employeeId: String(r.employeeId),
          employeeName: emp?.name || "",
          employeeCode: emp?.code || "",
          branchId: String(r.branchId || ""),
          branchName: branchMap[String(r.branchId)] || "",
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
        };
      });

    return successResponse(res, data, "Tickets fetched successfully.");
  } catch (error) {
    console.error("getSuperAdminTicketList error:", error);
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
      { ticketStatusId },
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