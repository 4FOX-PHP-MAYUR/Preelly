import { FIELD_KIND, getFieldKind } from '../../../shared/utils/dynamicFormFieldKind'
import { isFieldRequired } from '../../../shared/utils/dynamicFormValidation'
import { hasNestedOptions, flattenTopLevelOptions } from '../../../shared/utils/nestedFieldOptions'
import { isAddressField } from '../../../shared/utils/addressField'
import { AddressSuggestField } from './fields/AddressSuggestField'
import { TextField } from './fields/TextField'
import { TextareaField } from './fields/TextareaField'
import { NumberField } from './fields/NumberField'
import { DropdownField } from './fields/DropdownField'
import { PillSingleSelectField } from './fields/PillSingleSelectField'
import { PillMultiSelectField } from './fields/PillMultiSelectField'
import { DateField } from './fields/DateField'
import { FileUploadField } from './fields/FileUploadField'

// Add a new field type by (1) registering a FIELD_KIND + matcher in
// shared/utils/dynamicFormFieldKind.js and (2) adding one entry here.
const FIELD_COMPONENTS = {
  [FIELD_KIND.TEXT]: TextField,
  [FIELD_KIND.TEXTAREA]: TextareaField,
  [FIELD_KIND.NUMBER]: NumberField,
  [FIELD_KIND.DROPDOWN]: DropdownField,
  [FIELD_KIND.RADIO]: PillSingleSelectField,
  [FIELD_KIND.CHECKBOX]: PillMultiSelectField,
  [FIELD_KIND.DATE]: DateField,
  [FIELD_KIND.FILE]: FileUploadField,
}

/**
 * @param {{ field: object, value: any, error?: string|null, onChange: (next:any) => void,
 *          onAddressSelect?: (picked: { address: string, coordinates: {lat:number,lng:number}|null }) => void }} props
 */
export function FieldRenderer({ field, value, error, onChange, onAddressSelect }) {
  // Category-sourced fields with a nested options tree (e.g. "Make & Model") are
  // rendered as a single flat dropdown of just the tree's first level (e.g. Makes),
  // rather than a multi-level cascade.
  const isNested = hasNestedOptions(field)
  const renderField = isNested ? { ...field, options: flattenTopLevelOptions(field.options) } : field
  // A stored value from before this field only offered first-level options (e.g. a
  // deeper Model id) won't match any option here — show it unselected rather than a
  // broken/blank <select> for a value with no corresponding option.
  const renderValue =
    isNested && !renderField.options.some((opt) => String(opt.value) === String(value)) ? '' : value
  const kind = getFieldKind(field.fieldType)
  // Plain-text location/address fields get autocomplete instead of a bare input.
  const Component =
    kind === FIELD_KIND.TEXT && isAddressField(field)
      ? AddressSuggestField
      : FIELD_COMPONENTS[kind] || TextField
  return (
    <Component
      field={renderField}
      value={renderValue}
      error={error}
      required={isFieldRequired(field)}
      onChange={onChange}
      onAddressSelect={onAddressSelect}
    />
  )
}
