import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import * as fs from "fs";
import * as path from "path";
import "multer";
import {
  errorResponse,
  successResponse,
  requiredmessage,
  saveModel,
  updateModel,
  selectWithJoins,
  getBlobTempPublicUrl,
} from "../../../helper/index";
import { getFinancialYearById } from "../../../helper/financialYear";
import { generateVoucherNo } from "../../../helper/billNoGenerator";

// ---- Types ----
type Id = string | number;

interface EmployeeBody {
  employeeId?: Id;
  financialYearId?: Id;
  employeeCode: string;
  employeeName: string;
  profilePhoto?: string | null;
  officialEmail?: string | null;
  mobileCountryCode?: string | null;
  mobileNumber?: string | null;
  alternateCountryCode?: string | null;
  alternateContact?: string | null;
  country?: string | null;
  state?: string | null;
  district?: string | null;
  city?: string | null;
  address?: string | null;
  pinCode?: string | null;
  employmentStatus?: string;
  remarks?: string | null;
  roleId?: Id | null;
  branchId?: Id | null;
  additionalDepartments?: number[] | string | null;
  password?: string | null;
  confirmPassword?: string | null;
}

interface Creator {
  by: string;
  type: string;
}

interface Links {
  roleId: number | null;
  branchId: number | null;
  departmentIds: number[];
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
const normalizeCode = (value: unknown): string =>
  String(value || "")
    .trim()
    .toUpperCase();

const normalizeEmail = (value: unknown): string =>
  String(value || "")
    .trim()
    .toLowerCase();

const toNumberOrNull = (value: unknown): number | null =>
  value === undefined || value === null || value === "" ? null : Number(value);

const toText = (value: unknown): string =>
  value === undefined || value === null ? "" : String(value).trim();

const toDateOrNull = (value: unknown): string | null =>
  value ? String(value).trim() : null;

// Accepts [1,2] or a JSON string "[1,2]" (form-data)
const parseIds = (value: unknown): number[] => {
  let list: unknown = value;

  if (typeof value === "string") {
    try {
      list = value ? JSON.parse(value) : [];
    } catch {
      list = [];
    }
  }

  if (!Array.isArray(list)) return [];

  return [
    ...new Set(list.map(Number).filter((n) => Number.isInteger(n) && n > 0)),
  ];
};

const getCreator = (req: Request, companyId: Id): Creator => {
  const employeeId = (req as any).employeeId as Id | undefined;

  return {
    by: employeeId ? String(employeeId) : String(companyId),
    type: employeeId ? "Employee" : "Super Admin",
  };
};

// Employee Code must be unique inside a company
const isCodeTaken = async (
  companyId: Id,
  code: string,
  excludeId?: Id,
): Promise<boolean> => {
  const rows: any[] = await selectWithJoins(
    "employee",
    [],
    { companyId, delete: 0 },
    ["employeeId", "employeeCode"],
  );

  return rows.some(
    (row) =>
      normalizeCode(row.employeeCode) === code &&
      String(row.employeeId) !== String(excludeId ?? ""),
  );
};

// Official Email is the login id -> unique across ALL companies
const isEmailTaken = async (
  email: string,
  excludeId?: Id,
): Promise<boolean> => {
  const rows: any[] = await selectWithJoins("employee", [], { delete: 0 }, [
    "employeeId",
    "officialEmail",
  ]);

  return rows.some(
    (row) =>
      row.officialEmail &&
      normalizeEmail(row.officialEmail) === email &&
      String(row.employeeId) !== String(excludeId ?? ""),
  );
};

// Employee type / role category / role / departments must exist in this company.
// Inactive ones are only rejected when newly picked (existing employees keep them).
const validateLinks = async (
  companyId: Id,
  links: Links,
  existing?: any,
): Promise<string | null> => {
  if (links.roleId) {
    const rows: any[] = await selectWithJoins(
      "role",
      [],
      { roleId: links.roleId, companyId, delete: 0 },
      ["roleId", "status"],
    );

    if (!rows.length) return "Selected role was not found.";

    const changed = !existing || Number(existing.roleId) !== links.roleId;
    if (changed && rows[0].status !== "Active") {
      return "Selected role is inactive.";
    }
  }

  if (links.branchId) {
    const rows: any[] = await selectWithJoins(
      "branch",
      [],
      { branchId: links.branchId, companyId, delete: 0 },
      ["branchId", "status"],
    );

    if (!rows.length) return "Selected branch was not found.";

    const changed = !existing || Number(existing.branchId) !== links.branchId;
    if (changed && rows[0].status !== "Active") {
      return "Selected branch is inactive.";
    }
  }
  if (links.departmentIds.length) {
    const rows: any[] = await selectWithJoins(
      "department",
      [],
      { departmentId: links.departmentIds, companyId, delete: 0 },
      ["departmentId"],
    );

    if (rows.length !== links.departmentIds.length) {
      return "One or more selected departments were not found.";
    }
  }

  return null;
};

// Employee's additional departments replace karo (purane soft delete, naye insert)
const syncEmployeeDepartments = async (
  companyId: Id,
  employeeId: number,
  departmentIds: number[],
): Promise<void> => {
  await updateModel(
    "employeedepartment",
    { delete: 1 },
    { employeeId, companyId, delete: 0 },
  );

  for (const departmentId of departmentIds) {
    await saveModel("employeedepartment", {
      companyId,
      employeeId,
      departmentId,
      delete: 0,
    });
  }
};

// Unique Employee No (prefix + FY + running number), retry on collision
const generateUniqueEmployeeNo = async (
  companyId: number,
  financialYearId: number,
): Promise<string | null> => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { billNo } = await generateVoucherNo({
      companyId,
      financialYearId,
      tableName: "employee",
      idColumn: "employeeId",
      prefixFor: "EMPLOYEE",
    });

