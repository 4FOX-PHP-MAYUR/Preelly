/**
 * Reusable permission matrix for role create/edit.
 * permissions: [{ module_name, can_view, can_create, can_edit, can_delete }]
 */
function PermissionMatrix({ permissions, onChange, disabled = false, readOnly = false }) {
  const locked = disabled || readOnly

  const update = (next) => {
    if (locked) return
    onChange?.(next)
  }

  const togglePermission = (moduleIndex, field) => {
    const updated = permissions.map((mod, i) =>
      i === moduleIndex ? { ...mod, [field]: !mod[field] } : mod
    )
    update(updated)
  }

  const toggleAllForModule = (moduleIndex) => {
    const mod = permissions[moduleIndex]
    const allChecked = mod.can_view && mod.can_create && mod.can_edit && mod.can_delete
    const updated = permissions.map((m, i) =>
      i === moduleIndex
        ? {
            ...m,
            can_view: !allChecked,
            can_create: !allChecked,
            can_edit: !allChecked,
            can_delete: !allChecked,
          }
        : m
    )
    update(updated)
  }

  const selectAll = () => {
    update(
      permissions.map((mod) => ({
        ...mod,
        can_view: true,
        can_create: true,
        can_edit: true,
        can_delete: true,
      }))
    )
  }

  const deselectAll = () => {
    update(
      permissions.map((mod) => ({
        ...mod,
        can_view: false,
        can_create: false,
        can_edit: false,
        can_delete: false,
      }))
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Permissions</h3>
          <p className="text-xs text-slate-500">Select at least one permission for this role.</p>
        </div>
        {!locked && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={selectAll}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={deselectAll}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
            >
              Deselect All
            </button>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Module
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                  View
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Add
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Edit
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Delete
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                  All
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {permissions.map((mod, idx) => {
                const allChecked =
                  mod.can_view && mod.can_create && mod.can_edit && mod.can_delete
                return (
                  <tr key={mod.module_name} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-slate-900">{mod.module_name}</span>
                    </td>
                    {[
                      ['can_view', 'View'],
                      ['can_create', 'Add'],
                      ['can_edit', 'Edit'],
                      ['can_delete', 'Delete'],
                    ].map(([field]) => (
                      <td key={field} className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={!!mod[field]}
                          disabled={locked}
                          onChange={() => togglePermission(idx, field)}
                          className="h-4 w-4 text-primary-600 border-slate-300 rounded focus:ring-primary-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                          aria-label={`${mod.module_name} ${field.replace('can_', '')}`}
                        />
                      </td>
                    ))}
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={allChecked}
                        disabled={locked}
                        onChange={() => toggleAllForModule(idx)}
                        className="h-4 w-4 text-primary-600 border-slate-300 rounded focus:ring-primary-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label={`Select all for ${mod.module_name}`}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default PermissionMatrix
