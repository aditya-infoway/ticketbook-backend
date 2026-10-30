import { DataTypes, Sequelize, ModelAttributes, ModelOptions } from "sequelize";

export default (sequelize: Sequelize) => {
  const attributes: ModelAttributes = {
    contractorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
      field: "contractorId",
    },
    profilePhoto: {
  type: DataTypes.STRING(255),
  allowNull: true,
  field: "profilePhoto",
},
    companyId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "companyId",
    },
    financialYearId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "financialYearId",
    },

    contractorNo: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: "contractorNo",
    },

    contractorName: {
      type: DataTypes.STRING(150),
      allowNull: false,
      field: "contractorName",
    },
    companyName: {
      type: DataTypes.STRING(150),
      allowNull: true,
      field: "companyName",
    },
    mobileNumber: {
      type: DataTypes.STRING(20),
      allowNull: false,
      field: "mobileNumber",
    },
    email: { type: DataTypes.STRING(150), allowNull: true, field: "email" },
    specialization: {
      type: DataTypes.STRING(150),
      allowNull: true,
      field: "specialization",
    },
    address: { type: DataTypes.STRING(500), allowNull: true, field: "address" },

    // Area = region table
    areaId: { type: DataTypes.INTEGER, allowNull: false, field: "areaId" },
    branchId: { type: DataTypes.INTEGER, allowNull: false, field: "branchId" },

    contractorDepartmentId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "contractorDepartmentId",
    },

    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "password",
    }, // bcrypt hash
    // JSON array of stored file paths, e.g. ["Uploadimages/contractor/x.pdf"]
    documents: { type: DataTypes.TEXT, allowNull: true, field: "documents" },

    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "Active", // "Active" | "Inactive"
      field: "status",
    },
token: {
  type: DataTypes.TEXT,
  allowNull: true,
},
tokenDate: {
  type: DataTypes.STRING,
  allowNull: true,
},
    // Audit
    createdBy: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: "createdBy",
    },
    createdType: {
      type: DataTypes.STRING(30),
      allowNull: true,
      field: "createdType",
    },
    updatedBy: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: "updatedBy",
    },

    created: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    delete: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "delete",
    },
  };

  const options: ModelOptions = {
    tableName: "contractor",
    comment: "Registered contractors",
    indexes: [
      { fields: ["companyId", "contractorNo"] },
      { fields: ["companyId", "mobileNumber"] },
      { fields: ["companyId", "areaId"] },
      { fields: ["companyId", "branchId"] },
    ],
  };

  return sequelize.define("contractor", attributes, options);
};
