# Admin Panel Design System

This document describes the UI design system for the Preelly Admin Console. All admin pages should use these shared components and patterns for consistency, accessibility, and maintainability.

## Architecture

```
src/components/AdminUI/
├── adminNavConfig.js      # Sidebar groups, route metadata, breadcrumbs
├── AdminThemeContext.jsx  # Light/dark mode provider
├── Layout shell           # Sidebar + TopNav (via Layout.jsx)
├── index.js               # Barrel exports
└── Components             # Reusable UI primitives
```

## Design Tokens

### Colors
- **Primary**: Tailwind `primary-*` (sky blue) — actions, active nav, links
- **Surface**: White / `slate-900` (dark) — cards, panels, inputs
- **Sidebar**: `slate-950` with `primary-600` active states
- **Text**: `slate-900` / `slate-100` (dark), muted `slate-500`

### Spacing & Layout
- Page max width: `max-w-7xl` via `AdminPage`
- Content padding: `p-4 sm:p-6 lg:p-8` via `admin-content`
- Card/panel radius: `rounded-xl`
- Section gaps: `space-y-6`

### Typography
- Page title (TopNav): `text-lg sm:text-xl font-semibold`
- Section header: `text-xl sm:text-2xl font-bold` via `PageHeader`
- Table headers: `text-xs font-semibold uppercase tracking-wider`
- Body: `text-sm`

## Components

### Layout
| Component | Usage |
|-----------|-------|
| `AdminPage` | Wrap every admin page — provides max-width and spacing |
| `PageHeader` | Title, subtitle, and primary action slot |
| `Breadcrumbs` | Auto-rendered in TopNav from route config |
| `Sidebar` | Grouped navigation with RBAC filtering |
| `TopNav` | Sticky header with title, theme toggle, user menu |

### Data Display
| Component | Usage |
|-----------|-------|
| `Card` | Dashboard stat cards with icon accents |
| `Panel` | Content sections, filter bars |
| `DataTable` | Listings with search, pagination, actions |
| `StatusBadge` | Consistent status pills (active, pending, etc.) |
| `EmptyState` | No-data states with optional action |
| `LoadingSpinner` | Inline loading feedback |

### Forms
| Component | Usage |
|-----------|-------|
| `Input` | Text fields with label, hint, error |
| `Select` | Dropdowns with chevron |
| `Textarea` | Multi-line input |
| `Checkbox` | Boolean with optional description |
| `FormSection` | Grouped form fields with section title |
| `Drawer` | Create/edit forms (preferred over inline panels) |
| `Modal` | Confirmations, complex dialogs |

### Actions
| Component | Variants |
|-----------|----------|
| `Button` | `primary`, `secondary`, `ghost`, `danger`, `success` |
| `FilterBar` | Search + filter selects + action buttons |

## Dark Mode

Admin panel supports light and dark themes via `AdminThemeProvider` (wraps admin routes in `Layout.jsx`).

- Toggle: Sun/Moon icon in TopNav
- Persistence: `localStorage` key `theme` (shared with user dashboard)
- Implementation: Tailwind `dark:` variants + `darkMode: 'class'`

## Page Patterns

### Standard CRUD Page

```jsx
import { AdminPage, PageHeader, FilterBar, DataTable, Button, Drawer, Input } from '../components/AdminUI'

function AdminExamplePage() {
  return (
    <AdminPage>
      <PageHeader title="..." subtitle="..." action={<Button>Add</Button>} />
      <FilterBar searchValue={search} onSearchChange={setSearch} onSearchSubmit={handleSearch} />
      <Drawer open={showForm} onClose={close} title="Edit Item">...</Drawer>
      <DataTable columns={columns} data={items} onEdit={openEdit} onDelete={handleDelete} />
    </AdminPage>
  )
}
```

### Dashboard Tab Page

The main dashboard (`AdminDashboardPage`) uses URL-synced tabs (`?tab=products`). TopNav reads tab metadata from `ADMIN_TAB_META` in `adminNavConfig.js`.

## Navigation Groups

| Group | Items |
|-------|-------|
| Overview | Dashboard |
| Catalog | Categories, Filters, Field Types, Form Fields |
| Marketplace | Dealers, Emirates, Products, Sold |
| Users & Support | Users, Verification, Contacts, Reports |
| Settings | Admin Roles |

## Accessibility

- All icon buttons include `aria-label`
- Modals/drawers trap focus and close on Escape
- Form fields associate labels via `htmlFor` / `id`
- Tables use semantic `<table>`, `<thead>`, `<tbody>`
- Color is not the only status indicator (StatusBadge includes dot)

## CSS Utilities

Defined in `src/index.css`:

- `.admin-shell` — page background
- `.admin-input` — form control styling
- `.admin-panel` / `.admin-card` / `.admin-stat-card` — surfaces
- `.admin-table-*` — table styling
- `.admin-login-page` — standalone login layout

## Migration Notes

When updating legacy admin pages:

1. Replace outer `<div className="max-w-7xl...">` with `<AdminPage>`
2. Replace inline `<button className="bg-indigo-600...">` with `<Button>`
3. Replace inline forms with `<Drawer>` or `<Modal>`
4. Replace custom tables with `<DataTable>` where possible
5. Use `<StatusBadge>` instead of inline colored spans
6. Remove duplicate page titles (TopNav shows route title + breadcrumbs)

## Files Updated in Redesign

- Layout shell: `Layout.jsx`, `Sidebar.jsx`, `TopNav.jsx`
- Design system: all `AdminUI/*` components
- Pages: Login, Dashboard, Categories, Dealers, Emirates, Roles
- Styles: `index.css`, `tailwind.config.js`

Remaining pages (Filters, Form Fields, Field Types, Identity Verification, Role Permissions) inherit layout improvements automatically and can be migrated to shared form/table components incrementally.
