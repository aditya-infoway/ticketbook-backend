import { DataTypes, Sequelize, ModelAttributes, ModelOptions } from "sequelize";

export default (sequelize: Sequelize) => {
  const attributes: ModelAttributes = {
    ticketId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
      field: "ticketId",
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

    // Auto number (prefix + FY + running no.)
    ticketNo: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: "ticketNo",
    },

    // Company-prefix based number (TKT-01, TKT-02 ...)
    ticketCode: {
      // ← ADD THIS
      type: DataTypes.STRING(50),
      allowNull: true,
      field: "ticketCode",
    },

    employeeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "employeeId",
    },
    branchId: { type: DataTypes.INTEGER, allowNull: true, field: "branchId" },
    departmentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "departmentId",
    },
    ticketCategoryId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "ticketCategoryId",
    },

    subject: {
      type: DataTypes.STRING(200),
      allowNull: false,
      field: "subject",
    },
    issueDescription: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: "issueDescription",
    },
    attachment: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: "attachment",
    },
    contactNumber: {
      type: DataTypes.STRING(30),
      allowNull: true,
      field: "contactNumber",
    },

    ticketStatusId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "ticketStatusId",
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
    tableName: "ticket",
    comment: "Tickets raised by employees",
    indexes: [
      { fields: ["companyId", "ticketNo"] },
      { fields: ["companyId", "ticketCode"] }, // ← added
      { fields: ["companyId", "employeeId"] },
    ],
  };

  return sequelize.define("ticket", attributes, options);
};
