import { DataTypes, Sequelize, ModelAttributes, ModelOptions } from "sequelize";

export default (sequelize: Sequelize) => {
  const attributes: ModelAttributes = {
    ticketCategoryId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
      field: "ticketCategoryId",
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

    // Auto number (prefix + FY + running no.) and manually typed code
    ticketCategoryNo: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: "ticketCategoryNo",
    },
    categoryCode: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: "categoryCode",
    },
    categoryName: {
      type: DataTypes.STRING(150),
      allowNull: false,
      field: "categoryName",
    },
    description: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: "description",
    },

    departmentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "departmentId",
    },
    defaultResolverTeamId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "defaultResolverTeamId",
    },

    displayOrder: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "displayOrder",
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "Active", // "Active" | "Inactive"
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
    tableName: "ticketcategory",
    comment: "Ticket categories (Hardware Issue, Software Issue, ...)",
    indexes: [{ fields: ["companyId", "categoryCode"] }],
  };

  const TicketCategoryModel = sequelize.define(
    "ticketcategory",
    attributes,
    options,
  );
  return TicketCategoryModel;
};
