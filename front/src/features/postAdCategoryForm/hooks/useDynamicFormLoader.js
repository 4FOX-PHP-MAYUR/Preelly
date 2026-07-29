import { useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  fetchDynamicForm,
  fetchFieldFunctionOptions,
  setActiveCategory,
  setComputedOptions,
  updateScope,
  setFieldValue as setFieldValueAction,
  selectDynamicFormAllFields,
} from '../../../shared/store/slices/dynamicFormSlice'
import {
  buildCascadeParams,
  collectPendingCascades,
} from '../../../shared/utils/dynamicFormCascade'
import { deriveScopeFromValues } from '../../../shared/utils/dynamicFormScope'

/**
 * Loads the admin-configured dynamic form for a category into the dynamicForm
 * slice. Split out of useCategoryDynamicForm so the definition can be loaded by
 * whoever needs it — the Basic Details step that edits the fields, and the
 * Summary/Review step that displays them without ever mounting Basic Details
 * (which is where an edit deep-link lands).
 *
 * Safe to call from more than one place for the same category:
 * `setActiveCategory` no-ops when the id is unchanged, and `fetchDynamicForm`
 * skips scopes already loaded or in flight.
 *
 * @param {{ categoryId: string, initialValues?: Record<string, unknown> }} params
 *   `initialValues` (a restored draft's values) is re-applied once right after
 *   `setActiveCategory`, which otherwise wipes `values` back to `{}`.
 */
export function useDynamicFormLoader({ categoryId, initialValues }) {
  const dispatch = useDispatch()
  const categoryFilterId = useSelector((state) => state.dynamicForm.categoryFilterId)
  const childCategoryId = useSelector((state) => state.dynamicForm.childCategoryId)

  const allFields = useSelector(selectDynamicFormAllFields)
  const values = useSelector((state) => state.dynamicForm.values)
  const computedOptions = useSelector((state) => state.dynamicForm.computedOptions)

  const pendingInitialValuesRef = useRef(initialValues || null)

  useEffect(() => {
    dispatch(setActiveCategory({ categoryId: categoryId || null }))
    if (categoryId && pendingInitialValuesRef.current) {
      const toRestore = pendingInitialValuesRef.current
      pendingInitialValuesRef.current = null
      Object.entries(toRestore).forEach(([fieldName, value]) => {
        dispatch(setFieldValueAction({ fieldName, value }))
      })
    }
  }, [dispatch, categoryId])

  useEffect(() => {
    if (!categoryId) return
    dispatch(fetchDynamicForm({ categoryId, categoryFilterId, childCategoryId }))
  }, [dispatch, categoryId, categoryFilterId, childCategoryId])

  // Fields the admin scoped to a deeper level (categoryFilterId / childCategoryId)
  // are only fetched once that level is known. Interactive picks widen the scope
  // via setFieldValue; loaded values never did, so derive it from them here — the
  // refetch then brings in the deeper fields, and this re-runs until the scope
  // settles (a derived scope equal to the current one patches nothing).
  useEffect(() => {
    if (!allFields.length) return
    const derived = deriveScopeFromValues({ allFields, values })
    const patch = {}
    if (derived.categoryFilterId && derived.categoryFilterId !== categoryFilterId) {
      patch.categoryFilterId = derived.categoryFilterId
    }
    if (derived.childCategoryId && derived.childCategoryId !== childCategoryId) {
      patch.childCategoryId = derived.childCategoryId
    }
    if (Object.keys(patch).length) dispatch(updateScope(patch))
  }, [dispatch, allFields, values, categoryFilterId, childCategoryId])

  // Values loaded from a saved product/draft never went through setFieldValue, so
  // the cascades those values drive never ran — leaving dependent dropdowns (e.g.
  // Trim, whose options come from the chosen Make & Model) with no options and
  // therefore un-editable. Resolve them here, once per target.
  useEffect(() => {
    if (!allFields.length) return
    const pending = collectPendingCascades({ allFields, values, computedOptions })
    if (!pending.length) return

    pending.forEach(({ sourceField, targetField, value, nestedOptions }) => {
      if (nestedOptions) {
        dispatch(setComputedOptions({ fieldName: targetField.fieldName, options: nestedOptions }))
        return
      }
      dispatch(
        fetchFieldFunctionOptions({
          fieldName: targetField.fieldName,
          functionName: sourceField.functionName,
          params: Object.keys(buildCascadeParams(sourceField, values)).length
            ? buildCascadeParams(sourceField, values)
            : { [sourceField.fieldName]: Array.isArray(value) ? value[0] : value },
        }),
      )
    })
  }, [dispatch, allFields, values, computedOptions])

  return { categoryFilterId, childCategoryId }
}

export default useDynamicFormLoader
