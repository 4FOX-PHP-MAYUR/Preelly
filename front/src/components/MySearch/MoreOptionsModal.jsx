import { Pencil, Share2, Trash2 } from 'lucide-react'
import ModalDialog from '../ui/ModalDialog'

export default function MoreOptionsModal({ open, onClose, onRename, onShare, onDelete }) {
  const rows = [
    {
      key: 'rename',
      label: 'Rename Search',
      Icon: Pencil,
      className: 'text-brand',
      onClick: onRename,
    },
    {
      key: 'share',
      label: 'Share Search',
      Icon: Share2,
      className: 'text-brand',
      onClick: onShare,
    },
    {
      key: 'delete',
      label: 'Delete Search',
      Icon: Trash2,
      className: 'text-red-500',
      onClick: onDelete,
    },
  ]

  return (
    <ModalDialog open={open} onClose={onClose} title="More" maxWidthClass="sm:max-w-sm">
      <div className="-mx-5 border-t border-[#E8EAED]">
        {rows.map((row, index) => {
          const Icon = row.Icon
          return (
            <button
              key={row.key}
              type="button"
              onClick={() => {
                onClose?.()
                row.onClick?.()
              }}
              className={`flex w-full items-center gap-3 px-5 py-4 text-left text-[15px] font-semibold transition hover:bg-slate-50 ${
                row.className
              } ${index < rows.length - 1 ? 'border-b border-[#E8EAED]' : ''}`}
            >
              <Icon className="h-5 w-5" strokeWidth={1.85} />
              {row.label}
            </button>
          )
        })}
      </div>
    </ModalDialog>
  )
}
