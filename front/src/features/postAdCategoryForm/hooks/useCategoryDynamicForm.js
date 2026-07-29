import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  fetchFieldFunctionOptions,
  setFieldValue as setFieldValueAction,
  setComputedOptions,
  updateScope,
  goToSubStep,
  selectDynamicFormEntry,
} from '../../../shared/store/slices/dynamicFormSlice'
import { validateFieldValue } from '../../../shared/utils/dynamicFormValidation'
import { hasFieldFunction, parseFunctionForFieldNames } from '../../../shared/utils/dynamicFormFieldFunction'
import { hasNestedOptions, deriveFunctionTargetFieldName } from '../../../shared/utils/nestedFieldOptions'
import { resolveFieldPrefillValue, isFieldEmpty } from '../../../shared/utils/dynamicFormAiPrefill'
import { useDynamicFormLoader } from './useDynamicFormLoader'
import { isScopePickerField, scopeValueOf } from '../../../shared/utils/dynamicFormScope'

/**
 * Drives the admin-configured, category-scoped dynamic post-ad form for Step 4.
 * `categoryId` should be the deepest category the user picked in Step 2 (subcategory
 * if one was selected, else the root category).
 * `initialValues`, when provided (restoring a saved draft), is re-applied once right
 * after the category becomes active — which otherwise wipes `values` back to `{}`.
 * @param {{ categoryId: string, initialValues?: Record<string, unknown> }} params
 */
