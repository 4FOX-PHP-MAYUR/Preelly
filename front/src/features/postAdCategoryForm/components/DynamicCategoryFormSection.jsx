import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useCategoryDynamicForm } from '../hooks/useCategoryDynamicForm'
import { FieldRenderer } from './FieldRenderer'
import { LocationMapPicker } from './LocationMapPicker'
import { FIELD_KIND, getFieldKind } from '../../../shared/utils/dynamicFormFieldKind'

const POST_AD_BLUE = '#2563eb'
const POST_AD_NAVY = '#1e3a5f'

// Fields wide enough to need the full row (checkboxes/text areas); everything else
// pairs up two-per-row.
const FULL_WIDTH_KINDS = new Set([FIELD_KIND.CHECKBOX, FIELD_KIND.TEXT, FIELD_KIND.TEXTAREA, FIELD_KIND.FILE])

/**
 * Renders the admin-configured, category-scoped dynamic form inside Step 5 (Item
 * Information). Fully data-driven off POST /api/v1/web/dynamic-form — no hardcoded
 * fields. Owns its own fixed footer (matching the rest of the redesigned post-ad
 * flow) — on its last internal sub-step, "Next" hands off to the outer wizard via
 * onAdvancePastForm rather than trying to advance a sub-step that doesn't exist.
 * @param {{ categoryId: string, onAdvancePastForm: () => void, setValue: Function, watch: Function, initialValues?: Record<string, unknown> }} props
 */
export function DynamicCategoryFormSection({ categoryId, onAdvancePastForm, setValue, watch, initialValues }) {
  const {
    status,
    errorMessage,
    totalSteps,
    currentStepFields,
    values,
    hasFields,
    setFieldValue,
    goNext,
    isLastStep,
  } = useCategoryDynamicForm({ categoryId, initialValues })

  const [stepErrors, setStepErrors] = useState({})
  const [attempted, setAttempted] = useState(false)

  if (!categoryId) return null

  const handleNext = () => {
    setAttempted(true)
    const result = goNext()
    setStepErrors(result.errors)
    if (!result.ok) return
    setAttempted(false)
    if (isLastStep) onAdvancePastForm?.()
  }

  // First load for this category — nothing rendered yet, so show a loading placeholder.
  if (status === 'loading' && totalSteps === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600 py-6">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading additional fields...
      </div>
    )
  }

  if (status === 'failed') {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          {errorMessage || 'Unable to load additional fields for this category. You can still continue.'}
        </p>
      </div>
    )
  }

  return (
    <>
      {hasFields && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5 w-full">
          {currentStepFields.map((field) => (
            <div
              key={field.id || field.fieldName}
              className={FULL_WIDTH_KINDS.has(getFieldKind(field.fieldType)) ? 'sm:col-span-2' : ''}
            >
              <FieldRenderer
                field={field}
                value={values[field.fieldName]}
                error={attempted ? stepErrors[field.fieldName] : null}
                onChange={(next) => setFieldValue(field, next)}
              />
            </div>
          ))}
        </div>
      )}

      {isLastStep && (
        <div className="mt-6 w-full">
          <LocationMapPicker setValue={setValue} watch={watch} />
        </div>
      )}

      <div className="post-ad-fixed-footer">
        <div className="mx-auto w-full max-w-[920px] px-4 pt-4 sm:px-6 sm:pt-5">
          <div className="mb-3 flex gap-1 sm:mb-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[3px] flex-1 rounded-full" style={{ backgroundColor: POST_AD_NAVY }} />
            ))}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-600">4 of 4</p>
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex w-full items-center justify-center gap-1 rounded-xl px-8 py-3.5 text-[15px] font-semibold text-white transition sm:w-auto sm:px-10"
              style={{ backgroundColor: POST_AD_BLUE }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#1d4ed8'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = POST_AD_BLUE
              }}
            >
              Next
              <span className="text-lg leading-none">&gt;</span>
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
