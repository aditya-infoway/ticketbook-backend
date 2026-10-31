import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import * as fs from "fs";
import * as path from "path";
import "multer";

import {
  errorResponse,
  successResponse,
  requiredmessage,
  updateModel,
  selectWithJoins,
  getBlobTempPublicUrl,
} from "../../../helper/index";

const toText = (v: unknown): string =>
  v === undefined || v === null ? "" : String(v).trim();
const getMyId = (req: Request): number => Number((req as any).employeeId) || 0;

const isContractorReq = (req: Request): boolean => !!(req as any).isContractor;
const getContractorId = (req: Request): number =>
  Number((req as any).contractorId) || 0;

const removeOldFile = (oldFile?: string | null): void => {
  if (!oldFile) return;
  fs.unlink(path.join("./Uploadimages", oldFile), (err) => {
    if (err) console.log("Old file delete failed:", err.message);
  });
};

// ---- My profile ----
export const getMyProfile = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    // ---------- Contractor ----------
    if (isContractorReq(req)) {
      const contractorId = getContractorId(req);
      if (!contractorId)
        return requiredmessage(res, "Unauthorized. Please login again.");

      const cRows: any[] = await selectWithJoins(
        "contractor",
        [],
        { contractorId, delete: 0 },
        [
          "contractorNo",
          "contractorName",
          "companyId",
          "mobileNumber",
          "email",
          "specialization",
          "address",
          "areaId",
          "branchId",
          "status",
            "profilePhoto", 
        ],
      );
      if (!cRows.length) return requiredmessage(res, "Contractor not found.");
      const c = cRows[0];

      const branches: any[] = await selectWithJoins(
        "branch",
        [],
        { branchId: c.branchId, companyId: c.companyId, delete: 0 },
        ["branchName"],
      );
      const regions: any[] = await selectWithJoins(
        "region",
        [],
        { regionId: c.areaId, companyId: c.companyId, delete: 0 },
        ["regionName"],
      );

      return successResponse(
        res,
        {
          employeeNo: c.contractorNo || "",
          employeeCode: c.contractorNo || "",
          employeeName: c.contractorName || "",
      profilePhoto: c.profilePhoto ? getBlobTempPublicUrl(c.profilePhoto) : "",
          officialEmail: c.email || "",
          mobileCountryCode: "91",
          mobileNumber: c.mobileNumber || "",
          alternateCountryCode: "91",
          alternateContact: "",
          employeeTypeName: "Contractor",
          roleName: "contractor",
          departmentName: "",
          dateOfJoining: "",
          employmentStatus: c.status || "",
          specialization: c.specialization || "",
          address: c.address || "",
          areaName: regions[0]?.regionName || "",
          branchName: branches[0]?.branchName || "",
        },
        "Profile fetched successfully.",
      );
    }

    // ---------- Employee (pehle jaisa) ----------
    const employeeId = getMyId(req);
    if (!employeeId)
      return requiredmessage(res, "Unauthorized. Please login again.");

    const rows: any[] = await selectWithJoins(
      "employee",
      [],
      { employeeId, delete: 0 },
      [
        "employeeId",
        "companyId",
        "employeeNo",
        "employeeCode",
        "employeeName",
        "profilePhoto",
        "officialEmail",
        "mobileCountryCode",
        "mobileNumber",
        "alternateCountryCode",
        "alternateContact",
        "employeeTypeId",
        "roleId",
        "dateOfJoining",
        "employmentStatus",
      ],
    );

    if (!rows.length) return requiredmessage(res, "Employee not found.");
    const r = rows[0];

    const types: any[] = r.employeeTypeId
      ? await selectWithJoins(
          "employeetype",
          [],
          {
            employeeTypeId: r.employeeTypeId,
            companyId: r.companyId,
            delete: 0,
          },
          ["typeName"],
        )
      : [];
    const roles: any[] = r.roleId
      ? await selectWithJoins(
          "role",
          [],
          { roleId: r.roleId, companyId: r.companyId, delete: 0 },
          ["roleName"],
        )
      : [];
    // Departments (employeedepartment mapping + names)
    const mapRows: any[] = await selectWithJoins(
      "employeedepartment",
      [],
      { employeeId, companyId: r.companyId, delete: 0 },
      ["departmentId"],
    );
    const deptIds = mapRows.map((m) => m.departmentId);
    const deptRows: any[] = deptIds.length
      ? await selectWithJoins(
          "department",
          [],
          { departmentId: deptIds, companyId: r.companyId, delete: 0 },
          ["departmentId", "departmentName"],
        )
      : [];
    return successResponse(
      res,
      {
        employeeNo: r.employeeNo || "",
        employeeCode: r.employeeCode || "",
        employeeName: r.employeeName || "",
        profilePhoto: r.profilePhoto
          ? getBlobTempPublicUrl(r.profilePhoto)
          : "",
        officialEmail: r.officialEmail || "",
        mobileCountryCode: r.mobileCountryCode || "91",
        mobileNumber: r.mobileNumber || "",
        alternateCountryCode: r.alternateCountryCode || "91",
        alternateContact: r.alternateContact || "",
        employeeTypeName: types[0]?.typeName || "",
        roleName: roles[0]?.roleName || "",
        departmentName: deptRows.map((d) => d.departmentName).join(", "),
        dateOfJoining: r.dateOfJoining || "",
        employmentStatus: r.employmentStatus || "",
      },
      "Profile fetched successfully.",
    );
  } catch (error) {
    console.error("getMyProfile error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Update my profile (name, phones, photo, password only) ----
export const updateMyProfile = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    // ---------- Contractor ----------
    if (isContractorReq(req)) {
      const contractorId = getContractorId(req);
      if (!contractorId)
        return requiredmessage(res, "Unauthorized. Please login again.");

      const cBody = req.body as Record<string, any>;

      const cExisting: any[] = await selectWithJoins(
        "contractor",
        [],
        { contractorId, delete: 0 },
      ["contractorId", "password", "profilePhoto"],
      );
      if (!cExisting.length)
        return requiredmessage(res, "Contractor not found.");

      const cName = toText(cBody.employeeName);
      if (!cName) return errorResponse(res, "Name is required.");

      const cMobile = toText(cBody.mobileNumber);
      if (cMobile && !/^[0-9]{6,15}$/.test(cMobile))
        return errorResponse(res, "Mobile number must be 6-15 digits.");

      const cPayload: Record<string, any> = {
        contractorName: cName,
        mobileNumber: cMobile,
        updatedBy: String(contractorId),
        updated: new Date(),
      };

      if (cBody.newPassword) {
        if (String(cBody.newPassword).length < 6)
          return errorResponse(
            res,
            "New password must be at least 6 characters.",
          );
        if (cBody.newPassword !== cBody.confirmPassword)
          return errorResponse(res, "Passwords do not match.");
        const ok = cExisting[0].password
          ? await bcrypt.compare(
              String(cBody.currentPassword || ""),
              cExisting[0].password,
            )
          : false;
        if (!ok) return errorResponse(res, "Current password is incorrect.");
        cPayload.password = await bcrypt.hash(String(cBody.newPassword), 10);
      }
const cPhoto = (req as any).file as Express.Multer.File | undefined;
if (cPhoto) {
  cPayload.profilePhoto = "employee_photo/" + cPhoto.filename;
  removeOldFile(cExisting[0].profilePhoto);
}
      await updateModel("contractor", cPayload, { contractorId });
      return successResponse(res, {}, "Profile updated successfully.");
    }

    // ---------- Employee (pehle jaisa) ----------
    const employeeId = getMyId(req);

    if (!employeeId)
      return requiredmessage(res, "Unauthorized. Please login again.");

    const body = req.body as Record<string, any>;

    const existing: any[] = await selectWithJoins(
      "employee",
      [],
      { employeeId, delete: 0 },
      ["employeeId", "profilePhoto", "password"],
    );
    if (!existing.length) return requiredmessage(res, "Employee not found.");

    const name = toText(body.employeeName);
    if (!name) return errorResponse(res, "Employee name is required.");

    const mobile = toText(body.mobileNumber);
    const alt = toText(body.alternateContact);
    if (mobile && !/^[0-9]{6,15}$/.test(mobile))
      return errorResponse(res, "Mobile number must be 6-15 digits.");
    if (alt && !/^[0-9]{6,15}$/.test(alt))
      return errorResponse(res, "Alternate number must be 6-15 digits.");

    const payload: Record<string, any> = {
      employeeName: name,
      mobileCountryCode: toText(body.mobileCountryCode),
      mobileNumber: mobile,
      alternateCountryCode: toText(body.alternateCountryCode),
      alternateContact: alt,
      updatedBy: String(employeeId),
      updated: new Date(),
    };

    // Password change: purana password sahi hona chahiye
    if (body.newPassword) {
      if (String(body.newPassword).length < 6)
        return errorResponse(
          res,
          "New password must be at least 6 characters.",
        );
      if (body.newPassword !== body.confirmPassword)
        return errorResponse(res, "Passwords do not match.");
      const ok = existing[0].password
        ? await bcrypt.compare(
            String(body.currentPassword || ""),
            existing[0].password,
          )
        : false;
      if (!ok) return errorResponse(res, "Current password is incorrect.");
      payload.password = await bcrypt.hash(String(body.newPassword), 10);
    }

    const photoFile = (req as any).file as Express.Multer.File | undefined;
    if (photoFile) {
      payload.profilePhoto = "employee_photo/" + photoFile.filename;
      removeOldFile(existing[0].profilePhoto);
    }

    await updateModel("employee", payload, { employeeId });
    return successResponse(res, {}, "Profile updated successfully.");
  } catch (error) {
    console.error("updateMyProfile error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};
