import React from 'react'
import { Search } from 'lucide-react'
import Input from './Input'
import Select from './Select'
import SearchableSelect from './SearchableSelect'
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
      <div className="flex flex-col gap-3">
        {onSearchChange !== undefined && (
          <div className="w-full min-w-0">
            <Input
              iconRight={Search}
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label="Search"
            />
          </div>
        )}

        {filters.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
            {filters.map((filter) => (
              <div key={filter.key || filter.label} className="w-full min-w-0">
                {filter.type === 'searchable-select' ? (
                  <SearchableSelect
                    label={filter.label}
                    value={filter.value}
                    onChange={filter.onChange}
                    options={filter.options}
                    placeholder={filter.placeholder}
                    searchPlaceholder={filter.searchPlaceholder}
                  />
                ) : filter.type === 'select' ? (
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
          </div>
        )}

        <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:items-center">
          {onSearchSubmit && (
            <Button type="submit" icon={Search} size="md" className="w-full sm:w-auto">
              Search
            </Button>
          )}
          {actions && (
            <div className="flex flex-wrap gap-2 w-full sm:w-auto [&_button]:w-full sm:[&_button]:w-auto">
              {actions}
            </div>
          )}
        </div>
      </div>
    </form>
  )
}

export default FilterBar
