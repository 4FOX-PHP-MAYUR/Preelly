import { Link } from 'react-router-dom'
import BrandLogo from '@shared/components/BrandLogo'

function MarketplaceLogoBlock({
  compact = false,
  className = '',
  showTagline = true,
}) {
  return (
    <div className={className}>
      <Link to="/" className="inline-flex items-center overflow-hidden">
        <BrandLogo variant="light" className={compact ? 'h-8 w-auto' : 'h-10 w-auto'} />
      </Link>
    
    </div>
  )
}

export default MarketplaceLogoBlock
