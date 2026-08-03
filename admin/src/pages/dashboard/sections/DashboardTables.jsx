import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, ExternalLink } from 'lucide-react'
import Panel from '../../../components/AdminUI/Panel'
import DataTable from '../../../components/AdminUI/DataTable'
import StatusBadge from '../../../components/AdminUI/StatusBadge'
import Select from '../../../components/AdminUI/Select'
import Button from '../../../components/AdminUI/Button'
import { getMediaUrl } from '@shared/utils/helpers'
import { formatCurrency, formatNumber } from '../../../components/AdminUI/charts'
import { useDashboardTable } from '../useDashboard'
import { TRENDING_SORT_OPTIONS, formatDate } from '../dashboardConstants'

/**
 * The dashboard's data tables.
 *
 * Each one is server-paginated through `/api/admin/dashboard/tables/:table` and
 * reuses the shared `DataTable`, so pagination, mobile cards, loading and empty
 * states behave exactly as they do on every listing page.
 */

function TableShell({ title, subtitle, action, children }) {
  return (
    <Panel padding={false} className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-white sm:text-base">
            {title}
          </h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </Panel>
  )
}

function ProductThumb({ image, video }) {
  return (
    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
      {video ? (
        <video src={getMediaUrl(video)} className="h-full w-full object-cover" muted playsInline />
      ) : (
        <img
          src={getMediaUrl(image) || '/placeholder.jpg'}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
        />
      )}
    </div>
  )
}

/** Trending products, sortable by the metric the admin cares about. */
export function TrendingProductsTable({ filters, currency }) {
  const navigate = useNavigate()
  const [sort, setSort] = useState('views')
  const { data, loading, page, setPage, limit } = useDashboardTable('trending-products', filters, { sort })

  const columns = [
    {
      key: 'product',
      title: 'Product',
      render: (row) => (
        <div className="flex min-w-0 items-center gap-3">
          <ProductThumb image={row.image} video={row.video} />
          <div className="min-w-0">
            <p className="max-w-[220px] truncate font-medium text-slate-900 dark:text-white">{row.title}</p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{row.category}</p>
          </div>
        </div>
      ),
    },
    { key: 'seller', title: 'Seller', render: (row) => row.seller },
    { key: 'views', title: 'Views', render: (row) => formatNumber(row.views) },
    { key: 'favorites', title: 'Favorites', render: (row) => formatNumber(row.favorites) },
    { key: 'chats', title: 'Chats', render: (row) => formatNumber(row.chats) },
    {
      key: 'offers',
      title: 'Offers',
      render: () => <span className="text-xs text-slate-400 dark:text-slate-500">n/a</span>,
    },
    { key: 'totalInquiries', title: 'Inquiries', render: (row) => formatNumber(row.totalInquiries) },
    { key: 'totalSales', title: 'Sales', render: (row) => formatNumber(row.totalSales) },
    {
      key: 'revenue',
      title: 'Revenue',
      render: (row) => (
        <span className="font-semibold tabular-nums">{formatCurrency(row.revenue, currency, true)}</span>
      ),
    },
  ]

  return (
    <TableShell
      title="Trending Products"
      subtitle="Offers are not recorded in this schema, so that column reads n/a"
      action={
        <Select
          aria-label="Sort trending products"
          value={sort}
          onChange={(event) => setSort(event.target.value)}
          options={TRENDING_SORT_OPTIONS}
          className="min-w-[11rem]"
        />
      }
    >
      <DataTable
        columns={columns}
        data={data?.items || []}
        loading={loading}
        showSearch={false}
        emptyTitle="No trending products"
        emptyDescription="No product activity in the selected range."
        onRowClick={(row) => navigate(`/products/${row.productId}`)}
        customActions={(row) => (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              navigate(`/products/${row.productId}`)
            }}
            className="admin-table-action text-slate-500 dark:text-slate-400"
            title="View product"
            aria-label={`View ${row.title}`}
          >
            <Eye className="h-4 w-4" />
          </button>
        )}
        mobileCardRender={(row) => (
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <ProductThumb image={row.image} video={row.video} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-900 dark:text-white">{row.title}</p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {row.category} · {row.seller}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <Metric label="Views" value={formatNumber(row.views)} />
              <Metric label="Favorites" value={formatNumber(row.favorites)} />
              <Metric label="Chats" value={formatNumber(row.chats)} />
              <Metric label="Sales" value={formatNumber(row.totalSales)} />
              <Metric label="Revenue" value={formatCurrency(row.revenue, currency, true)} />
            </div>
          </div>
        )}
        pagination={{ page, limit, total: data?.total || 0, onPageChange: setPage }}
        serverSide
      />
    </TableShell>
  )
}

