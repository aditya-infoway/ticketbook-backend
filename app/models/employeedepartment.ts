import { DataTypes, Sequelize, ModelAttributes, ModelOptions } from "sequelize";

export default (sequelize: Sequelize) => {
  const attributes: ModelAttributes = {
    employeeDepartmentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
      field: "employeeDepartmentId",
    },
    companyId: { type: DataTypes.INTEGER, allowNull: false, field: "companyId" },
    employeeId: { type: DataTypes.INTEGER, allowNull: false, field: "employeeId" },
    departmentId: { type: DataTypes.INTEGER, allowNull: false, field: "departmentId" },

    created: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    delete: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "delete" },
  };

  const options: ModelOptions = {
    tableName: "employeedepartment",
    comment: "Employee -> additional departments mapping",
    indexes: [{ fields: ["companyId", "employeeId"] }],
  };

  const EmployeeDepartmentModel = sequelize.define(
    "employeedepartment",
    attributes,
    options,
  );
  return EmployeeDepartmentModel;
};