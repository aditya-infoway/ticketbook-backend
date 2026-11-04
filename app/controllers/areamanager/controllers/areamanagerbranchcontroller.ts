import { Request, Response } from "express";

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

const BRANCH_COLUMNS = [
  "branchId",
  "branchNo",
  "branchCode",
  "branchName",
  "profilePhoto",
  "regionId",
  "country",
  "state",
  "city",
  "fullAddress",
  "pinCode",
  "contactNumber",
  "phoneNumber",
  "branchEmail",
  "openingDate",
  "workingHours",
  "status",
  "created",
  "updated",
];

// shapes a branch row like the Branch type the pages already use
const loadLookups = async (companyId: number, areaManagerId: number) => {
  const regionRows: any[] = await selectWithJoins(
    "region",
    [],
    { companyId, delete: 0 },
    ["regionId", "regionName"],
  );
  const regionMap: Record<string, string> = {};
  regionRows.forEach((r) => {
    regionMap[String(r.regionId)] = r.regionName || "";
  });

  // branch manager of each branch comes from the branchmanager table
  const managerRows: any[] = await selectWithJoins(
    "branchmanager",
    [],
    { companyId, delete: 0 },
    ["branchId", "name"],
  );
  const managerMap: Record<string, string> = {};
  managerRows.forEach((m) => {
    managerMap[String(m.branchId)] = m.name;
  });

  const me: any[] = await selectWithJoins(
    "areamanager",
    [],
    { areaManagerId, companyId, delete: 0 },
    ["areaManagerId", "name"],
  );

  return { regionMap, managerMap, areaManagerName: me[0]?.name || "" };
};

const toBranchRow = (
  r: any,
  lookups: Awaited<ReturnType<typeof loadLookups>>,
) => ({
  id: String(r.branchId),
  branchId: r.branchNo || String(r.branchId), // shown as "Branch ID"
  branchCode: r.branchCode,
  branchName: r.branchName,
  regionId: r.regionId ? String(r.regionId) : "",
  region: lookups.regionMap[String(r.regionId)] || "",
  country: r.country || "India",
  state: r.state || "",
  city: r.city || "",
  contactNumber: r.contactNumber || "",
  phoneNumber: r.phoneNumber || "",
  email: r.branchEmail || "",
  branchManager: lookups.managerMap[String(r.branchId)] || "",
  areaManager: lookups.areaManagerName,
  openingDate: r.openingDate || "",
  workingHours: r.workingHours || "",
  status: r.status,
  postalCode: r.pinCode || "",
  fullAddress: r.fullAddress || "",
  profilePhoto: r.profilePhoto ? getBlobTempPublicUrl(r.profilePhoto) : "",
  createdAt: r.created,
  updatedAt: r.updated,
});

// ---- Branches assigned to this area manager ----
// GET area-manager/branch/list     Query: region, status, city
export const getAreaManagerBranchList = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const ctx = getContext(req);
    if (!ctx) return requiredmessage(res, "Area manager not found.");

    const { companyId, areaManagerId } = ctx;
    const q = req.query as Record<string, string | undefined>;

    const rows: any[] = await selectWithJoins(
      "branch",
      [],
      { companyId, areaManagerId, delete: 0 },
      BRANCH_COLUMNS,
      [["branchId", "DESC"]],
    );

    const lookups = await loadLookups(companyId, areaManagerId);

    const wantRegion = (q.region || "").trim().toLowerCase();
    const wantCity = (q.city || "").trim().toLowerCase();

    const data = rows
      .filter((r) => {
        if (q.status && r.status !== q.status) return false;
        if (
          wantCity &&
          String(r.city || "")
            .trim()
            .toLowerCase() !== wantCity
        ) {
          return false;
        }
        if (wantRegion) {
          const name = String(
            lookups.regionMap[String(r.regionId)] || "",
          ).toLowerCase();
          if (String(r.regionId) !== wantRegion && name !== wantRegion)
            return false;
        }
        return true;
      })
      .map((r) => toBranchRow(r, lookups));

    return successResponse(res, data, "Branches fetched successfully.");
  } catch (error) {
    console.error("getAreaManagerBranchList error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Filter dropdowns (only values from this manager's branches) ----
// GET area-manager/branch/form-data
export const getAreaManagerBranchFormData = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const ctx = getContext(req);
    if (!ctx) return requiredmessage(res, "Area manager not found.");

    const { companyId, areaManagerId } = ctx;

    const rows: any[] = await selectWithJoins(
      "branch",
      [],
      { companyId, areaManagerId, delete: 0 },
      ["branchId", "regionId", "city"],
    );

    const regionMap = (await loadLookups(companyId, areaManagerId)).regionMap;

    const regionIds = [
      ...new Set(
        rows.map((r) => String(r.regionId)).filter((id) => regionMap[id]),
      ),
    ];
    const cities = [
      ...new Set(rows.map((r) => String(r.city || "").trim()).filter(Boolean)),
    ].sort();

    return successResponse(
      res,
      {
        regions: regionIds.map((id) => ({ id, label: regionMap[id] })),
        cities: cities.map((c) => ({ id: c, label: c })),
        statuses: [
          { id: "Active", label: "Active" },
          { id: "Inactive", label: "Inactive" },
        ],
      },
      "Form data fetched successfully.",
    );
  } catch (error) {
    console.error("getAreaManagerBranchFormData error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- One branch (only if it is assigned to this area manager) ----
// GET area-manager/branch/:id
export const getAreaManagerBranchDetail = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const ctx = getContext(req);
    if (!ctx) return requiredmessage(res, "Area manager not found.");

    const { companyId, areaManagerId } = ctx;
    const branchId = Number(req.params.id);
    if (!branchId) return errorResponse(res, "Invalid branch id.");

    const rows: any[] = await selectWithJoins(
      "branch",
      [],
      { branchId, companyId, areaManagerId, delete: 0 },
      BRANCH_COLUMNS,
    );
    if (!rows.length) return errorResponse(res, "Branch not found.");

    const lookups = await loadLookups(companyId, areaManagerId);

    return successResponse(
      res,
      toBranchRow(rows[0], lookups),
      "Branch fetched successfully.",
    );
  } catch (error) {
    console.error("getAreaManagerBranchDetail error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};
