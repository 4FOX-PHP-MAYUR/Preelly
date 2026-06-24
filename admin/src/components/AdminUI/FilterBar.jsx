import React from 'react'
import { Search } from 'lucide-react'
import Input from './Input'
import Select from './Select'
import Button from './Button'

function FilterBar({
  searchValue,
  onSearchChange,
  onSearchSubmit,
  searchPlaceholder = 'Search...',
  filters = [],
  actions,
  className = '',
}) {
  const handleSubmit = (e) => {
    e.preventDefault()
    onSearchSubmit?.(e)
  }

  return (
    <form onSubmit={handleSubmit} className={`admin-filter-bar ${className}`}>
      <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
        {onSearchChange !== undefined && (
          <div className="flex-1 min-w-0">
            <Input
              icon={Search}
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label="Search"
            />
          </div>
        )}
        {filters.map((filter) => (
          <div key={filter.key || filter.label} className="w-full lg:w-auto lg:min-w-[160px]">
            {filter.type === 'select' ? (
              <Select
                label={filter.label}
                value={filter.value}
                onChange={filter.onChange}
                options={filter.options}
              />
            ) : (
              filter.render?.()
            )}
          </div>
        ))}
        <div className="flex flex-wrap gap-2 shrink-0">
          {onSearchSubmit && (
            <Button type="submit" icon={Search} size="md">
              Search
            </Button>
          )}
          {actions}
        </div>
      </div>
    </form>
  )
}

export default FilterBar
