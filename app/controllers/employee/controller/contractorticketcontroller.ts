import { Request, Response } from "express";
import {
  errorResponse,
  successResponse,
  requiredmessage,
  selectWithJoins,
  updateModel,
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

// verifyContractorToken sets req.contractorId and req.companyId
const getContractorContext = (req: Request) => {
  const contractorId = Number((req as any).contractorId);
  const companyId = Number((req as any).companyId);
  if (!contractorId || !companyId) return null;
  return { contractorId, companyId };
};

const mapOf = async (
  companyId: number,
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

// ---- Assigned tickets for the logged-in contractor ----
// GET contractor/ticket/assigned
// Query: search, departmentId, categoryId, ticketStatusId, fromDate, toDate
export const getContractorAssignedTickets = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const ctx = getContractorContext(req);
    if (!ctx) return requiredmessage(res, "Contractor not found.");

    const { companyId, contractorId } = ctx;
    const q = req.query as Record<string, string | undefined>;

    // 1. Get all active assignments for this contractor
    const assignRows: any[] = await selectWithJoins(
      "ticketassign",
      [],
      {
        companyId,
        contractorId,
        status: "Active",
        delete: 0,
      },
      [
        "ticketAssignId",
        "ticketId",
        "branchId",
        "contractorId",
        "assignedAt",
        "remarks",
        "ticketAssignNo",
      ],
      [["assignedAt", "DESC"]],
    );

    if (!assignRows.length) {
      return successResponse(res, [], "No assigned tickets found.");
    }

    // 2. Get the contractor name (only once)
    const contractorRows: any[] = await selectWithJoins(
      "contractor",
      [],
      { contractorId, companyId, delete: 0 },
      ["contractorId", "contractorName"],
    );
    const contractorName = contractorRows[0]?.contractorName || "";

    const ticketIds = assignRows.map((a) => a.ticketId);

    // 3. Fetch the actual tickets
    const ticketRows: any[] = await selectWithJoins(
      "ticket",
      [],
      { companyId, delete: 0 },
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

    const ticketMap: Record<string, any> = {};
    ticketRows.forEach((t) => {
      if (ticketIds.includes(t.ticketId)) {
        ticketMap[String(t.ticketId)] = t;
      }
    });

    // 4. Maps for names
    const empRows: any[] = await selectWithJoins(
      "employee",
      [],
      { companyId, delete: 0 },
      ["employeeId", "employeeName", "employeeCode"],
    );
    const empMap: Record<string, { name: string; code: string }> = {};
    empRows.forEach((e) => {
      empMap[String(e.employeeId)] = {
        name: e.employeeName,
        code: e.employeeCode,
      };
    });

    const branchRows: any[] = await selectWithJoins(
      "branch",
      [],
      { companyId, delete: 0 },
      ["branchId", "branchName"],
    );
    const branchMap: Record<string, string> = {};
    branchRows.forEach((b) => {
      branchMap[String(b.branchId)] = b.branchName;
    });

    const [deptMap, catMap, statusMap] = await Promise.all([
      mapOf(companyId, "department", "departmentId", "departmentName"),
      mapOf(companyId, "ticketcategory", "ticketCategoryId", "categoryName"),
      mapOf(companyId, "ticketstatus", "ticketStatusId", "statusName"),
    ]);

    // 5. Build response
    const search = (q.search || "").trim().toLowerCase();

    const data = assignRows
      .map((a) => {
        const t = ticketMap[String(a.ticketId)];
        if (!t) return null;

        const emp = empMap[String(t.employeeId)];

        return {
          id: String(t.ticketId),
          ticketId: t.ticketId,
          ticketNo: t.ticketNo || "",
          ticketNumber: t.ticketCode || t.ticketNo || "",
          employeeId: String(t.employeeId),
          employeeName: emp?.name || "",
          employeeCode: emp?.code || "",
          branchId: String(t.branchId),
          branchName: branchMap[String(t.branchId)] || "",
          departmentId: String(t.departmentId),
          departmentName: deptMap[String(t.departmentId)] || "",
          categoryId: String(t.ticketCategoryId),
          categoryName: catMap[String(t.ticketCategoryId)] || "",
          subject: t.subject,
          issueDescription: t.issueDescription,
          attachment: t.attachment || null,
          contactNumber: t.contactNumber || "",
          statusId: String(t.ticketStatusId),
          status: statusMap[String(t.ticketStatusId)] || "Open",
          createdBy: t.createdBy || "",
          createdAt: istDateTime(t.created),

          // Assignment fields
          ticketAssignId: a.ticketAssignId,
          ticketAssignNo: a.ticketAssignNo,
          assignedAt: istDateTime(a.assignedAt),
          remarks: a.remarks || "",
          isAssigned: true,
          contractorName, // ← now correctly filled
        };
      })
      .filter(Boolean)
      .filter((r: any) => {
        if (search) {
          const hit =
            String(r.ticketNumber || "")
              .toLowerCase()
              .includes(search) ||
            String(r.ticketNo || "")
              .toLowerCase()
              .includes(search) ||
            String(r.subject || "")
              .toLowerCase()
              .includes(search) ||
            String(r.employeeName || "")
              .toLowerCase()
              .includes(search);
          if (!hit) return false;
        }
        if (q.departmentId && String(r.departmentId) !== q.departmentId) return false;
        if (q.categoryId && String(r.categoryId) !== q.categoryId) return false;
        if (q.ticketStatusId && String(r.statusId) !== q.ticketStatusId) return false;

        const day = istDate(new Date(r.assignedAt || r.createdAt));
        if (q.fromDate && day < q.fromDate) return false;
        if (q.toDate && day > q.toDate) return false;
        return true;
      });

    return successResponse(res, data, "Assigned tickets fetched successfully.");
  } catch (error) {
    console.error("getContractorAssignedTickets error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Filter dropdown data for contractor ----
// GET contractor/ticket/filter-data
export const getContractorTicketFilterData = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const ctx = getContractorContext(req);
    if (!ctx) return requiredmessage(res, "Contractor not found.");

    const { companyId } = ctx;

    const [depts, cats, statuses]: any[][] = await Promise.all([
      selectWithJoins(
        "department",
        [],
        { companyId, delete: 0, status: "Active" },
        ["departmentId", "departmentName"],
        [["departmentName", "ASC"]],
      ),
      selectWithJoins(
        "ticketcategory",
        [],
        { companyId, delete: 0, status: "Active" },
        ["ticketCategoryId", "categoryName", "departmentId"],
        [["categoryName", "ASC"]],
      ),
      selectWithJoins(
        "ticketstatus",
        [],
        { companyId, delete: 0, status: "Active" },
        ["ticketStatusId", "statusName", "displayOrder"],
        [["displayOrder", "ASC"]],
      ),
    ]);

    return successResponse(
      res,
      {
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
      "Filter data fetched successfully.",
    );
  } catch (error) {
    console.error("getContractorTicketFilterData error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};





// PUT employee/contractorticket/ticket/status/:id
// body: { statusName: "In Progress" | "On Hold" | "In Review" }
export const updateContractorTicketStatus = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const ctx = getContractorContext(req);
    if (!ctx) return requiredmessage(res, "Contractor not found.");

    const { companyId, contractorId } = ctx;
    const ticketId = Number(req.params.id);
    const statusName = String(req.body?.statusName || "").trim();

    if (!ticketId) return errorResponse(res, "Invalid ticket id.");
    if (!statusName) return requiredmessage(res, "Status is required.");

    const allowed = ["In Progress", "On Hold", "In Review"];
    if (!allowed.includes(statusName)) {
      return errorResponse(
        res,
        "Contractor can only set status to: In Progress, On Hold, In Review",
      );
    }

    // Check that this ticket is assigned to the logged-in contractor
    const assignRows: any[] = await selectWithJoins(
      "ticketassign",
      [],
      {
        ticketId,
        companyId,
        contractorId,
        status: "Active",
        delete: 0,
      },
      ["ticketAssignId"],
    );
    if (!assignRows.length) {
      return errorResponse(res, "Ticket not found or not assigned to you.");
    }

    // Find the status ID by name
    const statusRows: any[] = await selectWithJoins(
      "ticketstatus",
      [],
      { companyId, delete: 0, status: "Active" },
      ["ticketStatusId", "statusName"],
    );
    const matched = statusRows.find(
      (s) =>
        String(s.statusName).toLowerCase() === statusName.toLowerCase(),
    );
    if (!matched) {
      return errorResponse(res, `Status "${statusName}" not found in system.`);
    }

  
    await updateModel(
      "ticket",
      {
        ticketStatusId: matched.ticketStatusId,
        updatedBy: String(contractorId),
        updated: new Date(),
      },
      { ticketId, companyId, delete: 0 },
    );

    return successResponse(
      res,
      {
        ticketId,
        ticketStatusId: matched.ticketStatusId,
        status: matched.statusName,
      },
      "Ticket status updated successfully.",
    );
  } catch (error) {
    console.error("updateContractorTicketStatus error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};