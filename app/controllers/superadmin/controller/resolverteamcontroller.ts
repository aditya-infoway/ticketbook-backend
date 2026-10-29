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

// ---- Types ----
type Id = string | number;

interface ResolverTeamBody {
 resolverTeamId?: Id;
  financialYearId?: Id;
  teamCode: string;
  teamName: string;
  teamDescription?: string | null;
  departmentIds: number[]; 
  teamLeaderId?: Id | null;
  teamMemberIds?: number[];
  coverageType: string;
  regionId?: Id | null;
  assignedBranchIds?: number[];
  assignmentMethod: string;
  teamEmail?: string | null;
  status?: string;
}

interface Creator {
  by: string;
  type: string;
}

interface Links {
  departmentIds: number[];  
  teamLeaderId: number | null;
  memberIds: number[];
  coverageType: string;
  regionId: number | null;
  branchIds: number[];
}

// What the team already had (inactive records are only rejected when newly picked)
interface Existing {
  departmentIds: number[];  
  teamLeaderId?: number | null;
  regionId?: number | null;
  memberIds: number[];
  branchIds: number[];
}

// ---- Get company from token ----
const getCompanyIdFromToken = async (req: Request): Promise<Id | null> => {
  const token =
    (req.headers["x-token"] as string) ||
    (req.headers["X-Token"] as string) ||
    "";

  if (!token) return null;

  const rows: any[] = await selectWithJoins(
    "company",
    [],
    { token, delete: 0 },
    ["companyId"],
  );

  return rows.length ? rows[0].companyId : null;
};

// ---- Helpers ----
const toNumberOrNull = (value: unknown): number | null =>
  value === undefined || value === null || value === "" ? null : Number(value);

const toText = (value: unknown): string =>
  value === undefined || value === null ? "" : String(value).trim();

const toIds = (value: unknown): number[] =>
  Array.isArray(value)
    ? [
        ...new Set(
          value.map(Number).filter((n) => Number.isInteger(n) && n > 0),
        ),
      ]
    : [];

// ids are stored in one column as "3,5,9"
const idsToText = (ids: number[]): string => ids.join(",");
const textToIds = (value: unknown): number[] =>
  toIds(
    String(value || "")
      .split(",")
      .map(Number),
  );

const getCreator = (req: Request, companyId: Id): Creator => {
  const employeeId = (req as any).employeeId as Id | undefined;

  return {
    by: employeeId ? String(employeeId) : String(companyId),
    type: employeeId ? "Employee" : "Super Admin",
  };
};

