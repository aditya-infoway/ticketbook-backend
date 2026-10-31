import { Request, Response } from "express";

import {
  errorResponse,
  successResponse,
  requiredmessage,
  saveModel,
  updateModel,
  selectWithJoins,
} from "../../../helper/index";
import { getFinancialYearById } from "../../../helper/financialYear";
import { generateVoucherNo } from "../../../helper/billNoGenerator";

// A ticket can be assigned only after the branch has set its status to "Assigned"
const ASSIGNABLE_STATUSES = ["assigned"];

// verifyBranchToken sets req.branchId and req.companyId
const getBranchContext = (req: Request) => {
  const branchId = Number((req as any).branchId);
  const companyId = Number((req as any).companyId);
  if (!branchId || !companyId) return null;
  return { branchId, companyId };
};

// Branch login has no select-company step, so use the company's latest FY.
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

// Unique Assign No (prefix + FY + running number), retry on collision
const generateUniqueAssignNo = async (
  companyId: number,
  financialYearId: number,
): Promise<string | null> => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { billNo } = await generateVoucherNo({
      companyId,
      financialYearId,
      tableName: "ticketassign",
      idColumn: "ticketAssignId",
      prefixFor: "TICKET_ASSIGN",
      numberColumn: "ticketAssignNo",
    });

    const existing: any[] = await selectWithJoins(
      "ticketassign",
      [],
      { companyId, financialYearId, ticketAssignNo: billNo, delete: 0 },
      ["ticketAssignId"],
    );
    if (existing.length === 0) return billNo;

    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return null;
};

// ---- Next Assign No (drawer preview) ----
// GET branch/ticket/assign/next-number
export const getNextAssignNo = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const ctx = getBranchContext(req);
    if (!ctx) return requiredmessage(res, "Branch not found.");

    const fy: any = await getCurrentFinancialYear(ctx.companyId);
    if (!fy) return errorResponse(res, "Financial Year not found.");

    const ticketAssignNo = await generateUniqueAssignNo(
      ctx.companyId,
      fy.financialYearId,
    );
    if (!ticketAssignNo) {
      return errorResponse(
        res,
        "Could not generate a unique Assign ID. Please try again.",
      );
    }

    return successResponse(
      res,
      { ticketAssignNo },
      "Assign ID generated successfully",
    );
  } catch (error) {
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Assign (or reassign) a ticket to a contractor ----
// POST branch/ticket/assign     body: { ticketId, contractorId, remarks? }
export const assignTicket = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const ctx = getBranchContext(req);
    if (!ctx) return requiredmessage(res, "Branch not found.");

    const { companyId, branchId } = ctx;
    const ticketId = Number(req.body?.ticketId);
    const contractorId = Number(req.body?.contractorId);
    const remarks = String(req.body?.remarks ?? "").trim();

    if (!ticketId) return requiredmessage(res, "Ticket is required.");
    if (!contractorId) return requiredmessage(res, "Contractor is required.");
    if (remarks.length > 500) {
      return requiredmessage(res, "Remarks must be at most 500 characters.");
    }

    // Ticket must belong to this branch
    const ticketRows: any[] = await selectWithJoins(
      "ticket",
      [],
      { ticketId, companyId, branchId, delete: 0 },
      ["ticketId", "ticketStatusId"],
    );
    if (!ticketRows.length) return errorResponse(res, "Ticket not found.");

    // Current status must allow assigning
    const currentStatusRows: any[] = await selectWithJoins(
      "ticketstatus",
      [],
      { ticketStatusId: ticketRows[0].ticketStatusId, companyId },
      ["ticketStatusId", "statusName"],
    );
    const currentName = String(currentStatusRows[0]?.statusName || "").trim();
    if (!ASSIGNABLE_STATUSES.includes(currentName.toLowerCase())) {
      return errorResponse(
        res,
        'Set the ticket status to "Assigned" first (Edit), then assign a contractor.',
      );
    }

    // Contractor: exists, Active, and registered under this branch
    const contractorRows: any[] = await selectWithJoins(
      "contractor",
      [],
      { contractorId, companyId, delete: 0 },
      [
        "contractorId",
        "contractorName",
        "branchId",
        "contractorDepartmentId",
        "status",
      ],
    );
    if (!contractorRows.length) {
      return errorResponse(res, "Selected contractor was not found.");
    }
    const contractor = contractorRows[0];
    if (contractor.status !== "Active") {
      return errorResponse(res, "Selected contractor is inactive.");
    }
    if (Number(contractor.branchId) !== branchId) {
      return errorResponse(
        res,
        "Selected contractor does not belong to this branch.",
      );
    }
    // Once per ticket: any earlier assignment blocks a new one
    const already: any[] = await selectWithJoins(
      "ticketassign",
      [],
      { ticketId, companyId, delete: 0 },
      ["ticketAssignId"],
    );
    if (already.length) {
      return errorResponse(res, "This ticket is already assigned.");
    }

    const fy: any = await getCurrentFinancialYear(companyId);
    if (!fy) return errorResponse(res, "Financial Year not found.");

    const ticketAssignNo = await generateUniqueAssignNo(
      companyId,
      fy.financialYearId,
    );
    if (!ticketAssignNo) {
      return errorResponse(
        res,
        "Could not generate a unique Assign ID. Please try again.",
      );
    }

    const saved: any = await saveModel("ticketassign", {
      companyId,
      financialYearId: fy.financialYearId,
      ticketAssignNo,
      ticketId,
      branchId,
      contractorId,
      contractorDepartmentId: contractor.contractorDepartmentId || null,
      assignedAt: new Date(),
      remarks,
      status: "Active",
      createdBy: String(branchId),
      createdType: "Branch",
      delete: 0,
    });
    if (!saved?.ticketAssignId) {
      return errorResponse(res, "Failed to save assignment");
    }

    // the ticket is already in "Assigned" status, so its status is not changed here
    return successResponse(
      res,
      {
        ticketAssignId: saved.ticketAssignId,
        ticketAssignNo,
        ticketId,
        contractorId,
        contractorName: contractor.contractorName,
      },
      "Ticket assigned successfully.",
    );
  } catch (error) {
    console.error("assignTicket error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Contractors of this branch (for the assign drawer dropdown) ----
// GET branch/ticket/contractors
export const getBranchContractors = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const ctx = getBranchContext(req);
    if (!ctx) return requiredmessage(res, "Branch not found.");

    const { companyId, branchId } = ctx;

    const rows: any[] = await selectWithJoins(
      "contractor",
      [],
      { companyId, branchId, delete: 0, status: "Active" },
      ["contractorId", "contractorName", "contractorDepartmentId"],
      [["contractorName", "ASC"]],
    );

    const deptRows: any[] = await selectWithJoins(
      "contractordepartment",
      [],
      { companyId, delete: 0 },
      ["contractorDepartmentId", "departmentName"],
    );
    const deptMap: Record<string, string> = {};
    deptRows.forEach((d) => {
      deptMap[String(d.contractorDepartmentId)] = d.departmentName;
    });

    return successResponse(
      res,
      rows.map((c) => ({
        id: String(c.contractorId),
        label: c.contractorName,
        departmentId: c.contractorDepartmentId
          ? String(c.contractorDepartmentId)
          : "",
        departmentName: deptMap[String(c.contractorDepartmentId)] || "",
      })),
      "Contractors fetched successfully.",
    );
  } catch (error) {
    console.error("getBranchContractors error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};
