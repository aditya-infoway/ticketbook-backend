import { Request, Response } from "express";

import {
  errorResponse,
  successResponse,
  requiredmessage,
  saveModel,
  updateModel,
  selectWithJoins,
} from "../../../helper/index";

// ============================================================
// ASSUMPTIONS (apne DB ke hisaab se match kar lena)
// ------------------------------------------------------------
// Table "ticketcontractorwork" (contractor ko ticket assign hone par row banti hai,
// contractor kaam submit kare to completion fields bharti hain):
//   ticketWorkId (PK), companyId, branchId, ticketId, contractorId,
//   status            : "Assigned" | "Submitted" | "Reassigned" | "Approved"
//   assignedDate, completionDate, completionRemarks,
//   completionAttachment (path, ek ya comma-separated / JSON array),
//   reviewRemarks, reassignedFrom, delete, created
// Table "contractor": contractorId, contractorName, branchId, status, delete
// Agar column ke naam alag hain to sirf neeche ke naam badalne hain.
// ============================================================

const IST = "Asia/Kolkata";
const istDate = (value: unknown): string =>
  value
    ? new Date(value as any).toLocaleDateString("en-CA", { timeZone: IST })
    : "";

// verifyBranchToken (branchAuth) se branchId & companyId req me aate hain
const getBranchContext = (req: Request) => {
  const branchId = Number((req as any).branchId);
  const companyId = Number((req as any).companyId);
  if (!branchId || !companyId) return null;
  return { branchId, companyId };
};

const mapOf = async (
  table: string,
  idCol: string,
  nameCol: string,
  where: Record<string, any>,
): Promise<Record<string, string>> => {
  const list: any[] = await selectWithJoins(table, [], where, [idCol, nameCol]);
  const map: Record<string, string> = {};
  list.forEach((r) => {
    map[String(r[idCol])] = r[nameCol];
  });
  return map;
};

// "a.png,b.pdf" ya '["a.png","b.pdf"]' -> ["a.png","b.pdf"]
const parseAttachments = (value: unknown): string[] => {
  if (!value) return [];
  const s = String(value).trim();
  if (s.startsWith("[")) {
    try {
      const arr = JSON.parse(s);
      return Array.isArray(arr) ? arr.map(String) : [];
    } catch {
      return [];
    }
  }
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
};