// Team Name must be unique inside a company (case-insensitive)
const isNameTaken = async (
  companyId: Id,
  name: string,
  excludeId?: Id,
): Promise<boolean> => {
  const rows: any[] = await selectWithJoins(
    "resolverteam",
    [],
    { companyId, delete: 0 },
    ["resolverTeamId", "teamName"],
  );

  const wanted = name.trim().toLowerCase();

  return rows.some(
    (row) =>
      String(row.teamName || "")
        .trim()
        .toLowerCase() === wanted &&
      String(row.resolverTeamId) !== String(excludeId ?? ""),
  );
};
// Team Code must be unique inside a company (case-insensitive)
const isCodeTaken = async (
  companyId: Id,
  code: string,
  excludeId?: Id,
): Promise<boolean> => {
  const rows: any[] = await selectWithJoins(
    "resolverteam",
    [],
    { companyId, delete: 0 },
    ["resolverTeamId", "teamCode"],
  );

  const wanted = code.trim().toLowerCase();

  return rows.some(
    (row) =>
      String(row.teamCode || "").trim().toLowerCase() === wanted &&
      String(row.resolverTeamId) !== String(excludeId ?? ""),
  );
};
// Department / leader / members / region / branches must exist in this company.
const validateLinks = async (
  companyId: Id,
  links: Links,
  existing?: Existing,
): Promise<string | null> => {
  // Department
// Departments
if (!links.departmentIds.length) {
  return "At least one department is required.";
}

const deptRows: any[] = await selectWithJoins(
  "department",
  [],
  { departmentId: links.departmentIds, companyId, delete: 0 },
  ["departmentId", "status"],
);
if (deptRows.length !== links.departmentIds.length) {
  return "One or more selected departments were not found.";
}
const inactiveDept = deptRows.find(
  (d) =>
    d.status !== "Active" &&
    !(existing?.departmentIds || []).includes(Number(d.departmentId)),
);
if (inactiveDept) return "An inactive department cannot be added to a team.";

  // Team leader
  if (links.teamLeaderId) {
    const rows: any[] = await selectWithJoins(
      "employee",
      [],
      { employeeId: links.teamLeaderId, companyId, delete: 0 },
      ["employeeId", "employmentStatus"],
    );
    if (!rows.length) return "Selected team leader was not found.";
    if (
      Number(existing?.teamLeaderId) !== links.teamLeaderId &&
      rows[0].employmentStatus !== "Active"
    ) {
      return "Selected team leader is inactive.";
    }
  }

  // Members
  if (!links.memberIds.length) return "At least one team member is required.";

  const memberRows: any[] = await selectWithJoins(
    "employee",
    [],
    { employeeId: links.memberIds, companyId, delete: 0 },
    ["employeeId", "employmentStatus"],
  );
  if (memberRows.length !== links.memberIds.length) {
    return "One or more selected team members were not found.";
  }
  const inactiveMember = memberRows.find(
    (m) =>
      m.employmentStatus !== "Active" &&
      !(existing?.memberIds || []).includes(Number(m.employeeId)),
  );
  if (inactiveMember)
    return "An inactive employee cannot be added as a member.";

  // Coverage
  if (links.coverageType === "Specific") {
    if (!links.regionId && !links.branchIds.length) {
      return "Select a region or at least one branch for specific coverage.";
    }

    if (links.regionId) {
      const rows: any[] = await selectWithJoins(
        "region",
        [],
        { regionId: links.regionId, companyId, delete: 0 },
        ["regionId", "status"],
      );
      if (!rows.length) return "Selected region was not found.";
      if (
        Number(existing?.regionId) !== links.regionId &&
        rows[0].status !== "Active"
      ) {
        return "Selected region is inactive.";
      }
    }

    if (links.branchIds.length) {
      const rows: any[] = await selectWithJoins(
        "branch",
        [],
        { branchId: links.branchIds, companyId, delete: 0 },
        ["branchId", "regionId", "status"],
      );
      if (rows.length !== links.branchIds.length) {
        return "One or more selected branches were not found.";
      }

      if (
        links.regionId &&
        rows.some((b) => Number(b.regionId) !== links.regionId)
      ) {
        return "Selected branches must belong to the selected region.";
      }

      const inactiveBranch = rows.find(
        (b) =>
          b.status !== "Active" &&
          !(existing?.branchIds || []).includes(Number(b.branchId)),
      );
      if (inactiveBranch) {
        return "An inactive branch cannot be assigned to a team.";
      }
    }
  }

  return null;
};

// Coverage "All" -> no region / branches
const normalizeLinks = (body: ResolverTeamBody): Links => {
  const specific = body.coverageType === "Specific";

  return {
  departmentIds: toIds(body.departmentIds),   // departmentId: Number(body.departmentId) ki jagah
    teamLeaderId: toNumberOrNull(body.teamLeaderId),
    memberIds: toIds(body.teamMemberIds),
    coverageType: body.coverageType,
    regionId: specific ? toNumberOrNull(body.regionId) : null,
    branchIds: specific ? toIds(body.assignedBranchIds) : [],
  };
};

