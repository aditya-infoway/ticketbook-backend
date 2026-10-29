import { DataTypes, Sequelize, ModelAttributes, ModelOptions } from "sequelize";

export default (sequelize: Sequelize) => {
  const attributes: ModelAttributes = {
    ticketStatusId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
      field: "ticketStatusId",
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

    // Auto number (prefix + FY + running no.) – shown as "Status ID (Auto)"
    ticketStatusNo: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: "ticketStatusNo",
    },

    statusCode: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: "statusCode",
    },
    statusName: {
      type: DataTypes.STRING(150),
      allowNull: false,
      field: "statusName",
    },
    description: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: "description",
    },

    displayOrder: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "displayOrder",
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "Active",
      field: "status",
    },

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
    tableName: "ticketstatus",
    comment: "Ticket Status Master",
    indexes: [{ fields: ["companyId", "statusCode"] }],
  };

  return sequelize.define("ticketstatus", attributes, options);
};
