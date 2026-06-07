import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import localConfig from '../config/postAdFormConfig.json'
import { useDynamicPostAdForm } from '../features/dynamicPostAdForm/hooks/useDynamicPostAdForm'
import { CategorySelect } from '../features/dynamicPostAdForm/components/CategorySelect'
import { DynamicFormRenderer } from '../features/dynamicPostAdForm/components/DynamicFormRenderer'
import { PreviewPanel } from '../features/dynamicPostAdForm/components/PreviewPanel'
import { postAdFormConfigService } from '../services/postAdFormConfigService'

function SkeletonList() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 8 }).map((_, idx) => (
        <div key={idx} className="skeleton h-10" />
      ))}
    </div>
  )
}

function PostAdDynamicFormPage() {
  const [lastSubmittedPayload, setLastSubmittedPayload] = useState(null)
  const [remoteConfig, setRemoteConfig] = useState(null)
  const [isConfigLoading, setIsConfigLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function loadConfig() {
      setIsConfigLoading(true)
      try {
        const res = await postAdFormConfigService.getPostAdFormConfig()
        const cfg = res?.data
        if (mounted && cfg && Array.isArray(cfg.categories)) {
          setRemoteConfig(cfg)
        } else if (mounted) {
          setRemoteConfig(localConfig)
        }
      } catch (e) {
        // If the endpoint isn't available yet, keep the working local schema.
        if (mounted) setRemoteConfig(localConfig)
      } finally {
        if (mounted) setIsConfigLoading(false)
      }
    }

    loadConfig()
    return () => {
      mounted = false
    }
  }, [])

  const {
    categories,
    selectedCategoryId,
    setSelectedCategoryId,
    fields,
    isSwitching,
    formData,
    errors,
    touched,
    hasSubmitted,
    previewPayload,
    setFieldValue,
    submit
  } = useDynamicPostAdForm({
    config: remoteConfig || localConfig,
    initialCategoryId: ''
  })

  const hasErrors = useMemo(() => Object.keys(errors || {}).length > 0, [errors])

  const onSubmit = (e) => {
    e.preventDefault()
    const payload = submit()

    if (!payload) {
      toast.error('Please fix required fields before submitting.')
      return
    }

    setLastSubmittedPayload(payload)
    toast.success('Payload generated. Check the preview panel.')
    // TODO: integrate with backend API if/when you want actual post creation.
    // For now, this is a working dynamic form system that generates the required payload.
    // eslint-disable-next-line no-console
    console.log('Dynamic PostAd payload:', payload)
  }

  return (
    <div className="max-w-5xl mx-auto p-4">
      <div className="card">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Create New Post / Ad</h1>
        <CategorySelect
          categories={categories}
          value={selectedCategoryId}
          onChange={setSelectedCategoryId}
          isSwitching={isSwitching || isConfigLoading}
        />
        {isConfigLoading ? (
          <p className="mt-2 text-xs text-gray-500">Loading form schema from database...</p>
        ) : null}
      </div>

      <form onSubmit={onSubmit} className="mt-4">
        <div
          className={`card transition-opacity duration-200 ${isSwitching ? 'opacity-70' : 'opacity-100'}`}
        >
          {isSwitching ? (
            <SkeletonList />
          ) : (
            <DynamicFormRenderer
              key={selectedCategoryId}
              fields={fields}
              formData={formData}
              errors={errors}
              touched={touched}
              hasSubmitted={hasSubmitted}
              setFieldValue={setFieldValue}
            />
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <div className="card">
            <PreviewPanel payload={previewPayload} />
            {lastSubmittedPayload ? (
              <div className="mt-4 text-xs text-gray-500">
                Last submitted payload was generated successfully.
              </div>
            ) : null}
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Submit</h2>
            <button className="btn-primary w-full" type="submit" disabled={isSwitching}>
              Generate Payload
            </button>
            <p className="mt-3 text-xs text-gray-500">
              Required fields are validated on submit, and errors appear as you type.
            </p>
            {hasSubmitted && hasErrors ? (
              <p className="mt-2 text-sm text-red-600">
                Please fix the highlighted required fields.
              </p>
            ) : null}
          </div>
        </div>
      </form>
    </div>
  )
}

export default PostAdDynamicFormPage