export function RecentTransactionsTable({ filters, currency }) {
  const navigate = useNavigate()
  const { data, loading, page, setPage, limit } = useDashboardTable('recent-transactions', filters)

  const columns = [
    {
      key: 'orderId',
      title: 'Transaction',
      render: (row) => (
        <div className="min-w-0">
          <p className="font-mono text-xs font-semibold text-slate-900 dark:text-white">{row.orderId}</p>
          <p className="truncate font-mono text-[11px] text-slate-400">{row.transactionId}</p>
        </div>
      ),
    },
    { key: 'buyer', title: 'Buyer', render: (row) => row.buyer },
    { key: 'seller', title: 'Seller', render: (row) => row.seller },
    { key: 'product', title: 'Product', render: (row) => row.product },
    { key: 'package', title: 'Package', render: (row) => row.package },
    { key: 'paymentType', title: 'Payment Type', render: (row) => row.paymentType },
    {
      key: 'amount',
      title: 'Amount',
      render: (row) => (
        <span className="font-semibold tabular-nums">{formatCurrency(row.amount, row.currency)}</span>
      ),
    },
    { key: 'gateway', title: 'Gateway', render: (row) => row.gateway },
    {
      key: 'status',
      title: 'Status',
      render: (row) => <StatusBadge status={row.statusBadge} label={row.status} />,
    },
    { key: 'date', title: 'Date', render: (row) => formatDate(row.date, true) },
  ]

  return (
    <TableShell
      title="Recent Transactions"
      action={
        <Button variant="secondary" size="sm" icon={ExternalLink} onClick={() => navigate('/transactions')}>
          All transactions
        </Button>
      }
    >
      <DataTable
        columns={columns}
        data={data?.items || []}
        loading={loading}
        showSearch={false}
        emptyTitle="No transactions"
        emptyDescription="No payments in the selected range."
        onRowClick={(row) => navigate(`/transactions/${row.id}`)}
        customActions={(row) => (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              navigate(`/transactions/${row.id}`)
            }}
            className="admin-table-action text-slate-500 dark:text-slate-400"
            title="View details"
            aria-label={`View transaction ${row.orderId}`}
          >
            <Eye className="h-4 w-4" />
          </button>
        )}
        mobileCardRender={(row) => (
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 truncate font-mono text-xs font-semibold text-slate-900 dark:text-white">
                {row.orderId}
              </p>
              <StatusBadge status={row.statusBadge} label={row.status} />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Metric label="Buyer" value={row.buyer} />
              <Metric label="Seller" value={row.seller} />
              <Metric label="Amount" value={formatCurrency(row.amount, row.currency)} />
              <Metric label="Gateway" value={row.gateway} />
              <Metric label="Date" value={formatDate(row.date, true)} />
            </div>
          </div>
        )}
        pagination={{ page, limit, total: data?.total || 0, onPageChange: setPage }}
        serverSide
      />
    </TableShell>
  )
}

export function RecentUsersTable({ filters }) {
  const navigate = useNavigate()
  const { data, loading, page, setPage, limit } = useDashboardTable('recent-users', filters)

  const columns = [
    { key: 'name', title: 'Name', render: (row) => row.name },
    { key: 'email', title: 'Email', render: (row) => row.email },
    { key: 'mobile', title: 'Mobile', render: (row) => row.mobile },
    { key: 'registeredAt', title: 'Registered', render: (row) => formatDate(row.registeredAt) },
    { key: 'status', title: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'lastLogin',
      title: 'Last Login',
      render: () => <span className="text-xs text-slate-400 dark:text-slate-500">Not tracked</span>,
    },
  ]

  return (
    <TableShell
      title="Recently Registered Users"
      subtitle="Login timestamps are not recorded by this schema"
      action={
        <Button variant="secondary" size="sm" icon={ExternalLink} onClick={() => navigate('/users')}>
          All users
        </Button>
      }
    >
      <DataTable
        columns={columns}
        data={data?.items || []}
        loading={loading}
        showSearch={false}
        emptyTitle="No new users"
        emptyDescription="Nobody registered in the selected range."
        onRowClick={(row) => navigate(`/users/${row.id}`)}
        actions={false}
        mobileCardRender={(row) => (
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 truncate font-medium text-slate-900 dark:text-white">{row.name}</p>
              <StatusBadge status={row.status} />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Metric label="Email" value={row.email} />
              <Metric label="Mobile" value={row.mobile} />
              <Metric label="Registered" value={formatDate(row.registeredAt)} />
            </div>
          </div>
        )}
        pagination={{ page, limit, total: data?.total || 0, onPageChange: setPage }}
        serverSide
      />
    </TableShell>
  )
}

