import { useCallback, useState } from 'react'

const SLIDE_MS = 300

export default function useFilterPanelSlide(initialOpen = false) {
  const [open, setOpen] = useState(initialOpen)
  const [closing, setClosing] = useState(false)

  const openPanel = useCallback(() => {
    setClosing(false)
    setOpen(true)
  }, [])

  const closePanel = useCallback(() => {
    setClosing((isClosing) => {
      if (isClosing) return isClosing
      setTimeout(() => {
        setOpen(false)
        setClosing(false)
      }, SLIDE_MS)
      return true
    })
  }, [])

  const togglePanel = useCallback(() => {
    setOpen((isOpen) => {
      if (isOpen) {
        closePanel()
        return isOpen
      }
      setClosing(false)
      return true
    })
  }, [closePanel])

  const visible = open || closing

  return {
    open,
    closing,
    visible,
    openPanel,
    closePanel,
    togglePanel,
  }
}
