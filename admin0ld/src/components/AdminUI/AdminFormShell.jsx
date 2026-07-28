import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import AdminPage from './AdminPage'
import PageHeader from './PageHeader'
import Panel from './Panel'
import Button from './Button'

function AdminFormShell({
  title,
  subtitle,
  backTo,
  backLabel = 'Back to list',
  loading = false,
  onSubmit,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  children,
}) {
  const navigate = useNavigate()

  const handleCancel = () => {
    navigate(backTo)
  }

  return (
    <AdminPage>
      <PageHeader
        title={title}
        subtitle={subtitle}
        action={
          <Button variant="secondary" icon={ArrowLeft} onClick={handleCancel}>
            {backLabel}
          </Button>
        }
      />

      <Panel>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            onSubmit?.(e)
          }}
          className="space-y-6"
        >
          {children}
          <div className="flex flex-wrap justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
            <Button type="button" variant="secondary" onClick={handleCancel}>
              {cancelLabel}
            </Button>
            <Button type="submit" loading={loading}>
              {submitLabel}
            </Button>
          </div>
        </form>
      </Panel>
    </AdminPage>
  )
}

export default AdminFormShell