export function RecentProductsTable({ filters, currency }) {
  const navigate = useNavigate()
  const { data, loading, page, setPage, limit } = useDashboardTable('recent-products', filters)

  const columns = [
    {
      key: 'product',
      title: 'Product',
      render: (row) => (
        <div className="flex min-w-0 items-center gap-3">
          <ProductThumb image={row.image} video={row.video} />
          <p className="max-w-[220px] truncate font-medium text-slate-900 dark:text-white">{row.title}</p>
        </div>
      ),
    },
    { key: 'category', title: 'Category', render: (row) => row.category },
    { key: 'seller', title: 'Seller', render: (row) => row.seller },
    {
      key: 'price',
      title: 'Price',
      render: (row) => (row.price == null ? '—' : formatCurrency(row.price, currency, true)),
    },
    { key: 'status', title: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'postedAt', title: 'Posted', render: (row) => formatDate(row.postedAt) },
  ]

  return (
    <TableShell
      title="Recent Products"
      action={
        <Button variant="secondary" size="sm" icon={ExternalLink} onClick={() => navigate('/products')}>
          All products
        </Button>
      }
    >
      <DataTable
        columns={columns}
        data={data?.items || []}
        loading={loading}
        showSearch={false}
        emptyTitle="No products"
        emptyDescription="Nothing was posted in the selected range."
        onRowClick={(row) => navigate(`/products/${row.id}`)}
        actions={false}
        mobileCardRender={(row) => (
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <ProductThumb image={row.image} video={row.video} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-900 dark:text-white">{row.title}</p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{row.category}</p>
              </div>
              <StatusBadge status={row.status} />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Metric label="Seller" value={row.seller} />
              <Metric
                label="Price"
                value={row.price == null ? '—' : formatCurrency(row.price, currency, true)}
              />
              <Metric label="Posted" value={formatDate(row.postedAt)} />
            </div>
          </div>
        )}
        pagination={{ page, limit, total: data?.total || 0, onPageChange: setPage }}
        serverSide
      />
    </TableShell>
  )
}

export function PackagePurchasesTable({ filters, currency }) {
  const navigate = useNavigate()
  const { data, loading, page, setPage, limit } = useDashboardTable('package-purchases', filters)

  const columns = [
    {
      key: 'user',
      title: 'User',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900 dark:text-white">{row.user}</p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{row.userEmail}</p>
        </div>
      ),
    },
    { key: 'package', title: 'Package', render: (row) => row.package },
    {
      key: 'amount',
      title: 'Amount',
      render: (row) => (
        <span className="font-semibold tabular-nums">{formatCurrency(row.amount, row.currency)}</span>
      ),
    },
    { key: 'purchasedAt', title: 'Purchase Date', render: (row) => formatDate(row.purchasedAt) },
    {
      key: 'expiresAt',
      title: 'Expiry Date',
      render: (row) => (row.expiresAt ? formatDate(row.expiresAt) : 'No expiry'),
    },
    { key: 'status', title: 'Status', render: (row) => <StatusBadge status={row.status} /> },
  ]

  return (
    <TableShell title="Package Purchase History">
      <DataTable
        columns={columns}
        data={data?.items || []}
        loading={loading}
        showSearch={false}
        emptyTitle="No package purchases"
        emptyDescription="No packages were bought in the selected range."
        onRowClick={(row) => navigate(`/transactions/${row.id}`)}
        actions={false}
        mobileCardRender={(row) => (
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 truncate font-medium text-slate-900 dark:text-white">{row.user}</p>
              <StatusBadge status={row.status} />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Metric label="Package" value={row.package} />
              <Metric label="Amount" value={formatCurrency(row.amount, row.currency)} />
              <Metric label="Purchased" value={formatDate(row.purchasedAt)} />
              <Metric label="Expires" value={row.expiresAt ? formatDate(row.expiresAt) : 'No expiry'} />
            </div>
          </div>
        )}
        pagination={{ page, limit, total: data?.total || 0, onPageChange: setPage }}
        serverSide
      />
    </TableShell>
  )
}

