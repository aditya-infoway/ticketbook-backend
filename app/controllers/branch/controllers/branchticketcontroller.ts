import { Request, Response } from "express";

import {
  errorResponse,
  successResponse,
  requiredmessage,
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

// verifyBranchToken middleware se branchId & companyId req me aate hain
const getBranchContext = (req: Request) => {
  const branchId = Number((req as any).branchId);
  const companyId = Number((req as any).companyId);
  if (!branchId || !companyId) return null;
  return { branchId, companyId };
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

// ---- Branch ticket list (sirf is branch ke tickets) ----
// GET branch/ticket/list
// Query: search, departmentId, categoryId, ticketStatusId, fromDate, toDate
export const getBranchTicketList = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const ctx = getBranchContext(req);
    if (!ctx) return requiredmessage(res, "Branch not found.");

    const { companyId, branchId } = ctx;
    const q = req.query as Record<string, string | undefined>;

    const rows: any[] = await selectWithJoins(
      "ticket",
      [],
      { companyId, branchId, delete: 0 },
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
      { companyId, branchId, delete: 0 },
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
      { branchId, companyId, delete: 0 },
      ["branchId", "branchName"],
    );
    const branchName = branchRows[0]?.branchName || "";

    const [deptMap, catMap, statusMap] = await Promise.all([
      mapOf(companyId, "department", "departmentId", "departmentName"),
      mapOf(companyId, "ticketcategory", "ticketCategoryId", "categoryName"),
      mapOf(companyId, "ticketstatus", "ticketStatusId", "statusName"),
    ]);

    const assignRows: any[] = await selectWithJoins(
      "ticketassign",
      [],
      { companyId, branchId, status: "Active", delete: 0 },
      ["ticketId", "contractorId", "assignedAt"],
    );
    const contractorMap = await mapOf(
      companyId,
      "contractor",
      "contractorId",
      "contractorName",
    );
    const assignMap: Record<string, any> = {};
    assignRows.forEach((a) => {
      assignMap[String(a.ticketId)] = a;
    });

    const search = (q.search || "").trim().toLowerCase();

    const data = rows
      .filter((r) => {
        if (search) {
          const emp = empMap[String(r.employeeId)];
          const hit =
            String(r.ticketCode || "")
              .toLowerCase()
              .includes(search) ||
            String(r.ticketNo || "")
              .toLowerCase()
              .includes(search) ||
            String(r.subject || "")
              .toLowerCase()
              .includes(search) ||
            String(emp?.name || "")
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
          branchName,
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
          isAssigned: !!assignMap[String(r.ticketId)],
          contractorName:
            contractorMap[
              String(assignMap[String(r.ticketId)]?.contractorId)
            ] || "",
          assignedAt: assignMap[String(r.ticketId)]
            ? istDateTime(assignMap[String(r.ticketId)].assignedAt)
            : "",
        };
      });

    return successResponse(res, data, "Tickets fetched successfully.");
  } catch (error) {
    console.error("getBranchTicketList error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Form data: filters + status dropdown ----
// GET branch/ticket/form-data
export const getBranchTicketFormData = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const ctx = getBranchContext(req);
    if (!ctx) return requiredmessage(res, "Branch not found.");

    const { companyId, branchId } = ctx;

    const [
      depts,
      cats,
      statuses,
      branchRows,
      contractorRows,
      cdeptRows,
    ]: any[][] = await Promise.all([
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
      selectWithJoins("branch", [], { branchId, companyId, delete: 0 }, [
        "branchId",
        "branchName",
      ]),
      selectWithJoins(
        "contractor",
        [],
        { companyId, branchId, delete: 0, status: "Active" },
        ["contractorId", "contractorName", "contractorDepartmentId"],
        [["contractorName", "ASC"]],
      ),
      selectWithJoins("contractordepartment", [], { companyId, delete: 0 }, [
        "contractorDepartmentId",
        "departmentName",
      ]),
    ]);

    return successResponse(
      res,
      {
        // drawer ke type ke liye; page view ke time ticket wale employee se override karta hai
        employee: {
          employeeName: "",
          employeeCode: "",
          branchName: branchRows[0]?.branchName || "",
          contactNumber: "",
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
        contractors: contractorRows.map((c) => ({
          id: String(c.contractorId),
          label: c.contractorName,
          departmentId: c.contractorDepartmentId
            ? String(c.contractorDepartmentId)
            : "",
          departmentName:
            cdeptRows.find(
              (d) =>
                String(d.contractorDepartmentId) ===
                String(c.contractorDepartmentId),
            )?.departmentName || "",
        })),
        statuses: statuses.map((s) => ({
          id: String(s.ticketStatusId),
          label: s.statusName,
        })),
      },
      "Form data fetched successfully.",
    );
  } catch (error) {
    console.error("getBranchTicketFormData error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Update ticket status ----
// PUT branch/ticket/status/:id     body: { ticketStatusId }
export const updateBranchTicketStatus = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const ctx = getBranchContext(req);
    if (!ctx) return requiredmessage(res, "Branch not found.");

    const { companyId, branchId } = ctx;
    const ticketId = Number(req.params.id);
    const ticketStatusId = Number(req.body?.ticketStatusId);

    if (!ticketId) return errorResponse(res, "Invalid ticket id.");
    if (!ticketStatusId) return errorResponse(res, "Status is required.");

    // Ticket isi branch ka hona chahiye
    const ticketRows: any[] = await selectWithJoins(
      "ticket",
      [],
      { ticketId, companyId, branchId, delete: 0 },
      ["ticketId", "ticketStatusId"],
    );
    if (!ticketRows.length) return errorResponse(res, "Ticket not found.");

    // Status valid + Active hona chahiye
    const statusRows: any[] = await selectWithJoins(
      "ticketstatus",
      [],
      { ticketStatusId, companyId, delete: 0, status: "Active" },
      ["ticketStatusId", "statusName"],
    );
    if (!statusRows.length) {
      return errorResponse(
        res,
        "Selected status was not found or is inactive.",
      );
    }

    if (Number(ticketRows[0].ticketStatusId) === ticketStatusId) {
      return errorResponse(res, "Ticket is already in this status.");
    }

    // saveModel sirf create karta hai, update ke liye updateModel use hota hai
    await updateModel(
      "ticket",
      { ticketStatusId },
      { ticketId, companyId, branchId, delete: 0 },
    );

    return successResponse(
      res,
      { ticketId, ticketStatusId, status: statusRows[0].statusName },
      "Ticket status updated successfully.",
    );
  } catch (error) {
    console.error("updateBranchTicketStatus error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};
