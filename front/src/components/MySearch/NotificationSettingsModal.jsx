import { useEffect, useId, useState } from 'react'
import { Bell, Mail, MessageSquare } from 'lucide-react'
import ModalDialog from '../ui/ModalDialog'
import ToggleSwitch from './ToggleSwitch'
import SavedSearchPreviewCard from './SavedSearchPreviewCard'
import { getNotificationsEnabled } from './savedSearchUtils'

export default function NotificationSettingsModal({ open, item, saving, onClose, onSave }) {
  const titleId = useId()
  const [master, setMaster] = useState(true)
  const [email, setEmail] = useState(true)
  const [push, setPush] = useState(true)

  useEffect(() => {
    if (!open || !item) return
    const enabled = getNotificationsEnabled(item)
    setMaster(enabled)
    setEmail(item.emailNotificationEnabled !== false)
    setPush(item.pushNotificationEnabled !== false)
  }, [open, item])

  if (!item) return null

  const footer = (
    <div className="flex gap-3 pt-2">
      <button
        type="button"
        onClick={onClose}
        disabled={saving}
        className="flex-1 rounded-[12px] bg-[#EEF0FF] px-4 py-3.5 text-sm font-semibold text-brand transition hover:bg-[#E4E7FF] disabled:opacity-60"
      >
        Cancel
      </button>
      <button
        type="button"
        disabled={saving}
        onClick={() =>
          onSave?.({
            notificationEnabled: master,
            notifyEnabled: master,
            emailNotificationEnabled: email,
            pushNotificationEnabled: push,
          })
        }
        className="flex-1 rounded-[12px] bg-brand px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {saving ? 'Updating…' : 'Update Notifications'}
      </button>
    </div>
  )

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      maxWidthClass="sm:max-w-md"
      footer={footer}
    >
      <div className="space-y-4 pt-3">
        <div className="flex items-center justify-between gap-3 border-b border-[#E8EAED] pb-4">
          <div className="flex items-center gap-2.5">
            <Bell className="h-5 w-5 text-slate-800" strokeWidth={1.75} />
            <h2 id={titleId} className="text-base font-bold text-slate-900 sm:text-lg">
              Enable Notifications
            </h2>
          </div>
          <ToggleSwitch
            checked={master}
            onChange={setMaster}
            aria-label="Enable notifications"
          />
        </div>

        <SavedSearchPreviewCard item={item} />

        <div
          className={`overflow-hidden rounded-[14px] bg-[#F5F6F8] transition-opacity duration-200 ${
            master ? 'opacity-100' : 'opacity-55'
          }`}
        >
          <div className="flex items-start gap-3 border-b border-[#E5E7EB]/70 px-3.5 py-3.5 sm:px-4">
            <Mail className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" strokeWidth={1.75} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900">Email</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                Receive emails about the new listings from this search
              </p>
            </div>
            <ToggleSwitch
              checked={master && email}
              disabled={!master}
              onChange={setEmail}
              aria-label="Email notifications"
            />
          </div>
          <div className="flex items-start gap-3 px-3.5 py-3.5 sm:px-4">
            <MessageSquare className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" strokeWidth={1.75} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900">Push</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                get notifications on your phone with the new things
              </p>
            </div>
            <ToggleSwitch
              checked={master && push}
              disabled={!master}
              onChange={setPush}
              aria-label="Push notifications"
            />
          </div>
        </div>
      </div>
    </ModalDialog>
  )
}