export function TopSellersTable({ filters, currency }) {
  const navigate = useNavigate()
  const { data, loading, page, setPage, limit } = useDashboardTable('top-sellers', filters)

  const columns = [
    {
      key: 'name',
      title: 'Seller',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900 dark:text-white">{row.name}</p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{row.email}</p>
        </div>
      ),
    },
    { key: 'totalProducts', title: 'Total Products', render: (row) => formatNumber(row.totalProducts) },
    { key: 'activeListings', title: 'Active Listings', render: (row) => formatNumber(row.activeListings) },
    { key: 'totalSales', title: 'Total Sales', render: (row) => formatNumber(row.totalSales) },
    {
      key: 'revenue',
      title: 'Revenue',
      render: (row) => (
        <span className="font-semibold tabular-nums">{formatCurrency(row.revenue, currency, true)}</span>
      ),
    },
  ]

  return (
    <TableShell title="Top Sellers">
      <DataTable
        columns={columns}
        data={data?.items || []}
        loading={loading}
        showSearch={false}
        emptyTitle="No sellers"
        emptyDescription="No listings in the selected range."
        onRowClick={(row) => navigate(`/users/${row.id}`)}
        actions={false}
        mobileCardRender={(row) => (
          <div className="space-y-2">
            <p className="truncate font-medium text-slate-900 dark:text-white">{row.name}</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Metric label="Products" value={formatNumber(row.totalProducts)} />
              <Metric label="Active" value={formatNumber(row.activeListings)} />
              <Metric label="Sales" value={formatNumber(row.totalSales)} />
              <Metric label="Revenue" value={formatCurrency(row.revenue, currency, true)} />
            </div>
          </div>
        )}
        pagination={{ page, limit, total: data?.total || 0, onPageChange: setPage }}
        serverSide
      />
    </TableShell>
  )
}

export function TopBuyersTable({ filters, currency }) {
  const navigate = useNavigate()
  const { data, loading, page, setPage, limit } = useDashboardTable('top-buyers', filters)

  const columns = [
    {
      key: 'name',
      title: 'Buyer',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900 dark:text-white">{row.name}</p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{row.email}</p>
        </div>
      ),
    },
    { key: 'totalPurchases', title: 'Total Purchases', render: (row) => formatNumber(row.totalPurchases) },
    {
      key: 'amountSpent',
      title: 'Amount Spent',
      render: (row) => (
        <span className="font-semibold tabular-nums">{formatCurrency(row.amountSpent, currency)}</span>
      ),
    },
    { key: 'lastPurchase', title: 'Last Purchase', render: (row) => formatDate(row.lastPurchase) },
  ]

  return (
    <TableShell title="Top Buyers">
      <DataTable
        columns={columns}
        data={data?.items || []}
        loading={loading}
        showSearch={false}
        emptyTitle="No buyers"
        emptyDescription="No checkout payments in the selected range."
        onRowClick={(row) => navigate(`/users/${row.id}`)}
        actions={false}
        mobileCardRender={(row) => (
          <div className="space-y-2">
            <p className="truncate font-medium text-slate-900 dark:text-white">{row.name}</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Metric label="Purchases" value={formatNumber(row.totalPurchases)} />
              <Metric label="Spent" value={formatCurrency(row.amountSpent, currency, true)} />
              <Metric label="Last purchase" value={formatDate(row.lastPurchase)} />
            </div>
          </div>
        )}
        pagination={{ page, limit, total: data?.total || 0, onPageChange: setPage }}
        serverSide
      />
    </TableShell>
  )
}

function Metric({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="text-slate-500 dark:text-slate-400">{label}</p>
      <p className="truncate font-medium text-slate-800 dark:text-slate-200">{value}</p>
    </div>
  )
}

export default TableShell
