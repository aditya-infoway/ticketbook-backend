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

type Id = string | number;

interface ContractorDepartmentBody {
  contractorDepartmentId?: Id;
  financialYearId?: Id;
  departmentName: string;
  departmentCode: string;
  description?: string | null;
  status?: string;
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

const toText = (value: unknown): string =>
  value === undefined || value === null ? "" : String(value).trim();

const getCreator = (req: Request, companyId: Id) => {
  const employeeId = (req as any).employeeId as Id | undefined;

  return {
    by: employeeId ? String(employeeId) : String(companyId),
    type: employeeId ? "Employee" : "Super Admin",
  };
};

// Code and Name must each be unique inside a company (case-insensitive)
const findDuplicate = async (
  companyId: Id,
  code: string,
  name: string,
  excludeId?: Id,
): Promise<string | null> => {
  const rows: any[] = await selectWithJoins(
    "contractordepartment",
    [],
    { companyId, delete: 0 },
    ["contractorDepartmentId", "departmentCode", "departmentName"],
  );

  const wantedCode = code.trim().toLowerCase();
  const wantedName = name.trim().toLowerCase();

  for (const row of rows) {
    if (String(row.contractorDepartmentId) === String(excludeId ?? "")) {
      continue;
    }
    if (
      String(row.departmentCode || "")
        .trim()
        .toLowerCase() === wantedCode
    ) {
      return "Department code already exists.";
    }
    if (
      String(row.departmentName || "")
        .trim()
        .toLowerCase() === wantedName
    ) {
      return "Department name already exists.";
    }
  }
  return null;
};

// Unique Department No (prefix + FY + running number), retry on collision
const generateUniqueDepartmentNo = async (
  companyId: number,
  financialYearId: number,
): Promise<string | null> => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { billNo } = await generateVoucherNo({
      companyId,
      financialYearId,
      tableName: "contractordepartment",
      idColumn: "contractorDepartmentId",
      prefixFor: "CONTRACTOR_DEPARTMENT",
      numberColumn: "contractorDepartmentNo",
    });

    const existing: any[] = await selectWithJoins(
      "contractordepartment",
      [],
      {
        companyId,
        financialYearId,
        contractorDepartmentNo: billNo,
        delete: 0,
      },
      ["contractorDepartmentId"],
    );

    if (existing.length === 0) return billNo;

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  return null;
};