// Unique Resolver Team No (prefix + FY + running number), retry on collision
const generateUniqueResolverTeamNo = async (
  companyId: number,
  financialYearId: number,
): Promise<string | null> => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { billNo } = await generateVoucherNo({
      companyId,
      financialYearId,
      tableName: "resolverteam",
      idColumn: "resolverTeamId",
      prefixFor: "RESOLVER_TEAM",
      numberColumn: "resolverTeamNo",
    });

    const existing: any[] = await selectWithJoins(
      "resolverteam",
      [],
      { companyId, financialYearId, resolverTeamNo: billNo, delete: 0 },
      ["resolverTeamId"],
    );

    if (existing.length === 0) return billNo;

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  return null;
};

// ---- Next Resolver Team No (drawer preview) ----
export const getNextResolverTeamNo = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const companyId = await getCompanyIdFromToken(req);

    if (!companyId) {
      return requiredmessage(res, "Unauthorized. Please login again.");
    }

    const { financialYearId } = req.query as { financialYearId?: string };

    if (!financialYearId) {
      return errorResponse(
        res,
        "Financial Year not found. Please select a company year.",
      );
    }

    const fy: any = await getFinancialYearById(
      financialYearId as any,
      Number(companyId),
    );
    if (!fy) return errorResponse(res, "Invalid Financial Year.");

    const resolverTeamNo = await generateUniqueResolverTeamNo(
      Number(companyId),
      fy.financialYearId,
    );

    if (!resolverTeamNo) {
      return errorResponse(
        res,
        "Could not generate a unique Team ID. Please try again.",
      );
    }

    return successResponse(
      res,
      {
        resolverTeamNo,
        fyLabel: fy.fyLabel,
        financialYearId: fy.financialYearId,
      },
      "Team ID generated successfully",
    );
  } catch (error) {
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Create Resolver Team ----
export const createResolverTeam = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const companyId = await getCompanyIdFromToken(req);

    if (!companyId) {
      return requiredmessage(res, "Unauthorized. Please login again.");
    }

    const body = req.body as ResolverTeamBody;

    const fy: any = await getFinancialYearById(
      body.financialYearId as any,
      Number(companyId),
    );
    if (!fy) return errorResponse(res, "Invalid Financial Year.");

    if (await isNameTaken(companyId, body.teamName)) {
      return requiredmessage(res, "Team name already exists.");
    }
if (await isCodeTaken(companyId, body.teamCode)) {
  return requiredmessage(res, "Team code already exists.");
}
    const links = normalizeLinks(body);

    const linkError = await validateLinks(companyId, links);
    if (linkError) return errorResponse(res, linkError);

    const resolverTeamNo = await generateUniqueResolverTeamNo(
      Number(companyId),
      fy.financialYearId,
    );
    if (!resolverTeamNo) {
      return errorResponse(
        res,
        "Could not generate a unique Team ID. Please try again.",
      );
    }

    const creator = getCreator(req, companyId);

    const saved: any = await saveModel("resolverteam", {
      companyId,
      financialYearId: fy.financialYearId,
      resolverTeamNo,
        teamCode: toText(body.teamCode), 
      teamName: toText(body.teamName),
      teamDescription: toText(body.teamDescription),
    departmentIds: idsToText(links.departmentIds),
      teamLeaderId: links.teamLeaderId,
      coverageType: links.coverageType,
      regionId: links.regionId,
      teamMemberIds: idsToText(links.memberIds),
      assignedBranchIds: idsToText(links.branchIds),
      assignmentMethod: body.assignmentMethod,
      teamEmail: toText(body.teamEmail),
      status: body.status || "Active",
      createdBy: creator.by,
      createdType: creator.type,
      delete: 0,
    });

    if (!saved?.resolverTeamId) {
      return errorResponse(res, "Failed to save resolver team");
    }

    return successResponse(
      res,
      { resolverTeamId: saved.resolverTeamId, resolverTeamNo },
      "Resolver team created successfully.",
    );
  } catch (error) {
    console.error("createResolverTeam error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- List Resolver Teams ----
export const getResolverTeamList = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const companyId = await getCompanyIdFromToken(req);

    if (!companyId) {
      return requiredmessage(
        res,
        "Invalid or expired session. Please login again.",
      );
    }

    const rows: any[] = await selectWithJoins(
      "resolverteam",
      [],
      { companyId, delete: 0 },
      [
        "resolverTeamId",
        "financialYearId",
        "resolverTeamNo",
        "teamName",
        "teamDescription",
       "teamCode",
        "departmentId",
        "departmentIds",
        "teamLeaderId",
        "coverageType",
        "regionId",
        "teamMemberIds",
        "assignedBranchIds",
        "assignmentMethod",
        "teamEmail",
        "status",
        "createdBy",
        "createdType",
        "updatedBy",
        "created",
        "updated",
      ],
      [["resolverTeamId", "DESC"]],
    );

    if (!rows.length) {
      return successResponse(res, [], "Resolver teams fetched successfully.");
    }

    // Name lookups
    const deptRows: any[] = await selectWithJoins(
      "department",
      [],
      { companyId, delete: 0 },
      ["departmentId", "departmentName"],
    );
    const deptMap: Record<string, string> = {};
    deptRows.forEach((d) => {
      deptMap[String(d.departmentId)] = d.departmentName;
    });

    const employeeRows: any[] = await selectWithJoins(
      "employee",
      [],
      { companyId, delete: 0 },
      ["employeeId", "employeeName"],
    );
    const employeeMap: Record<string, string> = {};
    employeeRows.forEach((e) => {
      employeeMap[String(e.employeeId)] = e.employeeName;
    });

    const regionRows: any[] = await selectWithJoins(
      "region",
      [],
      { companyId, delete: 0 },
      ["regionId", "regionName"],
    );
    const regionMap: Record<string, string> = {};
    regionRows.forEach((r) => {
      regionMap[String(r.regionId)] = r.regionName;
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

    const data = rows.map((r) => {
      // names come from the ids; deleted employees / branches are skipped
      const memberIds = textToIds(r.teamMemberIds).filter(
        (id) => employeeMap[String(id)],
      );
      const branchIds = textToIds(r.assignedBranchIds).filter(
        (id) => branchMap[String(id)],
      );
  const savedDeptIds = textToIds(r.departmentIds);
  const departmentIds = (
    savedDeptIds.length
      ? savedDeptIds
      : r.departmentId
        ? [Number(r.departmentId)]
        : []
  ).filter((id) => deptMap[String(id)]);
      return {
        id: String(r.resolverTeamId),
        resolverTeamId: r.resolverTeamId,
        financialYearId: r.financialYearId,
        resolverTeamNo: r.resolverTeamNo || "",
        teamCode: r.teamCode || "",
        teamName: r.teamName,
        teamDescription: r.teamDescription || "",
     departmentIds,
    departmentNames: departmentIds.map((id) => deptMap[String(id)] || ""),
    departmentName: departmentIds
      .map((id) => deptMap[String(id)] || "")
      .join(", "),
        teamLeaderId: r.teamLeaderId,
        teamLeaderName: r.teamLeaderId
          ? employeeMap[String(r.teamLeaderId)] || ""
          : "",
        teamMemberIds: memberIds,
        teamMemberNames: memberIds.map((id) => employeeMap[String(id)] || ""),
        coverageType: r.coverageType,
        regionId: r.regionId,
        regionName: r.regionId ? regionMap[String(r.regionId)] || "" : "",
        assignedBranchIds: branchIds,
        assignedBranchNames: branchIds.map((id) => branchMap[String(id)] || ""),
        assignmentMethod: r.assignmentMethod,
        teamEmail: r.teamEmail || "",
        status: r.status,
        createdBy: r.createdBy || "",
        createdType: r.createdType || "",
        updatedBy: r.updatedBy || "",
        created: r.created,
        updated: r.updated,
      };
    });

    return successResponse(res, data, "Resolver teams fetched successfully.");
  } catch (error) {
    console.error("getResolverTeamList error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Update Resolver Team (also used for Activate / Deactivate) ----
export const updateResolverTeam = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const companyId = await getCompanyIdFromToken(req);

    if (!companyId) {
      return requiredmessage(res, "Unauthorized. Please login again.");
    }

    const body = req.body as ResolverTeamBody;
    const resolverTeamId = Number(body.resolverTeamId);

    const existingRows: any[] = await selectWithJoins(
      "resolverteam",
      [],
      { resolverTeamId, companyId, delete: 0 },
      [
        "resolverTeamId",
        "departmentId",
        "departmentIds",
        "teamLeaderId",
        "regionId",
        "teamMemberIds",
        "assignedBranchIds",
      ],
    );
    if (!existingRows.length) {
      return requiredmessage(res, "Resolver team not found.");
    }

    if (await isNameTaken(companyId, body.teamName, resolverTeamId)) {
      return requiredmessage(res, "Team name already exists.");
    }

    if (await isCodeTaken(companyId, body.teamCode, resolverTeamId)) {
      return requiredmessage(res, "Team code already exists.");
    }

    const links = normalizeLinks(body);

    // naye records: departmentIds, purane records: legacy departmentId fallback
    const savedDeptIds = textToIds(existingRows[0].departmentIds);
    const existingDeptIds = savedDeptIds.length
      ? savedDeptIds
      : existingRows[0].departmentId
        ? [Number(existingRows[0].departmentId)]
        : [];

    const linkError = await validateLinks(companyId, links, {
      departmentIds: existingDeptIds,
      teamLeaderId: existingRows[0].teamLeaderId,
      regionId: existingRows[0].regionId,
      memberIds: textToIds(existingRows[0].teamMemberIds),
      branchIds: textToIds(existingRows[0].assignedBranchIds),
    });
    if (linkError) return errorResponse(res, linkError);

    const creator = getCreator(req, companyId);

    // resolverTeamNo, financialYearId, createdBy are not changed on update
    await updateModel(
      "resolverteam",
      {
        teamCode: toText(body.teamCode),
        teamName: toText(body.teamName),
        teamDescription: toText(body.teamDescription),
        departmentIds: idsToText(links.departmentIds),
        teamLeaderId: links.teamLeaderId,
        coverageType: links.coverageType,
        regionId: links.regionId,
        teamMemberIds: idsToText(links.memberIds),
        assignedBranchIds: idsToText(links.branchIds),
        assignmentMethod: body.assignmentMethod,
        teamEmail: toText(body.teamEmail),
        status: body.status || "Active",
        updatedBy: creator.by,
        updated: new Date(),
      },
      { resolverTeamId, companyId },
    );

    return successResponse(res, {}, "Resolver team updated successfully.");
  } catch (error) {
    console.error("updateResolverTeam error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Delete Resolver Team (soft delete) ----
export const deleteResolverTeam = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const companyId = await getCompanyIdFromToken(req);

    if (!companyId) {
      return requiredmessage(res, "Unauthorized. Please login again.");
    }

    const resolverTeamId = Number(
      req.body?.resolverTeamId ?? (req.query as any)?.resolverTeamId,
    );

    if (!resolverTeamId || isNaN(resolverTeamId)) {
      return requiredmessage(res, "Resolver team id is required.");
    }

    const existing: any[] = await selectWithJoins(
      "resolverteam",
      [],
      { resolverTeamId, companyId, delete: 0 },
      ["resolverTeamId"],
    );
    if (!existing.length) {
      return requiredmessage(res, "Resolver team not found.");
    }

    // TODO: once the Ticket module exists, block delete when open tickets
    // are assigned to this team.

    await updateModel(
      "resolverteam",
      { delete: 1, updated: new Date() },
      { resolverTeamId, companyId },
    );
    await updateModel(
      "resolverteammember",
      { delete: 1 },
      { resolverTeamId, companyId, delete: 0 },
    );
    await updateModel(
      "resolverteambranch",
      { delete: 1 },
      { resolverTeamId, companyId, delete: 0 },
    );

    return successResponse(res, {}, "Resolver team deleted successfully.");
  } catch (error) {
    console.error("deleteResolverTeam error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};
