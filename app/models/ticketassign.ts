import { DataTypes, Sequelize, ModelAttributes, ModelOptions } from "sequelize";

export default (sequelize: Sequelize) => {
  const attributes: ModelAttributes = {
    ticketAssignId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
      field: "ticketAssignId",
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

    ticketAssignNo: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: "ticketAssignNo",
    },

    ticketId: { type: DataTypes.INTEGER, allowNull: false, field: "ticketId" },
    branchId: { type: DataTypes.INTEGER, allowNull: false, field: "branchId" },
    contractorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "contractorId",
    },
    employeeId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "employeeId",
    },
    // Snapshot of the contractor's department at assign time
    contractorDepartmentId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "contractorDepartmentId",
    },

    assignedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "assignedAt",
    },
    remarks: { type: DataTypes.STRING(500), allowNull: true, field: "remarks" },

    // "Active" = current assignment, "Reassigned" = replaced by a newer one
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "Active",
      field: "status",
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
    tableName: "ticketassign",
    comment: "Ticket to contractor assignments (branch panel)",
    indexes: [
      { fields: ["companyId", "ticketAssignNo"] },
      { fields: ["companyId", "ticketId"] },
      { fields: ["companyId", "contractorId"] },
    ],
  };

  return sequelize.define("ticketassign", attributes, options);
};
