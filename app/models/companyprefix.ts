import { DataTypes, Model, Sequelize } from "sequelize";

export interface CompanyPrefixAttributes {
  prefixId?: number;
  companyId: number;
  prefixFor: string;
  prefix: string;
  created?: Date;
  updated?: Date;
  delete?: number;
}

class CompanyPrefix
  extends Model<CompanyPrefixAttributes>
  implements CompanyPrefixAttributes
{
  declare prefixId: number;
  declare companyId: number;
  declare prefixFor: string;
  declare prefix: string;
  declare created: Date;
  declare updated: Date;
  declare delete: number;
}

export default function defineCompanyPrefix(sequelize: Sequelize) {
  CompanyPrefix.init(
    {
      prefixId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
        field: "prefixId",
      },

      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "companyId",
      },

      prefixFor: {
        type: DataTypes.STRING(50),
        allowNull: false,
        field: "prefixFor",
      },

      prefix: {
        type: DataTypes.STRING(20),
        allowNull: false,
        field: "prefix",
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
    },
    {
      sequelize,
      modelName: "companyprefix",
      tableName: "companyprefix",
      comment: "",
      indexes: [
        {
          unique: true,
          fields: ["companyId", "prefixFor", "delete"],
          name: "uniq_company_prefixfor",
        },
      ],
    },
  );

  return CompanyPrefix;
}