import { Request, Response } from "express";
import { Op } from "sequelize";

import {
  errorResponse,
  successResponse,
  requiredmessage,
  selectWithJoins,
  getBlobTempPublicUrl,
} from "../../../helper/index";

// areaManagerAuth sets req.areaManagerId and req.companyId
const getContext = (req: Request) => {
  const areaManagerId = Number((req as any).areaManagerId);
  const companyId = Number((req as any).companyId);
  if (!areaManagerId || !companyId) return null;
  return { areaManagerId, companyId };
};

// Helper: Get assigned branches for this Area Manager
const getAssignedBranches = async (
  companyId: number,
  areaManagerId: number,
) => {
  const rows: any[] = await selectWithJoins(
    "branch",
    [],
    { companyId, areaManagerId, delete: 0 },
    ["branchId", "branchName", "branchCode"],
  );
  return rows;
};

// ---- List All Tickets for Area Manager ----
// GET /area-manager/ticket/list
export const getAreaManagerTicketList = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const ctx = getContext(req);
    if (!ctx) return requiredmessage(res, "Area manager not found.");
    const { companyId, areaManagerId } = ctx;

    const q = req.query as Record<string, string | undefined>;

    // 1. Get all branches under this manager
    const branches = await getAssignedBranches(companyId, areaManagerId);
    const branchIds = branches.map((b) => Number(b.branchId));

    if (branchIds.length === 0) {
      return successResponse(res, [], "No branches assigned to this manager.");
    }

    // 2. Build the ticket query filters
    const ticketWhere: any = {
      companyId,
      delete: 0,
      branchId: { [Op.in]: branchIds },
    };

    if (q.branchId && branchIds.includes(Number(q.branchId))) {
      ticketWhere.branchId = Number(q.branchId);
    }
    if (q.departmentId) ticketWhere.departmentId = Number(q.departmentId);
    if (q.categoryId) ticketWhere.ticketCategoryId = Number(q.categoryId);
    if (q.ticketStatusId) ticketWhere.ticketStatusId = Number(q.ticketStatusId);

    if (q.fromDate || q.toDate) {
      ticketWhere.created = {};
      if (q.fromDate) {
        ticketWhere.created[Op.gte] = new Date(`${q.fromDate}T00:00:00.000Z`);
      }
      if (q.toDate) {
        ticketWhere.created[Op.lte] = new Date(`${q.toDate}T23:59:59.999Z`);
      }
    }

    // 3. Fetch Tickets
    const tickets: any[] = await selectWithJoins(
      "ticket",
      [],
      ticketWhere,
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
        "createdType",
      ],
      [["ticketId", "DESC"]],
    );

    if (tickets.length === 0) {
      return successResponse(res, [], "No tickets found.");
    }

    // 4. Load Lookups for the list
    const employeeIds = [
      ...new Set(tickets.map((t) => t.employeeId).filter(Boolean)),
    ];
    const departmentIds = [
      ...new Set(tickets.map((t) => t.departmentId).filter(Boolean)),
    ];
    const categoryIds = [
      ...new Set(tickets.map((t) => t.ticketCategoryId).filter(Boolean)),
    ];
    const statusIds = [
      ...new Set(tickets.map((t) => t.ticketStatusId).filter(Boolean)),
    ];

    // Fetch employees
    const employees: any[] = await selectWithJoins(
      "employee",
      [],
      { companyId, delete: 0 },
      ["employeeId", "employeeName", "employeeCode", "profilePhoto"],
    );
    const employeeMap: Record<string, any> = {};
    employees.forEach((e) => {
      employeeMap[String(e.employeeId)] = e;
    });

    // 👇 UPDATED: Fetch branches map to include both branchName and branchCode
    const branchMap: Record<string, { name: string; code: string }> = {};
    branches.forEach((b) => {
      branchMap[String(b.branchId)] = {
        name: b.branchName,
        code: b.branchCode || "",
      };
    });

    // Fetch departments
    const departments: any[] = await selectWithJoins(
      "department",
      [],
      { companyId, delete: 0 },
      ["departmentId", "departmentName"],
    );
    const deptMap: Record<string, string> = {};
    departments.forEach((d) => {
      deptMap[String(d.departmentId)] = d.departmentName;
    });

    // Fetch categories
    const categories: any[] = await selectWithJoins(
      "ticketcategory",
      [],
      { companyId, delete: 0 },
      ["ticketCategoryId", "categoryName"],
    );
    const catMap: Record<string, string> = {};
    categories.forEach((c) => {
      catMap[String(c.ticketCategoryId)] = c.categoryName;
    });

    // Fetch statuses
    const statuses: any[] = await selectWithJoins(
      "ticketstatus",
      [],
      { companyId, delete: 0 },
      ["ticketStatusId", "statusName"],
    );
    const statusMap: Record<string, string> = {};
    statuses.forEach((s) => {
      statusMap[String(s.ticketStatusId)] = s.statusName;
    });

    // 5. Map final response
    const data = tickets.map((t) => {
      const emp = employeeMap[String(t.employeeId)] || {};

      // 👇 UPDATED: Get branchInfo from the updated map
      const branchInfo = branchMap[String(t.branchId)];

      return {
        id: String(t.ticketId),
        ticketId: t.ticketId,
        ticketNumber: t.ticketNo || t.ticketCode || `TKT-${t.ticketId}`,
        employeeId: t.employeeId,
        employeeName: emp.employeeName || t.createdBy || "Unknown",
        employeeCode: emp.employeeCode || "—",
        branchId: t.branchId,
        branchName: branchInfo?.name || "—",
        branchCode: branchInfo?.code || "", // 👈 Added branchCode to response
        departmentId: t.departmentId,
        departmentName: deptMap[String(t.departmentId)] || "—",
        categoryId: t.ticketCategoryId,
        categoryName: catMap[String(t.ticketCategoryId)] || "—",
        subject: t.subject,
        issueDescription: t.issueDescription,
        attachment: t.attachment ? getBlobTempPublicUrl(t.attachment) : null,
        contactNumber: t.contactNumber,
        status: statusMap[String(t.ticketStatusId)] || "Open",
        statusId: String(t.ticketStatusId),
        createdBy: t.createdBy,
        createdAt: t.created,
      };
    });

    return successResponse(res, data, "Tickets fetched successfully.");
  } catch (error) {
    console.error("getAreaManagerTicketList error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Form Data for Filters ----
// GET /area-manager/ticket/form-data
export const getAreaManagerTicketFormData = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const ctx = getContext(req);
    if (!ctx) return requiredmessage(res, "Area manager not found.");
    const { companyId, areaManagerId } = ctx;

    const branches = await getAssignedBranches(companyId, areaManagerId);

    const departments: any[] = await selectWithJoins(
      "department",
      [],
      { companyId, delete: 0 },
      ["departmentId", "departmentName"],
    );

    const categories: any[] = await selectWithJoins(
      "ticketcategory",
      [],
      { companyId, delete: 0 },
      ["ticketCategoryId", "categoryName", "departmentId"],
    );

    const statuses: any[] = await selectWithJoins(
      "ticketstatus",
      [],
      { companyId, delete: 0 },
      ["ticketStatusId", "statusName"],
    );

    return successResponse(
      res,
      {
        branches: branches.map((b) => ({
          id: String(b.branchId),
          label: b.branchName,
        })),
        departments: departments.map((d) => ({
          id: String(d.departmentId),
          label: d.departmentName,
        })),
        categories: categories.map((c) => ({
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
    console.error("getAreaManagerTicketFormData error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Single Ticket Detail ----
// GET /area-manager/ticket/:id
export const getAreaManagerTicketDetail = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const ctx = getContext(req);
    if (!ctx) return requiredmessage(res, "Area manager not found.");
    const { companyId, areaManagerId } = ctx;

    const ticketId = Number(req.params.id);
    if (!ticketId) return errorResponse(res, "Invalid ticket id.");

    const branches = await getAssignedBranches(companyId, areaManagerId);
    const branchIds = branches.map((b) => Number(b.branchId));

    const tickets: any[] = await selectWithJoins(
      "ticket",
      [],
      {
        ticketId,
        companyId,
        branchId: { [Op.in]: branchIds },
        delete: 0,
      },
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
    );

    if (tickets.length === 0) {
      return errorResponse(
        res,
        "Ticket not found or not assigned to your area.",
      );
    }

    const t = tickets[0];

    const employees: any[] = await selectWithJoins(
      "employee",
      [],
      { employeeId: t.employeeId, companyId, delete: 0 },
      ["employeeId", "employeeName", "employeeCode", "profilePhoto"],
    );
    const departments: any[] = await selectWithJoins(
      "department",
      [],
      { departmentId: t.departmentId, companyId, delete: 0 },
      ["departmentId", "departmentName"],
    );
    const categories: any[] = await selectWithJoins(
      "ticketcategory",
      [],
      { ticketCategoryId: t.ticketCategoryId, companyId, delete: 0 },
      ["ticketCategoryId", "categoryName"],
    );
    const statuses: any[] = await selectWithJoins(
      "ticketstatus",
      [],
      { ticketStatusId: t.ticketStatusId, companyId, delete: 0 },
      ["ticketStatusId", "statusName"],
    );
    const branch = branches.find(
      (b) => Number(b.branchId) === Number(t.branchId),
    );

    const data = {
      id: String(t.ticketId),
      ticketId: t.ticketId,
      ticketNumber: t.ticketNo || t.ticketCode || `TKT-${t.ticketId}`,
      employeeId: t.employeeId,
      employeeName: employees[0]?.employeeName || t.createdBy || "Unknown",
      employeeCode: employees[0]?.employeeCode || "—",
      branchId: t.branchId,
      branchName: branch?.branchName || "—",
      departmentId: t.departmentId,
      departmentName: departments[0]?.departmentName || "—",
      categoryId: t.ticketCategoryId,
      categoryName: categories[0]?.categoryName || "—",
      subject: t.subject,
      issueDescription: t.issueDescription,
      attachment: t.attachment ? getBlobTempPublicUrl(t.attachment) : null,
      contactNumber: t.contactNumber,
      status: statuses[0]?.statusName || "Open",
      statusId: String(t.ticketStatusId),
      createdBy: t.createdBy,
      createdAt: t.created,
    };

    return successResponse(res, data, "Ticket fetched successfully.");
  } catch (error) {
    console.error("getAreaManagerTicketDetail error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};
