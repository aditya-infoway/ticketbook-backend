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

// A branch can assign a ticket only while its status (lower-case name) is one of these
const ASSIGNABLE_STATUSES = ["open", "reopened", "assigned"];
// Status the ticket moves to after assigning
const ASSIGNED_STATUS_NAME = "assigned";

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
        `A ticket with status "${currentName || "Unknown"}" cannot be assigned.`,
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

    // The company's "Assigned" status
    const activeStatuses: any[] = await selectWithJoins(
      "ticketstatus",
      [],
      { companyId, delete: 0, status: "Active" },
      ["ticketStatusId", "statusName"],
    );
    const assignedStatus = activeStatuses.find(
      (s) => String(s.statusName).trim().toLowerCase() === ASSIGNED_STATUS_NAME,
    );
    if (!assignedStatus) {
      return errorResponse(
        res,
        'Ticket status "Assigned" is not set up. Ask your admin to add it in Ticket Status.',
      );
    }

    // Current active assignment (if any)
    const previous: any[] = await selectWithJoins(
      "ticketassign",
      [],
      { ticketId, companyId, status: "Active", delete: 0 },
      ["ticketAssignId", "contractorId"],
    );
    if (previous.some((p) => Number(p.contractorId) === contractorId)) {
      return errorResponse(
        res,
        "Ticket is already assigned to this contractor.",
      );
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

    // Older assignments become history
    for (const p of previous) {
      await updateModel(
        "ticketassign",
        {
          status: "Reassigned",
          updatedBy: String(branchId),
          updated: new Date(),
        },
        { ticketAssignId: p.ticketAssignId, companyId },
      );
    }

    await updateModel(
      "ticket",
      {
        ticketStatusId: assignedStatus.ticketStatusId,
        updatedBy: String(branchId),
        updated: new Date(),
      },
      { ticketId, companyId, branchId, delete: 0 },
    );

    return successResponse(
      res,
      {
        ticketAssignId: saved.ticketAssignId,
        ticketAssignNo,
        ticketId,
        contractorId,
        contractorName: contractor.contractorName,
        status: assignedStatus.statusName,
      },
      "Ticket assigned successfully.",
    );
  } catch (error) {
    console.error("assignTicket error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};
