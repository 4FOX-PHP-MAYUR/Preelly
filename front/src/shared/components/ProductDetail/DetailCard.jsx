import {
  DETAIL_CARD,
  DETAIL_CARD_BODY,
  DETAIL_CARD_BODY_FLAT,
  DETAIL_CARD_FLAT,
  DETAIL_CARD_HEADER,
  DETAIL_CARD_HEADER_FLAT,
  DETAIL_SECTION_TITLE,
} from './detailStyles'

function DetailCard({ title, subtitle, children, className = '', headerAction = null, id, flat = false }) {
  return (
    <section id={id} className={`${flat ? DETAIL_CARD_FLAT : DETAIL_CARD} ${className}`}>
      {(title || headerAction) && (
        <div className={`flex items-start justify-between gap-3 ${flat ? DETAIL_CARD_HEADER_FLAT : DETAIL_CARD_HEADER}`}>
          <div className="min-w-0">
            {title ? <h2 className={DETAIL_SECTION_TITLE}>{title}</h2> : null}
            {subtitle ? <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p> : null}
          </div>
          {headerAction}
        </div>
      )}
      <div className={title || headerAction ? (flat ? DETAIL_CARD_BODY_FLAT : DETAIL_CARD_BODY) : ''}>{children}</div>
    </section>
  )
}

export default DetailCard