// ---- List: contractor ne jo kaam submit kiya (review pending) ----
// GET branch/contractor-review/list
export const getContractorReviewList = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const ctx = getBranchContext(req);
    if (!ctx) return requiredmessage(res, "Branch not found.");
    const { companyId, branchId } = ctx;

    // "In Review" status id
    const statusRows: any[] = await selectWithJoins(
      "ticketstatus",
      [],
      { companyId, delete: 0 },
      ["ticketStatusId", "statusName"],
    );
    const inReview = statusRows.find(
      (s) => String(s.statusName).trim().toLowerCase() === "in review",
    );
    if (!inReview) return successResponse(res, [], "No work waiting for review.");

    // Is branch ke In Review tickets
    const tickets: any[] = await selectWithJoins(
      "ticket",
      [],
      { companyId, branchId, ticketStatusId: inReview.ticketStatusId, delete: 0 },
      ["ticketId", "ticketNo", "ticketCode", "subject", "departmentId", "updated"],
      [["updated", "DESC"]],
    );
    if (!tickets.length) return successResponse(res, [], "No work waiting for review.");

    // Active assignment -> contractor
    const assigns: any[] = await selectWithJoins(
      "ticketassign",
      [],
      { companyId, branchId, status: "Active", delete: 0 },
      ["ticketId", "contractorId", "remarks"],
    );
    const assignMap: Record<string, any> = {};
    assigns.forEach((a) => (assignMap[String(a.ticketId)] = a));

    const [deptMap, contractorMap, branchMap] = await Promise.all([
      mapOf("department", "departmentId", "departmentName", { companyId, delete: 0 }),
      mapOf("contractor", "contractorId", "contractorName", { delete: 0 }),
      mapOf("branch", "branchId", "branchName", { companyId, delete: 0 }),
    ]);

    const data = tickets.map((t) => {
      const a = assignMap[String(t.ticketId)];
      return {
        id: String(t.ticketId), // ab id = ticketId (reassign isi se hoga)
        ticketId: String(t.ticketId),
        ticketNo: t.ticketNo || "",
        ticketNumber: t.ticketCode || t.ticketNo || "",
        ticketTitle: t.subject || "",
        branchName: branchMap[String(branchId)] || "",
        departmentName: deptMap[String(t.departmentId)] || "",
        contractorId: a ? String(a.contractorId) : "",
        contractorName: a ? contractorMap[String(a.contractorId)] || "" : "",
        completionDate: istDate(t.updated),
        completionRemarks: a?.remarks || "",
        attachments: [] as string[],
        status: "Submitted for Review",
      };
    });

    return successResponse(res, data, "Work reviews fetched successfully.");
  } catch (error) {
    console.error("getContractorReviewList error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};
// ---- Form data: reassign ke liye contractors ----
// GET branch/contractor-review/form-data
export const getContractorReviewFormData = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const ctx = getBranchContext(req);
    if (!ctx) return requiredmessage(res, "Branch not found.");

    const contractors: any[] = await selectWithJoins(
      "contractor",
      [],
      { branchId: ctx.branchId, status: "Active", delete: 0 },
      ["contractorId", "contractorName"],
      [["contractorName", "ASC"]],
    );

    return successResponse(
      res,
      {
        contractors: contractors.map((c) => ({
          id: String(c.contractorId),
          label: c.contractorName,
        })),
      },
      "Form data fetched successfully.",
    );
  } catch (error) {
    console.error("getContractorReviewFormData error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Reassign: kaam wapas contractor ko (ya dusre contractor ko) ----
// PUT branch/contractor-review/reassign/:id     body: { contractorId, remarks }
export const reassignContractorWork = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const ctx = getBranchContext(req);
    if (!ctx) return requiredmessage(res, "Branch not found.");
    const { companyId, branchId } = ctx;

    const ticketId = Number(req.params.id);
    const contractorId = Number(req.body?.contractorId);
    const remarks = String(req.body?.remarks || "").trim();
    if (!ticketId) return errorResponse(res, "Invalid ticket id.");

    // Ticket isi branch ka aur In Review hona chahiye
    const statusRows: any[] = await selectWithJoins(
      "ticketstatus",
      [],
      { companyId, delete: 0 },
      ["ticketStatusId", "statusName"],
    );
    const byName = (n: string) =>
      statusRows.find((s) => String(s.statusName).trim().toLowerCase() === n);
    const inReview = byName("in review");
    const inProgress = byName("in progress");
    if (!inReview || !inProgress) {
      return errorResponse(res, "Required ticket statuses are not set up.");
    }

    const ticketRows: any[] = await selectWithJoins(
      "ticket",
      [],
      { ticketId, companyId, branchId, delete: 0 },
      ["ticketId", "ticketStatusId"],
    );
    if (!ticketRows.length) return errorResponse(res, "Ticket not found.");
    if (String(ticketRows[0].ticketStatusId) !== String(inReview.ticketStatusId)) {
      return errorResponse(res, "Only tickets in review can be reassigned.");
    }

    // Naya contractor isi branch ka Active
    const contractorRows: any[] = await selectWithJoins(
      "contractor",
      [],
      { contractorId, branchId, status: "Active", delete: 0 },
      ["contractorId"],
    );
    if (!contractorRows.length) {
      return errorResponse(res, "Selected contractor was not found or is inactive.");
    }

    const assignRows: any[] = await selectWithJoins(
      "ticketassign",
      [],
      { ticketId, companyId, status: "Active", delete: 0 },
      ["ticketAssignId"],
    );
    if (!assignRows.length) return errorResponse(res, "Assignment not found.");

    await updateModel(
      "ticketassign",
      { contractorId, remarks },
      { ticketAssignId: assignRows[0].ticketAssignId, companyId },
    );

    await updateModel(
      "ticket",
      { ticketStatusId: inProgress.ticketStatusId, updated: new Date() },
      { ticketId, companyId },
    );

    return successResponse(res, { ticketId, contractorId }, "Work reassigned successfully.");
  } catch (error) {
    console.error("reassignContractorWork error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};