// ---- Next Department No (drawer preview) ----
export const getNextContractorDepartmentNo = async (
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

    const contractorDepartmentNo = await generateUniqueDepartmentNo(
      Number(companyId),
      fy.financialYearId,
    );
    if (!contractorDepartmentNo) {
      return errorResponse(
        res,
        "Could not generate a unique Department ID. Please try again.",
      );
    }

    return successResponse(
      res,
      {
        contractorDepartmentNo,
        fyLabel: fy.fyLabel,
        financialYearId: fy.financialYearId,
      },
      "Department ID generated successfully",
    );
  } catch (error) {
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Create ----
export const createContractorDepartment = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const companyId = await getCompanyIdFromToken(req);

    if (!companyId) {
      return requiredmessage(res, "Unauthorized. Please login again.");
    }

    const body = req.body as ContractorDepartmentBody;

    const fy: any = await getFinancialYearById(
      body.financialYearId as any,
      Number(companyId),
    );
    if (!fy) return errorResponse(res, "Invalid Financial Year.");

    const duplicate = await findDuplicate(
      companyId,
      body.departmentCode,
      body.departmentName,
    );
    if (duplicate) return requiredmessage(res, duplicate);

    const contractorDepartmentNo = await generateUniqueDepartmentNo(
      Number(companyId),
      fy.financialYearId,
    );
    if (!contractorDepartmentNo) {
      return errorResponse(
        res,
        "Could not generate a unique Department ID. Please try again.",
      );
    }

    const creator = getCreator(req, companyId);

    const saved: any = await saveModel("contractordepartment", {
      companyId,
      financialYearId: fy.financialYearId,
      contractorDepartmentNo,
      departmentCode: toText(body.departmentCode),
      departmentName: toText(body.departmentName),
      description: toText(body.description),
      status: body.status || "Active",
      createdBy: creator.by,
      createdType: creator.type,
      delete: 0,
    });

    if (!saved?.contractorDepartmentId) {
      return errorResponse(res, "Failed to save department");
    }

    return successResponse(
      res,
      {
        contractorDepartmentId: saved.contractorDepartmentId,
        contractorDepartmentNo,
      },
      "Department created successfully.",
    );
  } catch (error) {
    console.error("createContractorDepartment error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- List ----
export const getContractorDepartmentList = async (
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
      "contractordepartment",
      [],
      { companyId, delete: 0 },
      [
        "contractorDepartmentId",
        "financialYearId",
        "contractorDepartmentNo",
        "departmentCode",
        "departmentName",
        "description",
        "status",
        "createdBy",
        "createdType",
        "updatedBy",
        "created",
        "updated",
      ],
      [["contractorDepartmentId", "DESC"]],
    );

    const data = rows.map((r) => ({
      id: String(r.contractorDepartmentId),
      contractorDepartmentId: r.contractorDepartmentId,
      financialYearId: r.financialYearId,
      departmentNo: r.contractorDepartmentNo || "",
      departmentCode: r.departmentCode,
      departmentName: r.departmentName,
      description: r.description || "",
      status: r.status,
      createdBy: r.createdBy || "",
      createdType: r.createdType || "",
      updatedBy: r.updatedBy || "",
      created: r.created,
      updated: r.updated,
    }));

    return successResponse(res, data, "Departments fetched successfully.");
  } catch (error) {
    console.error("getContractorDepartmentList error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Update (also used for Activate / Deactivate) ----
export const updateContractorDepartment = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const companyId = await getCompanyIdFromToken(req);

    if (!companyId) {
      return requiredmessage(res, "Unauthorized. Please login again.");
    }

    const body = req.body as ContractorDepartmentBody;
    const contractorDepartmentId = Number(body.contractorDepartmentId);

    const existing: any[] = await selectWithJoins(
      "contractordepartment",
      [],
      { contractorDepartmentId, companyId, delete: 0 },
      ["contractorDepartmentId"],
    );
    if (!existing.length) return requiredmessage(res, "Department not found.");

    const duplicate = await findDuplicate(
      companyId,
      body.departmentCode,
      body.departmentName,
      contractorDepartmentId,
    );
    if (duplicate) return requiredmessage(res, duplicate);

    const creator = getCreator(req, companyId);

    // contractorDepartmentNo, financialYearId, createdBy are not changed on update
    await updateModel(
      "contractordepartment",
      {
        departmentCode: toText(body.departmentCode),
        departmentName: toText(body.departmentName),
        description: toText(body.description),
        status: body.status || "Active",
        updatedBy: creator.by,
        updated: new Date(),
      },
      { contractorDepartmentId, companyId },
    );

    return successResponse(res, {}, "Department updated successfully.");
  } catch (error) {
    console.error("updateContractorDepartment error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Delete (soft delete) ----
export const deleteContractorDepartment = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const companyId = await getCompanyIdFromToken(req);

    if (!companyId) {
      return requiredmessage(res, "Unauthorized. Please login again.");
    }

    const contractorDepartmentId = Number(
      req.body?.contractorDepartmentId ??
        (req.query as any)?.contractorDepartmentId,
    );

    if (!contractorDepartmentId || isNaN(contractorDepartmentId)) {
      return requiredmessage(res, "Department id is required.");
    }

    const existing: any[] = await selectWithJoins(
      "contractordepartment",
      [],
      { contractorDepartmentId, companyId, delete: 0 },
      ["contractorDepartmentId"],
    );
    if (!existing.length) return requiredmessage(res, "Department not found.");

    // TODO: once contractors exist, block delete when this department is in use.

    await updateModel(
      "contractordepartment",
      { delete: 1, updated: new Date() },
      { contractorDepartmentId, companyId },
    );

    return successResponse(res, {}, "Department deleted successfully.");
  } catch (error) {
    console.error("deleteContractorDepartment error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};