export function useCategoryDynamicForm({ categoryId, initialValues, aiSignals = null }) {
  const dispatch = useDispatch()
  const dynamicFormState = useSelector((state) => state.dynamicForm)
  const entry = useSelector(selectDynamicFormEntry)

  const { categoryFilterId, childCategoryId, subStep, values, computedOptions, computedOptionsLoading } =
    dynamicFormState

  // Loading the definition lives in a shared hook so the Summary step can load it
  // too, without mounting this form (see useDynamicFormLoader).
  useDynamicFormLoader({ categoryId, initialValues })

  const status = entry?.status || (categoryId ? 'loading' : 'idle')
  const steps = entry?.steps || []
  const totalSteps = entry?.totalSteps || 0
  const categoryName = entry?.categoryName || null
  const errorMessage = entry?.error || null

  // All fields across every step — functionName-driven fields (e.g. Trim) can depend
  // on fields that live on an earlier step, so dependency lookups can't be limited to
  // the currently visible step.
  const allFields = useMemo(() => steps.flatMap((step) => step.fields || []), [steps])

  const currentStepFields = useMemo(() => {
    const stepEntry = steps[subStep]
    if (!stepEntry || !Array.isArray(stepEntry.fields)) return []
    return [...stepEntry.fields]
      .sort((a, b) => (a.fieldOrder ?? 0) - (b.fieldOrder ?? 0))
      .map((field) => {
        // Fields whose options were (re)computed client-side or via a functionName
        // call (e.g. Trim, populated from the selected Model's children) get those
        // options instead of whatever the initial dynamic-form fetch resolved.
        const computed = computedOptions[field.fieldName]
        if (computed === undefined) return field
        return {
          ...field,
          options: computed,
          isLoadingOptions: Boolean(computedOptionsLoading[field.fieldName]),
        }
      })
  }, [steps, subStep, computedOptions, computedOptionsLoading])

  const setFieldValue = useCallback(
    (field, nextValue) => {
      dispatch(setFieldValueAction({ fieldName: field.fieldName, value: nextValue }))

      // Picking a deeper category descends the FormField scope chain
      // (categoryId -> categoryFilterId -> childCategoryId), which pulls in fields
      // the admin attached to that level. See isScopePickerField for why nested-tree
      // and cascade-source fields are excluded.
      if (isScopePickerField(field)) {
        const scopeKey = !categoryFilterId ? 'categoryFilterId' : 'childCategoryId'
        dispatch(updateScope({ [scopeKey]: scopeValueOf(nextValue) }))
      }

      // Case A: the field that just changed carries its own functionName (e.g. the
      // "modelid" field's functionName "getTrimByID", functionForField "trimid").
      // Its target field is whatever functionForField names, or — since this payload
      // shape doesn't always set that — derived from the function's own name
      // ("getTrimByID" -> "trim"). When the source field's options are a nested tree
      // (modelid), the target's (trimid's) options are read straight off the selected
      // node's `children` — no network call needed, since that data is already in
      // the payload. Otherwise, the target's options are fetched via network call.
      if (hasFieldFunction(field)) {
        const declaredTarget = parseFunctionForFieldNames(field.functionForField)[0]
        const targetFieldName = declaredTarget || deriveFunctionTargetFieldName(field.functionName)
        const targetField = allFields.find((f) => f.fieldName.toLowerCase() === targetFieldName)

        if (targetField) {
          if (hasNestedOptions(field)) {
            const selectedNode = (field.options || []).find((opt) => String(opt.value) === String(nextValue))
            dispatch(setComputedOptions({ fieldName: targetField.fieldName, options: selectedNode?.children || [] }))
          } else {
            dispatch(
              fetchFieldFunctionOptions({
                fieldName: targetField.fieldName,
                functionName: field.functionName,
                params: { [field.fieldName]: Array.isArray(nextValue) ? nextValue[0] : nextValue },
              })
            )
          }
        }
      }

      // Case B: other fields declare functionName + functionForField listing the
      // field that just changed as one of their dependencies (server-computed).
      // Nested-tree fields (e.g. modelid) are excluded here: their functionForField
      // names their cascade TARGET (Case A), not a dependency of their own options —
      // treating it as one would wrongly refetch/blank modelid's own options whenever
      // trimid changes.
      const updatedValues = { ...values, [field.fieldName]: nextValue }
      allFields.forEach((dependentField) => {
        if (dependentField.fieldName === field.fieldName) return
        if (!hasFieldFunction(dependentField) || hasNestedOptions(dependentField)) return
        const dependencyNames = parseFunctionForFieldNames(dependentField.functionForField)
        if (!dependencyNames.includes(field.fieldName)) return

        const params = {}
        dependencyNames.forEach((depName) => {
          const depValue = updatedValues[depName]
          if (depValue === undefined || depValue === null || depValue === '') return
          params[depName] = Array.isArray(depValue) ? depValue[0] : depValue
        })

        dispatch(
          fetchFieldFunctionOptions({
            fieldName: dependentField.fieldName,
            functionName: dependentField.functionName,
            params,
          })
        )
      })
    },
    [dispatch, categoryFilterId, values, allFields]
  )

  // ── AI transcript auto-fill ──────────────────────────────────────────────
  // Once the form + its options are loaded, fill any EMPTY field whose value the
  // video transcription already extracted. Re-entrant on purpose: setting a cascade
  // source (e.g. Model) loads its target's options (Trim) on a later pass, which then
  // gets filled too. A per-category "handled" set guarantees each field is auto-filled
  // at most once, so a user clearing a field is never overwritten.
  const prefillRef = useRef({ categoryId: null, handled: new Set() })
  const valuesRef = useRef(values)
  valuesRef.current = values

  useEffect(() => {
    if (!aiSignals || Object.keys(aiSignals).length === 0) return
    // Fields (and their options) are loaded once allFields is populated — this is a
    // more reliable signal than matching an exact status string.
    if (allFields.length === 0) return

    if (prefillRef.current.categoryId !== categoryId) {
      prefillRef.current = { categoryId, handled: new Set() }
    }
    const handled = prefillRef.current.handled
    const currentValues = valuesRef.current
    const filled = []

    allFields.forEach((field) => {
      if (handled.has(field.fieldName)) return
      if (!isFieldEmpty(currentValues[field.fieldName])) return

      // Use the field's live (computed) options when a cascade has produced them.
      const computed = computedOptions[field.fieldName]
      const resolveField = computed !== undefined ? { ...field, options: computed } : field

      const resolved = resolveFieldPrefillValue(resolveField, aiSignals)
      if (resolved === undefined) return

      handled.add(field.fieldName)
      setFieldValue(resolveField, resolved.value)
      filled.push(field.fieldName)
    })

    if (filled.length) {
      // eslint-disable-next-line no-console
      console.log('[PostAd] AI auto-filled dynamic fields:', filled.join(', '))
    }
  }, [aiSignals, allFields, computedOptions, categoryId, setFieldValue])

  const validateCurrentStep = useCallback(() => {
    const errors = {}
    currentStepFields.forEach((field) => {
      const message = validateFieldValue(field, values[field.fieldName])
      if (message) errors[field.fieldName] = message
    })
    return errors
  }, [currentStepFields, values])

  const isFirstStep = subStep <= 0
  const isLastStep = totalSteps === 0 || subStep >= totalSteps - 1

  const goNext = useCallback(() => {
    const errors = validateCurrentStep()
    if (Object.keys(errors).length > 0) return { ok: false, errors }
    if (!isLastStep) dispatch(goToSubStep(subStep + 1))
    return { ok: true, errors: {} }
  }, [dispatch, isLastStep, subStep, validateCurrentStep])

  const goBack = useCallback(() => {
    if (!isFirstStep) dispatch(goToSubStep(subStep - 1))
  }, [dispatch, isFirstStep, subStep])

  return {
    status,
    errorMessage,
    categoryName,
    totalSteps,
    subStep,
    currentStepFields,
    values,
    hasFields: totalSteps > 0,
    setFieldValue,
    validateCurrentStep,
    goNext,
    goBack,
    isFirstStep,
    isLastStep,
  }
}
