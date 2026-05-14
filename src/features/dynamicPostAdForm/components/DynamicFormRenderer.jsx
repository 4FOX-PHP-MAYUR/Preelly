import { resolveFieldOptions } from '../domain/resolveFieldOptions'
import { InputField } from './fields/InputField'
import { SelectField } from './fields/SelectField'
import { CheckboxField } from './fields/CheckboxField'
import { RadioField } from './fields/RadioField'
import { FileUploadField } from './fields/FileUploadField'

export function DynamicFormRenderer({
  fields,
  formData,
  errors,
  touched,
  hasSubmitted,
  setFieldValue
}) {
  if (!Array.isArray(fields) || fields.length === 0) {
    return (
      <div className="text-sm text-gray-500">
        No fields configured for this category.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {fields.map((field) => {
        const value = formData?.[field.name]
        const fieldError = errors?.[field.name]
        const shouldShowError = Boolean(fieldError) && (hasSubmitted || touched?.[field.name])
        const errorMessage = shouldShowError ? fieldError.message : null

        switch (field.type) {
          case 'text':
          case 'number':
            return (
              <InputField
                key={field.name}
                field={field}
                value={value}
                error={errorMessage}
                onChange={(next) => setFieldValue(field, next)}
              />
            )
          case 'select': {
            const options = resolveFieldOptions(field, formData)
            return (
              <SelectField
                key={field.name}
                field={field}
                value={value}
                error={errorMessage}
                options={options}
                onChange={(next) => setFieldValue(field, next)}
              />
            )
          }
          case 'checkbox':
            return (
              <CheckboxField
                key={field.name}
                field={field}
                value={value}
                error={errorMessage}
                onChange={(next) => setFieldValue(field, next)}
              />
            )
          case 'radio': {
            const options = resolveFieldOptions(field, formData)
            return (
              <RadioField
                key={field.name}
                field={field}
                value={value}
                error={errorMessage}
                options={options}
                onChange={(next) => setFieldValue(field, next)}
              />
            )
          }
          case 'file':
            return (
              <FileUploadField
                key={field.name}
                field={field}
                value={value}
                error={errorMessage}
                onChange={(next) => setFieldValue(field, next)}
              />
            )
          default:
            return null
        }
      })}
    </div>
  )
}

