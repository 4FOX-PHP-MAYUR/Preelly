/** Shared header row tokens for marketplace shells (home, detail, chat). */
export const MARKETPLACE_HEADER_ROW_HEIGHT = 'lg:min-h-[92px]'

export const MARKETPLACE_LOGO_CELL =
  `hidden lg:flex lg:flex-col lg:justify-start ${MARKETPLACE_HEADER_ROW_HEIGHT} lg:border-b lg:border-r lg:border-[#E8EBF2] bg-white px-5 pb-4 pt-4`

export const MARKETPLACE_TOPBAR_DESKTOP =
  `hidden ${MARKETPLACE_HEADER_ROW_HEIGHT} border-b border-[#E8EBF2] bg-white px-5 pb-4 pt-4 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-6`
