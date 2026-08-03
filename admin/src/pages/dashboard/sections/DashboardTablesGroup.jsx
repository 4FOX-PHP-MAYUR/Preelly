import React from 'react'
import {
  PackagePurchasesTable,
  RecentProductsTable,
  RecentTransactionsTable,
  RecentUsersTable,
  TopBuyersTable,
  TopSellersTable,
  TrendingProductsTable,
} from './DashboardTables'

/**
 * The dashboard's table stack, in the order an admin works through them:
 * what's hot → what just happened → who is driving it.
 *
 * Split into its own chunk so the tables (and their eight paginated requests)
 * only load once the reader scrolls this far.
 */
function DashboardTablesGroup({ filters, currency }) {
  return (
    <div className="space-y-4 sm:space-y-5">
      <TrendingProductsTable filters={filters} currency={currency} />
      <RecentTransactionsTable filters={filters} currency={currency} />

      <div className="grid grid-cols-1 gap-4 sm:gap-5 2xl:grid-cols-2">
        <RecentUsersTable filters={filters} />
        <RecentProductsTable filters={filters} currency={currency} />
      </div>

      <PackagePurchasesTable filters={filters} currency={currency} />

      <div className="grid grid-cols-1 gap-4 sm:gap-5 2xl:grid-cols-2">
        <TopSellersTable filters={filters} currency={currency} />
        <TopBuyersTable filters={filters} currency={currency} />
      </div>
    </div>
  )
}

export default DashboardTablesGroup
