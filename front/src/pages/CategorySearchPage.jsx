import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, Home, Loader2, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import useCategoryDrilldown from '@shared/hooks/useCategoryDrilldown'
import useCategoryFilterFields from '@shared/hooks/useCategoryFilterFields'
import CategoryFilterFields from '@shared/components/CategoryFilterFields'
import CategoryBrowseLayout from '@shared/components/CategoryBrowseLayout'
import { buildListingUrl } from '@shared/utils/categorySearchParams'
import { getLevelLabels } from '@shared/utils/categoryFields'
import CategoryLevelPicker from '../features/categorySearch/components/CategoryLevelPicker'

/**
 * Hierarchical category search (/search).
 *
 * Category selection reuses the Post Ad step-1 UI, API and drill-down logic
 * (see useCategoryDrilldown): every pick with `isChild === 1` opens its children
 * below the current selection, recursively, until a leaf is reached. The leaf's
 * admin-configured filters are then rendered by field type, and Search hands the
 * whole selection to the product listing page through the URL.
 */
function CategorySearchPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const {
    levelOptions,
    selectedPath,
    selectedCategories,
    categoryPathNames,
    leafCategory,
    isComplete,
    loadingRoots,
    loadingChildren,
    error,
    selectAtLevel,
    clearFromLevel,
  } = useCategoryDrilldown()

  const [selectedFilterIds, setSelectedFilterIds] = useState([])
  const [filterValues, setFilterValues] = useState({})

  // Same per-level labels the Post Ad cascading selection uses.
  const levelLabels = getLevelLabels(selectedCategories[0]?.name || '')

  const {
    fields,
    loading: filtersLoading,
    error: filtersError,
  } = useCategoryFilterFields(selectedPath, { enabled: isComplete })

  // Search params the app already supports (keyword, city, sort, price) are
  // carried straight through to the listing page.
  const passthroughParams = useMemo(() => {
    const carried = {}
    ;['q', 'cityId', 'location', 'sortBy', 'minPrice', 'maxPrice'].forEach((key) => {
      const value = searchParams.get(key)
      if (value) carried[key] = value
    })
    return carried
  }, [searchParams])

  const handleSelect = (level, categoryId) => {
    // A new pick at this level supersedes deeper picks and their filters.
    setSelectedFilterIds([])
    setFilterValues({})
    selectAtLevel(level, categoryId)
  }

  const handleEditLevel = (level) => {
    setSelectedFilterIds([])
    setFilterValues({})
    clearFromLevel(level)
  }

  const handleBack = () => {
    if (selectedPath.length > 0) {
      handleEditLevel(selectedPath.length - 1)
      return
    }
    navigate('/')
  }

  const missingRequiredField = useMemo(
    () =>
      fields.find((field) => {
        if (!field.required) return false
        if (field.options.length) {
          return !field.options.some((opt) =>
            selectedFilterIds.includes(String(opt.filterId || opt.value)),
          )
        }
        return !filterValues[field.id]
      }),
    [fields, selectedFilterIds, filterValues],
  )

  const handleSearch = () => {
    if (!isComplete || !selectedPath.length) {
      toast.error('Please select a category to search')
      return
    }
    if (missingRequiredField) {
      toast.error(`Please select ${missingRequiredField.name}`)
      return
    }

    navigate(
      buildListingUrl({
        categoryPath: selectedPath,
        filterIds: selectedFilterIds,
        filterValues,
        extraParams: passthroughParams,
      }),
    )
  }

  // Levels already picked collapse to a summary row; the deepest open level is
  // the one being chosen from.
  const openLevel = selectedPath.length === levelOptions.length ? -1 : levelOptions.length - 1

  return (
    // Same shell (marketplace top bar + category sidebar) as the product
    // listing page, so search and results share one chrome.
    <CategoryBrowseLayout
      activeCategoryId={selectedPath[0] || null}
      variant="listing"
      layoutPreset="marketplace"
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#F7F8FC]">
        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="mx-auto w-full max-w-[860px] pb-10">
          <button
            type="button"
            onClick={handleBack}
            className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-800"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>

          <div className="mb-8 w-full text-center sm:mb-10">
            <h2 className="post-ad-step-heading">What are you looking for?</h2>
            <p className="post-ad-step-subheading">
              Pick a category — we&apos;ll narrow it down and show the filters that apply.
            </p>
          </div>

          {categoryPathNames.length ? (
            <nav className="mb-6 flex w-full flex-wrap items-center gap-2 text-sm text-gray-500" aria-label="Breadcrumb">
              <Home className="h-4 w-4 shrink-0" aria-hidden />
              {categoryPathNames.map((name, index) => (
                <span key={`${selectedPath[index] || index}`} className="flex items-center gap-2">
                  <span className="text-gray-400">/</span>
                  <span className="font-medium text-gray-800">{name}</span>
                </span>
              ))}
            </nav>
          ) : null}

          {error ? (
            <p className="mb-4 w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {error}
            </p>
          ) : null}

          <div className="flex w-full flex-col gap-4">
            {levelOptions.map((options, level) => (
              <CategoryLevelPicker
                key={`level-${level}`}
                level={level}
                levelLabel={levelLabels[level]}
                options={options}
                selectedId={selectedPath[level] || ''}
                selectedName={selectedCategories[level]?.name || ''}
                loading={level === 0 ? loadingRoots : loadingChildren}
                onSelect={handleSelect}
                onEdit={level === openLevel ? null : handleEditLevel}
              />
            ))}

            {loadingChildren && selectedPath.length === levelOptions.length && !isComplete ? (
              <div className="flex w-full justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
              </div>
            ) : null}
          </div>

          {isComplete ? (
            <div className="mt-8 w-full">
              <h3 className="text-base font-semibold text-[#0F172A]">
                Filters for {leafCategory?.name || 'this category'}
              </h3>

              {filtersLoading ? (
                <div className="mt-4 flex items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-6 text-sm text-slate-600">
                  <Loader2 className="h-4 w-4 animate-spin text-brand" />
                  Loading filters for this category…
                </div>
              ) : filtersError ? (
                <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {filtersError}
                </p>
              ) : fields.length ? (
                <div className="mt-2">
                  <CategoryFilterFields
                    fields={fields}
                    selectedFilterIds={selectedFilterIds}
                    filterValues={filterValues}
                    onFilterIdsChange={setSelectedFilterIds}
                    onFilterValuesChange={setFilterValues}
                  />
                </div>
              ) : (
                <p className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                  No filters are configured for this category — search to see all listings.
                </p>
              )}
            </div>
          ) : null}

          <div className="mt-8 w-full">
            <button
              type="button"
              onClick={handleSearch}
              disabled={!isComplete}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand px-6 py-3.5 text-sm font-semibold text-white shadow-md shadow-brand/25 transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-[220px]"
            >
              <Search className="h-4 w-4" />
              Search
            </button>
            {!isComplete ? (
              <p className="mt-2 text-sm text-[#64748B]">
                Keep selecting until you reach the final category to start your search.
              </p>
            ) : null}
          </div>
          </div>
        </div>
      </div>
    </CategoryBrowseLayout>
  )
}

export default CategorySearchPage