    const existing: any[] = await selectWithJoins(
      "employee",
      [],
      { companyId, financialYearId, employeeNo: billNo, delete: 0 },
      ["employeeId"],
    );

    if (existing.length === 0) return billNo;

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  return null;
};

// ---- Next Employee No (drawer preview) ----
export const getNextEmployeeNo = async (
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

    const employeeNo = await generateUniqueEmployeeNo(
      Number(companyId),
      fy.financialYearId,
    );

    if (!employeeNo) {
      return errorResponse(
        res,
        "Could not generate a unique Employee ID. Please try again.",
      );
    }

    return successResponse(
      res,
      { employeeNo, fyLabel: fy.fyLabel, financialYearId: fy.financialYearId },
      "Employee ID generated successfully",
    );
  } catch (error) {
    return errorResponse(res, "Something Went Wrong", error);
  }
};

const removeOldFile = (oldFile?: string | null): void => {
  if (!oldFile) return;
  fs.unlink(path.join("./Uploadimages", oldFile), (err) => {
    if (err) console.log("Old file delete failed:", err.message);
  });
};

// ---- Create Employee ----
export const createEmployee = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const companyId = await getCompanyIdFromToken(req);

    if (!companyId) {
      return requiredmessage(res, "Unauthorized. Please login again.");
    }

    const body = req.body as EmployeeBody;

    const fy: any = await getFinancialYearById(
      body.financialYearId as any,
      Number(companyId),
    );
    if (!fy) return errorResponse(res, "Invalid Financial Year.");

    const code = normalizeCode(body.employeeCode);
    if (await isCodeTaken(companyId, code)) {
      return requiredmessage(res, "Employee code already exists.");
    }

    // Login needs an email; email must be unique
    const email = normalizeEmail(body.officialEmail);
    if (body.password && !email) {
      return errorResponse(
        res,
        "Official email is required to create a login password.",
      );
    }
    if (email && (await isEmailTaken(email))) {
      return requiredmessage(res, "Official email already exists.");
    }

    const links: Links = {
      roleId: toNumberOrNull(body.roleId),
      branchId: toNumberOrNull(body.branchId),
      departmentIds: parseIds(body.additionalDepartments),
    };

    const linkError = await validateLinks(companyId, links);
    if (linkError) return errorResponse(res, linkError);

    const employeeNo = await generateUniqueEmployeeNo(
      Number(companyId),
      fy.financialYearId,
    );
    if (!employeeNo) {
      return errorResponse(
        res,
        "Could not generate a unique Employee ID. Please try again.",
      );
    }

    const creator = getCreator(req, companyId);
    const passwordHash = body.password
      ? await bcrypt.hash(String(body.password), 10)
      : null;
    const photoFile = (req as any).file as Express.Multer.File | undefined;
    const saved: any = await saveModel("employee", {
      companyId,
      financialYearId: fy.financialYearId,
      employeeNo,
      employeeCode: code,
      employeeName: toText(body.employeeName),
      profilePhoto: photoFile ? "employee_photo/" + photoFile.filename : "",
      officialEmail: email || null,
      password: passwordHash,
      mobileCountryCode: toText(body.mobileCountryCode),
      mobileNumber: toText(body.mobileNumber),
      alternateCountryCode: toText(body.alternateCountryCode),
      alternateContact: toText(body.alternateContact),
      country: toText(body.country),
      state: toText(body.state),
      district: toText(body.district),
      city: toText(body.city),
      address: toText(body.address),
      pinCode: toText(body.pinCode),
      employmentStatus: body.employmentStatus || "Active",
      remarks: toText(body.remarks),
      roleId: links.roleId,
      branchId: links.branchId,
      createdBy: creator.by,
      createdType: creator.type,
      delete: 0,
    });

    if (!saved?.employeeId) {
      return errorResponse(res, "Failed to save employee");
    }

    await syncEmployeeDepartments(
      companyId,
      saved.employeeId,
      links.departmentIds,
    );

    return successResponse(
      res,
      { employeeId: saved.employeeId, employeeNo },
      "Employee created successfully.",
    );
  } catch (error) {
    console.error("createEmployee error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- List Employees (password is never returned) ----
export const getEmployeeList = async (
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
      "employee",
      [],
      { companyId, delete: 0 },
      [
        "employeeId",
        "financialYearId",
        "employeeNo",
        "employeeCode",
        "employeeName",
        "profilePhoto",
        "officialEmail",
        "mobileCountryCode",
        "mobileNumber",
        "alternateCountryCode",
        "alternateContact",
        "country",
        "state",
        "district",
        "city",
        "address",
        "pinCode",
        "employmentStatus",
        "remarks",
        "roleId",
        "branchId",
        "createdBy",
        "createdType",
        "updatedBy",
        "created",
        "updated",
      ],
      [["employeeId", "DESC"]],
    );

    if (!rows.length) {
      return successResponse(res, [], "Employees fetched successfully.");
    }

    // Role names
    const roleRows: any[] = await selectWithJoins(
      "role",
      [],
      { companyId, delete: 0 },
      ["roleId", "roleName"],
    );
    const roleMap: Record<string, string> = {};
    roleRows.forEach((r) => {
      roleMap[String(r.roleId)] = r.roleName;
    });

    // Branch names
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

    // Additional departments (mapping + names)
    const mappingRows: any[] = await selectWithJoins(
      "employeedepartment",
      [],
      { companyId, delete: 0 },
      ["employeeId", "departmentId"],
    );
    const departmentRows: any[] = await selectWithJoins(
      "department",
      [],
      { companyId, delete: 0 },
      ["departmentId", "departmentName"],
    );
    const departmentNameMap: Record<string, string> = {};
    departmentRows.forEach((d) => {
      departmentNameMap[String(d.departmentId)] = d.departmentName;
    });

    const employeeDepartments: Record<string, number[]> = {};
    mappingRows.forEach((m) => {
      const key = String(m.employeeId);
      if (!employeeDepartments[key]) employeeDepartments[key] = [];
      // Delete ho chuke department ko skip karo
      if (departmentNameMap[String(m.departmentId)]) {
        employeeDepartments[key].push(m.departmentId);
      }
    });

    const data = rows.map((r) => {
      const deptIds = employeeDepartments[String(r.employeeId)] || [];

      return {
        id: String(r.employeeId),
        employeeId: r.employeeId,
        financialYearId: r.financialYearId,
        employeeNo: r.employeeNo || "",
        employeeCode: r.employeeCode,
        employeeName: r.employeeName,
        profilePhoto: r.profilePhoto
          ? getBlobTempPublicUrl(r.profilePhoto)
          : "",
        officialEmail: r.officialEmail || "",
        mobileCountryCode: r.mobileCountryCode || "",
        mobileNumber: r.mobileNumber || "",
        alternateCountryCode: r.alternateCountryCode || "",
        alternateContact: r.alternateContact || "",
        country: r.country || "",
        state: r.state || "",
        district: r.district || "",
        city: r.city || "",
        address: r.address || "",
        pinCode: r.pinCode || "",
        employmentStatus: r.employmentStatus,
        remarks: r.remarks || "",
        roleId: r.roleId,
        branchId: r.branchId,
         branchName: r.branchId ? branchMap[String(r.branchId)] || "" : "",
        roleName: r.roleId ? roleMap[String(r.roleId)] || "" : "",
        additionalDepartments: deptIds,
        additionalDepartmentNames: deptIds.map(
          (id) => departmentNameMap[String(id)] || "",
        ),
        hasLogin: Boolean(r.officialEmail),
        createdBy: r.createdBy || "",
        createdType: r.createdType || "",
        updatedBy: r.updatedBy || "",
        created: r.created,
        updated: r.updated,
      };
    });

    return successResponse(res, data, "Employees fetched successfully.");
  } catch (error) {
    console.error("getEmployeeList error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Update Employee (also used for Activate / Deactivate) ----
export const updateEmployee = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const companyId = await getCompanyIdFromToken(req);

    if (!companyId) {
      return requiredmessage(res, "Unauthorized. Please login again.");
    }

    const body = req.body as EmployeeBody;
    const employeeId = Number(body.employeeId);

    const existingRows: any[] = await selectWithJoins(
      "employee",
      [],
      { employeeId, companyId, delete: 0 },
      [
        "employeeId",
        "roleId",
        "branchId",
        "profilePhoto",
      ],
    );
    if (!existingRows.length)
      return requiredmessage(res, "Employee not found.");

    const code = normalizeCode(body.employeeCode);
    if (await isCodeTaken(companyId, code, employeeId)) {
      return requiredmessage(res, "Employee code already exists.");
    }

    const email = normalizeEmail(body.officialEmail);
    if (body.password && !email) {
      return errorResponse(
        res,
        "Official email is required to create a login password.",
      );
    }
    if (email && (await isEmailTaken(email, employeeId))) {
      return requiredmessage(res, "Official email already exists.");
    }

    const links: Links = {
      roleId: toNumberOrNull(body.roleId),
      branchId: toNumberOrNull(body.branchId),
      departmentIds: parseIds(body.additionalDepartments),
    };

    const linkError = await validateLinks(companyId, links, existingRows[0]);
    if (linkError) return errorResponse(res, linkError);

    const creator = getCreator(req, companyId);

    // employeeNo, financialYearId, createdBy are not changed on update
    const updatePayload: Record<string, any> = {
      employeeCode: code,
      employeeName: toText(body.employeeName),
      officialEmail: email || null,
      mobileCountryCode: toText(body.mobileCountryCode),
      mobileNumber: toText(body.mobileNumber),
      alternateCountryCode: toText(body.alternateCountryCode),
      alternateContact: toText(body.alternateContact),
      country: toText(body.country),
      state: toText(body.state),
      district: toText(body.district),
      city: toText(body.city),
      address: toText(body.address),
      pinCode: toText(body.pinCode),
      employmentStatus: body.employmentStatus || "Active",
      remarks: toText(body.remarks),
      roleId: links.roleId,
      branchId: links.branchId,
      updatedBy: creator.by,
      updated: new Date(),
    };

    // Only touch the photo when a new one is sent
    const photoFile = (req as any).file as Express.Multer.File | undefined;
    if (photoFile) {
      updatePayload.profilePhoto = "employee_photo/" + photoFile.filename;
      removeOldFile(existingRows[0].profilePhoto);
    }

    // Only change the password when a new one was typed
    if (body.password) {
      updatePayload.password = await bcrypt.hash(String(body.password), 10);
    }

    await updateModel("employee", updatePayload, { employeeId, companyId });

    await syncEmployeeDepartments(companyId, employeeId, links.departmentIds);

    return successResponse(res, {}, "Employee updated successfully.");
  } catch (error) {
    console.error("updateEmployee error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Delete Employee (soft delete) ----
export const deleteEmployee = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const companyId = await getCompanyIdFromToken(req);

    if (!companyId) {
      return requiredmessage(res, "Unauthorized. Please login again.");
    }

    const employeeId = Number(
      req.body?.employeeId ?? (req.query as any)?.employeeId,
    );

    if (!employeeId || isNaN(employeeId)) {
      return requiredmessage(res, "Employee id is required.");
    }

    const existing: any[] = await selectWithJoins(
      "employee",
      [],
      { employeeId, companyId, delete: 0 },
      ["employeeId"],
    );
    if (!existing.length) return requiredmessage(res, "Employee not found.");

    await updateModel(
      "employee",
      { delete: 1, updated: new Date() },
      { employeeId, companyId },
    );

    await updateModel(
      "employeedepartment",
      { delete: 1 },
      { employeeId, companyId, delete: 0 },
    );

    return successResponse(res, {}, "Employee deleted successfully.");
  } catch (error) {
    console.error("deleteEmployee error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};
