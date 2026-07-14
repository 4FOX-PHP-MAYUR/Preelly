import { useState, useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { createProduct, updateProduct, fetchProductById, fetchProducts } from '@shared/store/slices/productSlice'
import { getRouteAbortSignal } from '@shared/services/apiScope'
import {
  clearSession,
  rehydrateSessionFromStorage,
  selectIsAdmin,
  selectIsAuthenticated,
} from '@shared/store/slices/authSlice'
import { productService, videoService, listingService } from '@shared/services/api'
import toast from 'react-hot-toast'
import {
  ChevronLeft,
  ChevronRight,
  Home,
  UploadCloud,
  ChevronDown,
  SwitchCamera,
  CheckCircle,
  AlertCircle,
  Upload,
  X,
  Image as ImageIcon,
  Loader2,
  Camera,
  Pencil,
  Car,
  Building2,
  Shirt,
  Sofa,
  LayoutGrid,
  Smartphone,
  Newspaper,
  Calendar,
  Gauge,
  Globe,
  Plus,
  Check,
  Pause,
  Play,
  Trash2,
} from 'lucide-react'
import { getMediaUrl } from '@shared/utils/helpers'
import {
  getBrandOptionsForCategory,
  isVehicleSubcategoryBicycle,
  CONDITION_OPTIONS,
  getLevelLabels,
  resolveCategoryKeyForFields,
} from '@shared/utils/categoryFields'
import { categoryService } from '@shared/services/api'
import { applyTranscriptFilterSelections } from '@shared/utils/applyTranscriptFilterSelections'
import { applyAiVehicleFormPrefill, syncBrandChoiceFromMake } from '@shared/utils/applyAiVehicleFormPrefill'
import { toFilterArray, mergeFilterValues, scalarFromMultiSelect } from '@shared/utils/filterValueUtils'
import {
  applyAdsPostedToFormData,
  omitAdsPostedFromSelections,
  resolveAdsPostedSelectionForDate,
} from '@shared/utils/adsPostedFilter'
import {
  buildPostAdFormValuesFromProduct,
  restoreProductFilterSelections,
} from '@shared/utils/restoreProductToPostAdForm'
import {
  selectDynamicFormIsReadyToSubmit,
  selectDynamicFormAllFields,
  selectDynamicFormValues,
  setFieldValue as setDynamicFieldValue,
  resetDynamicForm,
} from '@shared/store/slices/dynamicFormSlice'
import { PostAdListingBreadcrumb } from '../components/PostAd/PostAdListingBreadcrumb'
import { DynamicCategoryFormSection } from '../features/postAdCategoryForm/components/DynamicCategoryFormSection'
import { FieldRenderer } from '../features/postAdCategoryForm/components/FieldRenderer'
import { LocationMapPicker } from '../features/postAdCategoryForm/components/LocationMapPicker'
import { FIELD_KIND, getFieldKind } from '@shared/utils/dynamicFormFieldKind'
import { resolveFieldDisplayValue } from '@shared/utils/dynamicFormDisplay'
import { savePostAdDraft, loadPostAdDraft, clearPostAdDraft } from '@shared/utils/postAdDraftStore'

const TOTAL_STEPS = 6

/** The auth gate (internal step 1) is invisible to already-authenticated, verified
 *  users, so it isn't counted as a numbered step in the URL/progress UI — the
 *  category screen (internal step 2) is what users see and reads as "step 1" there. */
const DISPLAY_TOTAL_STEPS = TOTAL_STEPS - 1
const toDisplayStep = (internalStep) => Math.max(1, internalStep - 1)
const toInternalStep = (displayStep) => displayStep + 1

/** Motors stops at the subcategory level: picking a subcategory goes straight to the
 *  dynamic form (keyed off that subcategory) instead of asking for a child category.
 *  Every other root category keeps its full child-category drill-down. */
const isMotorsRootCategory = (name) => String(name || '').trim().toLowerCase() === 'motors'

/** All listings use UAE Dirham (Dubai / UAE marketplace). */
const MARKETPLACE_CURRENCY = 'AED'

function hasFormPayloadValue(value) {
  if (value === undefined || value === null) return false
  if (typeof value === 'string' && value.trim() === '') return false
  if (Array.isArray(value) && value.length === 0) return false
  return true
}

function assignIfPresent(target, key, value) {
  if (!hasFormPayloadValue(value)) return
  target[key] = value
}

// Step 1: Authentication Check
function Step1Auth({ user, onNext }) {
  if (!user) {
    return (
      <div className="card text-center py-8 sm:py-12 px-4">
        <AlertCircle className="w-12 h-12 sm:w-16 sm:h-16 text-yellow-500 mx-auto mb-4" />
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Authentication Required</h2>
        <p className="text-gray-600 mb-6">You must be logged in to post an ad</p>
        <button
          onClick={() => window.location.href = '/login'}
          className="btn-primary"
        >
          Login / Sign Up
        </button>
      </div>
    )
  }

  // Admins can bypass verification check
  const isAdmin = user.role === 'admin'
  if (!isAdmin && !user.isVerified) {
    return (
      <div className="card text-center py-8 sm:py-12 px-4">
        <AlertCircle className="w-12 h-12 sm:w-16 sm:h-16 text-yellow-500 mx-auto mb-4" />
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Verification Required</h2>
        <p className="text-gray-600 mb-6">Your account needs to be verified to post ads</p>
        <p className="text-sm text-gray-500">Please contact support to verify your account</p>
      </div>
    )
  }

  return (
    <div className="card text-center py-8 sm:py-12 px-4">
      <CheckCircle className="w-12 h-12 sm:w-16 sm:h-16 text-green-500 mx-auto mb-4" />
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
        Welcome{isAdmin ? ' Admin' : ''}, {user.name}!
      </h2>
      <p className="text-gray-600 mb-6">You're ready to post your ad</p>
      <button type="button" onClick={onNext} className="btn-primary">
        Continue
      </button>
    </div>
  )
}

const CATEGORY_CARD_THEMES = [
  { pattern: /\b(motor|vehicle|car|auto)\b/i, bg: '#FFF8E6', ring: 'ring-amber-300', iconClass: 'text-amber-500', Icon: Car },
  { pattern: /\b(property|real estate|villa|apartment|home)\b/i, bg: '#EBF6FF', ring: 'ring-sky-300', iconClass: 'text-sky-500', Icon: Building2 },
  { pattern: /\b(fashion|clothing|accessories)\b/i, bg: '#FFF0F6', ring: 'ring-pink-300', iconClass: 'text-pink-500', Icon: Shirt },
  { pattern: /\b(furniture|garden|home decor)\b/i, bg: '#EDFAF3', ring: 'ring-emerald-300', iconClass: 'text-emerald-600', Icon: Sofa },
  { pattern: /\b(classified|general|other)\b/i, bg: '#FFF3EB', ring: 'ring-orange-300', iconClass: 'text-orange-500', Icon: Newspaper },
  { pattern: /\b(mobile|tablet)\b/i, bg: '#EEF2FF', ring: 'ring-indigo-300', iconClass: 'text-indigo-500', Icon: Smartphone },
  { pattern: /\b(electronics|phone|laptop|gaming|computer)\b/i, bg: '#F0F1FA', ring: 'ring-violet-300', iconClass: 'text-violet-500', Icon: Smartphone },
]

function getCategoryCardTheme(name) {
  const match = CATEGORY_CARD_THEMES.find((item) => item.pattern.test(name || ''))
  return match || { bg: '#F4F6F8', ring: 'ring-slate-300', iconClass: 'text-slate-500', Icon: LayoutGrid }
}

function getPostAdCategoryCardImageUrl(category) {
  const path = category?.categoryImage
  if (!path || typeof path !== 'string') return null
  return getMediaUrl(path) || path
}

/** Card background is the admin-configured `category.colorCode`; the hardcoded
 *  theme only fills in for categories that don't have one set yet. */
function CategoryPickerCard({ category, selected, onSelect }) {
  const theme = getCategoryCardTheme(category?.name)
  const Icon = theme.Icon
  const imageSrc = getPostAdCategoryCardImageUrl(category)
  const [imageFailed, setImageFailed] = useState(false)
  const bgColor = /^#[0-9A-Fa-f]{3,8}$/.test(category?.colorCode || '') ? category.colorCode : theme.bg

  return (
    <button
      type="button"
      onClick={() => onSelect(category._id)}
      style={{ backgroundColor: bgColor }}
      className={`group relative flex aspect-square w-full min-w-0 flex-col justify-between rounded-2xl p-4 text-left transition-all sm:p-5 ${
        selected ? 'shadow-md scale-[1.02] ring-2 ring-black/10' : 'hover:shadow-md hover:scale-[1.01]'
      }`}
    >
      <div className="flex items-start justify-start">
        {imageSrc && !imageFailed ? (
          <img
            src={imageSrc}
            alt=""
            className="h-10 w-10 object-contain"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <Icon className={`h-10 w-10 ${theme.iconClass}`} strokeWidth={2} />
        )}
      </div>
      <span className="text-base font-medium text-gray-800 leading-snug">
        {category.name}
      </span>
    </button>
  )
}

// Step 2: Category grid — tap a card to continue to the next step
function Step2Category({
  levelOptions,
  selectedPath,
  onCategorySelect,
  onContinue,
  onBack,
  loadingLevels,
  register,
  errors,
}) {
  const rootOptions = levelOptions[0] || []
  const rootId = selectedPath[0] || ''

  return (
    <div className="post-ad-step-shell-wide items-center justify-center">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="self-start mb-6 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-800"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
      )}
      <div className="text-center mb-8 sm:mb-10 md:mb-12 w-full">
        <h2 className="post-ad-step-heading">Let&apos;s get started!</h2>
        <p className="post-ad-step-subheading">Select the area that suits your ad best.</p>
      </div>

      {loadingLevels && !rootOptions.length ? (
        <div className="flex justify-center py-16 sm:py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      ) : (
        <div className="grid w-full max-w-[840px] grid-cols-1 min-[420px]:grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 md:gap-5 lg:gap-6">
          {rootOptions.map((cat) => (
            <CategoryPickerCard
              key={cat._id}
              category={cat}
              selected={String(rootId) === String(cat._id)}
              onSelect={onCategorySelect}
            />
          ))}
        </div>
      )}

      {errors.category && (
        <p className="mt-6 text-center text-sm text-red-600">{errors.category.message}</p>
      )}

      <input type="hidden" {...register('category', { required: 'Category is required' })} />
      <input type="hidden" {...register('subcategory')} />
      <input type="hidden" {...register('childCategory')} />
    </div>
  )
}

function Step2Subcategory({
  rootCategoryName,
  subcategories,
  selectedSubcategoryId,
  onSubcategorySelect,
  onBack,
  loading,
  register,
  errors,
}) {
  return (
    <div className="post-ad-step-shell-narrow">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="self-start mb-8 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-800"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
      )}

      <nav className="mb-6 flex items-center gap-2 text-sm text-gray-500" aria-label="Breadcrumb">
        <Home className="h-4 w-4 shrink-0" aria-hidden />
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
        <span className="font-medium text-gray-800">{rootCategoryName || 'Category'}</span>
      </nav>

      <div className="text-center mb-6 sm:mb-8 w-full">
        <h2 className="post-ad-step-heading">Now choose the right category for your ad</h2>
        <p className="post-ad-step-subheading">Select the area that suits your ad best.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      ) : subcategories.length === 0 ? (
        <p className="text-center text-sm text-gray-500 py-8">No subcategories available. Go back and pick another category.</p>
      ) : (
        <ul className="w-full divide-y divide-gray-200 border-t border-gray-200">
          {subcategories.map((sub) => {
            const isSelected = String(selectedSubcategoryId) === String(sub._id)
            return (
              <li key={sub._id}>
                <button
                  type="button"
                  onClick={() => onSubcategorySelect(sub._id)}
                  className={`flex w-full items-center justify-between py-4 text-left transition ${
                    isSelected ? 'text-primary-700 font-semibold' : 'text-gray-900 hover:text-primary-700'
                  }`}
                >
                  <span className="text-base sm:text-[17px] md:text-lg pr-2">{sub.name}</span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-gray-400" />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {errors.subcategory && (
        <p className="mt-4 text-center text-sm text-red-600">{errors.subcategory.message}</p>
      )}

      <input type="hidden" {...register('subcategory')} />
    </div>
  )
}

const POST_AD_BLUE = '#2563eb'
const POST_AD_NAVY = '#1e3a5f'
const POST_AD_INPUT =
  'w-full rounded-xl border-0 bg-[#eef0f6] px-4 py-3.5 text-[15px] text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-[#2563eb]/25 focus:outline-none'

const VIDEO_TIPS = [
  'Show the item from multiple angles',
  'Zoom in on important details',
  'Speak clearly and naturally',
  'Keep it under 2 minutes',
  'Use good lighting for a clear view',
]

// Safe video src: use .url for existing (edit) video objects; createObjectURL only for File/Blob, with cleanup
function useVideoPreviewSrc(videoFile) {
  const [objectUrl, setObjectUrl] = useState(null)
  useEffect(() => {
    if (!videoFile) {
      setObjectUrl(null)
      return
    }
    if (typeof videoFile === 'object' && videoFile !== null && 'url' in videoFile && typeof videoFile.url === 'string') {
      setObjectUrl(null)
      return
    }
    if (videoFile instanceof File || videoFile instanceof Blob) {
      const url = URL.createObjectURL(videoFile)
      setObjectUrl(url)
      return () => {
        URL.revokeObjectURL(url)
      }
    }
    setObjectUrl(null)
  }, [videoFile])
  if (!videoFile) return ''
  if (typeof videoFile === 'object' && videoFile !== null && 'url' in videoFile && typeof videoFile.url === 'string')
    return videoFile.url
  return objectUrl || ''
}

// Safe image preview: use .url when present; createObjectURL only for File/Blob, with cleanup
function useImagePreviewSrc(file) {
  const [objectUrl, setObjectUrl] = useState(null)
  useEffect(() => {
    if (!file) {
      setObjectUrl(null)
      return
    }
    if (typeof file === 'object' && file !== null && typeof file.url === 'string') {
      setObjectUrl(null)
      return
    }
    if (file instanceof File || file instanceof Blob) {
      const url = URL.createObjectURL(file)
      setObjectUrl(url)
      return () => URL.revokeObjectURL(url)
    }
    setObjectUrl(null)
  }, [file])
  if (!file) return ''
  if (typeof file === 'object' && file !== null && typeof file.url === 'string') return file.url
  return objectUrl || ''
}

function ImagePreviewImg({ file, alt, className }) {
  const src = useImagePreviewSrc(file)
  if (!src) return null
  return <img src={src} alt={alt} className={className} />
}

// Step 3: Video Upload & Auto-fill
function Step3VideoUpload({
  videoFile,
  setVideoFile,
  setValue,
  getValues,
  watch,
  register,
  errors,
  selectedCategory,
  subcategories,
  categories,
  breadcrumbItems = [],
  onBack,
  onNext,
  imageFiles,
  setImageFiles,
  setAiListingExtraction,
  setAiListingConfidence,
  setAiListingMissingFields,
  aiListingExtraction,
  aiListingConfidence,
  aiListingMissingFields,
  aiListingUserOverrides,
  setAiListingUserOverrides,
}) {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const [isProcessing, setIsProcessing] = useState(false)
  const [uploadStage, setUploadStage] = useState('idle') // idle | uploading | uploaded | transcribing | ready
  const [transcript, setTranscript] = useState('')
  const [extractedData, setExtractedData] = useState(null)
  const [screenshots, setScreenshots] = useState([])
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false)
  const [tipIndex, setTipIndex] = useState(0)
  useEffect(() => {
    const id = setInterval(() => {
      setTipIndex((i) => (i + 1) % VIDEO_TIPS.length)
    }, 4500)
    return () => clearInterval(id)
  }, [])
  const videoRef = useRef(null)
  const captureVideoInputRef = useRef(null)
  const savedVideoPositionRef = useRef(null)
  const videoPreviewSrc = useVideoPreviewSrc(videoFile)

  const handleVideoUpload = async (e) => {
    const file = e.target.files[0]
    if (file) {
      const isVideo = file.type.startsWith('video/') || 
                      file.name.toLowerCase().endsWith('.mp4') ||
                      file.name.toLowerCase().endsWith('.mov') ||
                      file.name.toLowerCase().endsWith('.avi') ||
                      file.name.toLowerCase().endsWith('.mkv') ||
                      file.name.toLowerCase().endsWith('.webm')
      
      if (isVideo) {
        const maxSize = 20 * 1024 * 1024 // 20MB
        if (file.size > maxSize) {
          toast.error('Video exceeds 20MB limit')
          return
        }
        
        setVideoFile(file)
        setValue('video', file)
        setUploadStage('uploading')

        // Enforce minimum duration client-side to provide fast feedback.
        // Backend will enforce too, but this prevents wasted uploads.
        let durationValid = true
        await new Promise((resolve) => {
          try {
            const videoEl = document.createElement('video')
            videoEl.preload = 'metadata'
            videoEl.onloadedmetadata = () => {
              const duration = Number(videoEl.duration || 0)
              if (duration < 15) {
                durationValid = false
                toast.error('Video must be at least 15 seconds long.')
                setVideoFile(null)
                setValue('video', null)
              }
              resolve()
            }
            videoEl.onerror = () => resolve()
            videoEl.src = URL.createObjectURL(file)
          } catch {
            resolve()
          }
        })

        if (!durationValid) {
          setUploadStage('idle')
          return
        }

        setUploadStage('uploaded')
        
        // Automatically process video for transcription
        await processVideo(file)
      } else {
        toast.error('Please upload a video file (MP4, MOV, AVI, etc.)')
      }
    }
  }

  const processVideo = async (file) => {
    if (!isAuthenticated) {
      toast.error('Please sign in to process your video with AI.')
      navigate('/login?target=seller', { replace: true })
      return
    }

    setIsProcessing(true)
    setUploadStage('transcribing')
    setTranscript('')
    setExtractedData(null)
    
    try {
      // Use RHF values first to avoid stale local state.
      const rootCategoryId = watch('category') || selectedCategory
      const subcategoryId = watch('subcategory')
      const selectedCategoryObj = categories.find((cat) => String(cat._id) === String(rootCategoryId))
      const selectedSubcategory = (subcategories || []).find((sub) => String(sub._id) === String(subcategoryId))
      
      const categoryName = selectedCategoryObj?.name || ''
      const subcategoryName = selectedSubcategory?.name || ''
      
      toast.loading('Transcribing video and extracting information...', { id: 'transcribe' })
      
      const childCategoryId = watch('childCategory') || ''

      const response = await videoService.transcribeVideo(
        file,
        categoryName,
        subcategoryName,
        {
          categoryId: rootCategoryId || '',
          subcategoryId: subcategoryId || '',
          childCategoryId,
        }
      )
      
      console.log('Video transcription response:', response.data)
      
      const {
        transcript: videoTranscript,
        extractedData: data,
        suggestedFilters,
        categoryValidation,
        vehicleEnrichment: transcriptEnrichment,
        colorDetection,
        errors,
      } = response.data
      
      setTranscript(videoTranscript || '')
      setExtractedData(data || null)
      if (colorDetection?.source === 'video_vision' && colorDetection?.exteriorColor) {
        toast.success(`Detected exterior color from video: ${colorDetection.exteriorColor}`, {
          id: 'color-detect',
          duration: 4000,
        })
      }
      setValue('__transcript', videoTranscript || '', { shouldDirty: false, shouldTouch: false })
      setValue('__extractedData', data || null, { shouldDirty: false, shouldTouch: false })

      // Vehicle-specific structured extraction via centralized AI mapping service.
      let aiPayload = null
      const isVehicleCategory = /vehicles?|motors?|cars?|auto/i.test(String(categoryName || ''))
      if (isVehicleCategory && (videoTranscript || data)) {
        try {
          toast.loading('Enriching vehicle specifications with AI...', { id: 'ai-extract' })
          const vehicleType = /bicycle|bike/i.test(subcategoryName) && !/motor/i.test(subcategoryName)
            ? 'bicycles'
            : /motorcycle|motorbike|scooter/i.test(subcategoryName)
              ? 'motorcycles'
              : 'cars'

          const aiRes = await listingService.aiExtract({
            input_text: videoTranscript ? String(videoTranscript) : '',
            extracted_data: data || undefined,
            vehicle_type: vehicleType,
            subcategory_name: subcategoryName,
            category_name: categoryName,
            category_filters: getValues('__categoryFilters') || [],
          })
          aiPayload = aiRes?.data || null

          // Reuse enrichment from transcribe step when present (avoids duplicate OpenAI via server cache).
          if (transcriptEnrichment && aiPayload && !aiPayload.enrichment) {
            aiPayload = {
              ...aiPayload,
              enrichment: {
                source: transcriptEnrichment.source,
                confidence: transcriptEnrichment.confidence,
                profile: transcriptEnrichment.profile,
                vehicleSpecifications: transcriptEnrichment.vehicleSpecifications,
                specifications: transcriptEnrichment.specifications,
                transcription_fields: transcriptEnrichment.transcription_fields,
                enriched_fields: transcriptEnrichment.enriched_fields,
                not_found_fields: transcriptEnrichment.not_found_fields,
              },
              vehicleSpecifications: transcriptEnrichment.vehicleSpecifications,
            }
          }

          if (aiPayload) {
            setAiListingExtraction(aiPayload)
            setValue('__aiListingExtraction', aiPayload, { shouldDirty: false, shouldTouch: false })
            setValue(
              '__vehicleSpecifications',
              aiPayload.vehicleSpecifications || transcriptEnrichment?.vehicleSpecifications || null,
              { shouldDirty: false, shouldTouch: false },
            )
            setAiListingConfidence(aiPayload?.confidence || {})
            setAiListingMissingFields(Array.isArray(aiPayload?.missing_fields) ? aiPayload.missing_fields : [])
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error('AI extraction failed:', e)
          setAiListingExtraction(null)
          setAiListingConfidence({})
          setAiListingMissingFields([])
        } finally {
          toast.dismiss('ai-extract')
        }
      }

      if (categoryValidation) {
        console.log('[PostAd] Category validation:', categoryValidation)
        if (categoryValidation.filtersAvailable > 0) {
          console.log(`[PostAd] ${categoryValidation.filtersAvailable} DB filters available for selected category`)
        }
      }

      if (suggestedFilters?.selections) {
        const categoryFilterList = getValues('__categoryFilters') || []
        const sanitizedSelections = omitAdsPostedFromSelections(
          suggestedFilters.selections,
          categoryFilterList,
        )
        setValue('__suggestedFilters', sanitizedSelections, { shouldDirty: false, shouldTouch: false })
        console.log('[PostAd] Suggested filter selections from transcript:', sanitizedSelections)

        // Also pre-set filter values directly in the form so they're available at submission
        // even before the filter dropdowns load in Step 4.
        Object.entries(sanitizedSelections).forEach(([key, value]) => {
          if (key.startsWith('filter_') && value) {
            setValue(key, mergeFilterValues(getValues(key), value), { shouldDirty: true, shouldTouch: true })
          }
        })

        // Store enriched filter data (with DB IDs) for the backend to use
        if (suggestedFilters.filterData) {
          setValue('__suggestedFilterData', suggestedFilters.filterData, { shouldDirty: false, shouldTouch: false })
        }
      }
      
      // Log any errors
      if (errors) {
        if (errors.transcription) {
          console.error('Transcription error:', errors.transcription)
          toast.error(`Video transcription failed: ${errors.transcription}`, { duration: 6000 })
        }
        if (errors.extraction) {
          console.error('Extraction error:', errors.extraction)
          toast.error(`Data extraction failed: ${errors.extraction}`, { duration: 5000 })
        }
        if (errors.enrichment) {
          console.warn('Vehicle enrichment error:', errors.enrichment)
          toast.error(`Vehicle spec enrichment failed: ${errors.enrichment}`, { duration: 5000 })
        }
      }
      
      // Helper: sanitize extracted text (remove URLs, emails, phone numbers)
      const sanitizeText = (text) => {
        if (!text || typeof text !== 'string') return text
        let s = text
        // Remove URLs
        s = s.replace(/https?:\/\/\S+/gi, '')
        s = s.replace(/\bwww\.\S+\b/gi, '')
        // Remove emails
        s = s.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, '')
        // Remove phone-like numbers: sequences of digits, spaces, parentheses, dashes of length >=7
        s = s.replace(/(?:\+?\d[\d\-\s().]{6,}\d)/g, '')
        // Trim repeated whitespace
        s = s.replace(/\s{2,}/g, ' ').trim()
        return s
      }

      // Auto-fill form fields (sanitize transcription-derived content)
      if (data) {
        const isVehicle = /vehicles?|motors?|cars?|auto/i.test(String(categoryName || ''))

        // Title
        if (data.title) {
          setValue('title', sanitizeText(data.title))
        }
        
        // Description
        if (data.description) {
          setValue('description', sanitizeText(data.description))
        }
        
        // Price and Currency
        if (data.price) {
          setValue('price', data.price)
        }

        // Location (Step 7)
        if (data.country) {
          setValue('country', sanitizeText(data.country))
        }
        if (data.city) {
          setValue('city', sanitizeText(data.city))
        }
        if (data.area) {
          setValue('area', sanitizeText(data.area))
        }

        // Currency (Step 6)
        const mapCountryToCurrency = (country) => {
          const s = country ? String(country).trim().toLowerCase() : ''
          if (!s) return null
          if (s.includes('united arab emirates') || s.includes('uae') || s.includes('dubai') || s.includes('abu dhabi') || s.includes('sharjah')) return 'AED'
          if (s.includes('saudi')) return 'SAR'
          if (s.includes('qatar')) return 'QAR'
          if (s.includes('kuwait')) return 'KWD'
          if (s.includes('oman')) return 'OMR'
          if (s.includes('bahrain')) return 'BHD'
          if (s.includes('pakistan')) return 'PKR'
          if (s.includes('india') || s === 'inr') return 'INR'
          if (s.includes('united kingdom') || s.includes('uk') || s.includes('great britain') || s.includes('britain')) return 'GBP'
          if (s.includes('europe') || s.includes('euro') || s.includes('germany') || s.includes('france') || s.includes('italy') || s.includes('spain') || s.includes('netherlands')) return 'EUR'
          if (s.includes('united states') || s.includes('usa') || s.includes('america') || s.includes('canada')) return 'USD'
          return null
        }

        const derivedCountry = data.country ? String(data.country) : ''
        const derivedCurrency = mapCountryToCurrency(derivedCountry) || mapCountryToCurrency(data.city)

        if (data.currency) setValue('currency', String(data.currency).toUpperCase())
        else if (derivedCurrency) setValue('currency', derivedCurrency)
        else setValue('currency', MARKETPLACE_CURRENCY)
        
        // Condition - ensure exact match with dropdown options
        if (data.condition) {
          const conditionMap = {
            'brand new': 'Brand New',
            'like new': 'Like New',
            'good': 'Good',
            'fair': 'Fair',
            'poor': 'Poor',
            'excellent': 'Like New',
            'new': 'Brand New',
            'used': 'Good',
            'worn': 'Fair',
            'damaged': 'Poor'
          }
          const normalizedCondition = data.condition.toLowerCase().trim()
          const mappedCondition = conditionMap[normalizedCondition] || data.condition
          // Only set if it matches one of the valid options
          const validConditions = ['Brand New', 'Like New', 'Good', 'Fair', 'Poor']
          if (validConditions.includes(mappedCondition)) {
            setValue('condition', [mappedCondition])
          }
        }
        
        // Brand / Make mapping:
        // - Always populate generic `brand` (used by many categories + title placeholder).
        // - For vehicles, extracted "brand" usually represents the car make (Toyota, Mercedes, etc.),
        //   so also populate vehicle-specific `make`.
        if (data.brand) {
          const brandVal = String(data.brand).trim()
          const categoryFieldKey = resolveCategoryKeyForFields(categoryName)
          const options = getBrandOptionsForCategory(categoryFieldKey, subcategoryName) || []

          // Generic brand (for all categories)
          setValue('brand', brandVal)
          if (options.length > 0) {
            if (options.includes(brandVal)) setValue('brandChoice', [brandVal])
            else setValue('brandChoice', ['Other'])
          } else {
            setValue('brandChoice', [brandVal])
          }

          // Vehicles: also set `make` when brand is present.
          if (isVehicle) {
            setValue('make', brandVal)
          }
        }
        
        // Color — prefer video vision when transcript did not mention color; do not overwrite user edits.
        if (data.color && (!getValues('color') || data.colorSource === 'video_vision')) {
          setValue('color', String(data.color).trim())
        }
        if (
          data.interiorColor &&
          (!getValues('interiorColor') || data.interiorColorSource === 'video_vision')
        ) {
          setValue('interiorColor', String(data.interiorColor).trim())
        }
        
        // Material
        if (data.material) {
          setValue('material', data.material)
        }
        
        // Model
        if (data.model) {
          setValue('model', String(data.model).trim())
        }
        
        // Year
        if (data.year) {
          setValue('year', data.year)
        }
        
        // Purchase Year / Usage Details (Step 5)
        let resolvedPurchaseYear = null
        if (data.purchaseYear !== undefined && data.purchaseYear !== null && data.purchaseYear !== '') {
          const n = Number(data.purchaseYear)
          if (!Number.isNaN(n) && Number.isFinite(n)) {
            resolvedPurchaseYear = n
            setValue('purchaseYear', n)
          }
        }
        // Fallback: if purchaseYear not mentioned, use extracted model year (vehicles).
        if (!resolvedPurchaseYear && data.year !== undefined && data.year !== null && data.year !== '') {
          const n = Number(data.year)
          if (!Number.isNaN(n) && Number.isFinite(n)) {
            resolvedPurchaseYear = n
            setValue('purchaseYear', n)
          }
        }

        // Mileage
        if (data.mileage) {
          setValue('mileage', data.mileage)
        }

        // Usage Duration (supports { value, unit } and loose "2 years"/"6 months" strings)
        if (data.usageDuration) {
          try {
            const ud = data.usageDuration
            if (typeof ud === 'object' && ud) {
              const val = ud.value !== undefined && ud.value !== null && ud.value !== '' ? Number(ud.value) : null
              const unitRaw = ud.unit ? String(ud.unit).trim().toLowerCase() : ''
              const unit = unitRaw.includes('month') ? 'months' : unitRaw.includes('year') ? 'years' : null
              if (val !== null && Number.isFinite(val) && unit) {
                setValue('usageDuration.value', val)
                setValue('usageDuration.unit', unit)
              }
            } else if (typeof ud === 'string') {
              const s = ud.toLowerCase()
              const valMatch = s.match(/-?\d+(?:\.\d+)?/)
              const val = valMatch ? Number(valMatch[0]) : null
              const unit = s.includes('month') ? 'months' : s.includes('year') ? 'years' : null
              if (val !== null && Number.isFinite(val) && unit) {
                setValue('usageDuration.value', val)
                setValue('usageDuration.unit', unit)
              }
            }
          } catch {
            // Ignore parsing errors; allow manual fallback.
          }
        }
        // Auto-calculate usage duration if not provided but purchaseYear exists.
        if (!data.usageDuration && resolvedPurchaseYear && Number.isFinite(Number(resolvedPurchaseYear))) {
          const currentYear = new Date().getFullYear()
          const deltaYears = Math.max(0, currentYear - Number(resolvedPurchaseYear))
          if (deltaYears >= 1) {
            setValue('usageDuration.value', deltaYears)
            setValue('usageDuration.unit', 'years')
          } else {
            // Best-effort months when less than a year; default to 0 months.
            const now = new Date()
            const monthsNow = now.getFullYear() * 12 + now.getMonth()
            const approxPurchase = new Date(Number(resolvedPurchaseYear), 0, 1)
            const monthsPurchase = approxPurchase.getFullYear() * 12 + approxPurchase.getMonth()
            const deltaMonths = Math.max(0, monthsNow - monthsPurchase)
            setValue('usageDuration.value', deltaMonths)
            setValue('usageDuration.unit', 'months')
          }
        }

        if (data.reasonForSelling) {
          setValue('reasonForSelling', sanitizeText(data.reasonForSelling))
        }
        
        // Storage Capacity
        if (data.storageCapacity) {
          setValue('storageCapacity', data.storageCapacity)
        }
        
        // Size
        if (data.size) {
          setValue('size', data.size)
        }
        
        // Make (for vehicles) - explicit make still wins if provided.
        if (data.make) {
          setValue('make', String(data.make).trim())
        }
        
        // Warranty
        if (data.warranty) {
          setValue('warranty', data.warranty)
        }

        // Fill any other primitive extracted fields into the form.
        // This makes transcription work across more categories without adding mappings one-by-one.
        const handledKeys = new Set([
          'title',
          'description',
          'price',
          'currency',
          'condition',
          'brand',
          'color',
          'material',
          'model',
          'year',
          'mileage',
          'storageCapacity',
          'size',
          'make',
          'warranty',
        ])

        Object.keys(data).forEach((key) => {
          if (handledKeys.has(key)) return
          const value = data[key]
          if (value === undefined || value === null || value === '') return

          // Only set primitives (numbers/booleans/strings).
          if (typeof value === 'string') {
            setValue(key, sanitizeText(value))
          } else if (typeof value === 'number' || typeof value === 'boolean') {
            setValue(key, value)
          }
        })

        // Apply centralized AI vehicle mapping (takes precedence over heuristic transcript values).
        if (aiPayload) {
          applyAiVehicleFormPrefill({
            setValue,
            getValues,
            mappingResult: aiPayload,
            context: {
              categoryName,
              subcategoryName,
              isVehicle,
            },
            onOverrides: (overrides) => {
              setAiListingUserOverrides((prev) => ({ ...prev, ...overrides }))
            },
          })

          // Apply server-computed filter dropdown selections (exact DB option values).
          if (aiPayload.filter_selections && typeof aiPayload.filter_selections === 'object') {
            const sanitizedAiFilters = omitAdsPostedFromSelections(
              aiPayload.filter_selections,
              getValues('__categoryFilters') || [],
            )
            Object.entries(sanitizedAiFilters).forEach(([key, value]) => {
              if (key.startsWith('filter_') && value) {
                const incoming = Array.isArray(value) ? value : [value]
                setValue(key, mergeFilterValues(getValues(key), incoming), {
                  shouldDirty: true,
                  shouldTouch: true,
                })
              }
            })
          }
        }

        // Category filters load at Step 2, but transcription runs at Step 3 — apply filter values now.
        applyTranscriptFilterSelections({
          filters: getValues('__categoryFilters') || [],
          getValues,
          setValue,
          suggestedFilters: omitAdsPostedFromSelections(
            suggestedFilters?.selections || {},
            getValues('__categoryFilters') || [],
          ),
          extractedData: data,
          aiExtraction: aiPayload,
          transcript: videoTranscript,
        })

        toast.success('Video processed! Form fields have been auto-filled.', { id: 'transcribe' })
      } else {
        // Apply AI mapping even if heuristic transcript extraction didn't return extractedData.
        if (aiPayload) {
          applyAiVehicleFormPrefill({
            setValue,
            getValues,
            mappingResult: aiPayload,
            context: {
              categoryName,
              subcategoryName,
              isVehicle: isVehicleCategory,
            },
            onOverrides: (overrides) => {
              setAiListingUserOverrides((prev) => ({ ...prev, ...overrides }))
            },
          })

          if (aiPayload.filter_selections && typeof aiPayload.filter_selections === 'object') {
            const sanitizedAiFilters = omitAdsPostedFromSelections(
              aiPayload.filter_selections,
              getValues('__categoryFilters') || [],
            )
            Object.entries(sanitizedAiFilters).forEach(([key, value]) => {
              if (key.startsWith('filter_') && value) {
                const incoming = Array.isArray(value) ? value : [value]
                setValue(key, mergeFilterValues(getValues(key), incoming), {
                  shouldDirty: true,
                  shouldTouch: true,
                })
              }
            })
          }
        }

        applyTranscriptFilterSelections({
          filters: getValues('__categoryFilters') || [],
          getValues,
          setValue,
          suggestedFilters: omitAdsPostedFromSelections(
            suggestedFilters?.selections || {},
            getValues('__categoryFilters') || [],
          ),
          extractedData: data,
          aiExtraction: aiPayload,
          transcript: videoTranscript,
        })

        toast.success('Video transcribed successfully!', { id: 'transcribe' })
      }

      // Auto-capture a set of listing photos from the video so the user doesn't have
      // to do it manually, then jump straight to the next step once there's enough
      // to review (title/description were already auto-filled above).
      let capturedCount = 0
      try {
        toast.loading('Capturing photos from your video...', { id: 'auto-capture' })
        const shotsRes = await videoService.autoCaptureScreenshots(file)
        const captured = Array.isArray(shotsRes.data?.screenshots) ? shotsRes.data.screenshots : []
        capturedCount = captured.length
        if (capturedCount > 0) {
          const newImages = captured.map((shot) => ({
            url: shot.url,
            name: `screenshot-${Math.floor(shot.timestamp || 0)}s.jpg`,
            isScreenshot: true,
            originalUrl: shot.url,
            timestamp: shot.timestamp,
          }))
          setImageFiles((prev) => [...prev, ...newImages])
          toast.success(`Captured ${capturedCount} photos from your video!`, { id: 'auto-capture' })
        } else {
          toast.dismiss('auto-capture')
        }
      } catch (captureError) {
        console.error('Auto screenshot capture failed:', captureError)
        toast.dismiss('auto-capture')
      }

      setUploadStage('ready')

      const titleReady = (watch('title') || '').trim().length >= 10
      const descriptionReady = (watch('description') || '').trim().length >= 30
      if (capturedCount > 0 && titleReady && descriptionReady) {
        onNext()
      }
    } catch (error) {
      console.error('Error processing video:', error)
      toast.dismiss('transcribe')
      toast.dismiss('ai-extract')

      if (error.response?.status === 401) {
        dispatch(clearSession())
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        localStorage.removeItem('permissions')
        toast.error('Your session has expired. Please sign in again to use AI video extraction.')
        navigate('/login?target=seller', { replace: true })
        return
      }

      const errorMessage = error.response?.data?.message || error.message || 'Failed to process video'
      toast.error(errorMessage, { duration: 5000 })
      setUploadStage('uploaded')
    } finally {
      setIsProcessing(false)
    }
  }

  const removeVideo = () => {
    setVideoFile(null)
    setValue('video', null)
    setUploadStage('idle')
    setTranscript('')
    setExtractedData(null)
    setScreenshots([])
    setAiListingExtraction(null)
    setAiListingConfidence({})
    setAiListingMissingFields([])
    setAiListingUserOverrides({
      engine_cc: null,
      horsepower: null,
      accident_free: null,
    })
    setValue('__suggestedFilters', null, { shouldDirty: false, shouldTouch: false })
    setValue('__suggestedFilterData', null, { shouldDirty: false, shouldTouch: false })
    setValue('__extractedData', null, { shouldDirty: false, shouldTouch: false })
    setValue('__transcript', '', { shouldDirty: false, shouldTouch: false })
    setValue('__aiListingExtraction', null, { shouldDirty: false, shouldTouch: false })
    // Remove screenshot images from imageFiles
    setImageFiles(prev => prev.filter(file => !file.isScreenshot))
  }

  const captureScreenshot = async () => {
    if (!videoRef.current || !videoFile) {
      toast.error('Video not loaded')
      return
    }

    const video = videoRef.current
    const currentTime = video.currentTime
    const wasPlaying = !video.paused

    if (currentTime === 0 && video.duration === 0) {
      toast.error('Please play the video first to capture a screenshot')
      return
    }

    setIsCapturingScreenshot(true)
    
    try {
      toast.loading('Capturing screenshot...', { id: 'screenshot' })
      
      const response = await videoService.captureScreenshot(videoFile, currentTime)
      const { screenshot } = response.data

      const BASE_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:8029'
      const screenshotUrl = screenshot.url.startsWith('http') 
        ? screenshot.url 
        : `${BASE_URL}${screenshot.url}`

      // Add screenshot to list
      const newScreenshot = {
        ...screenshot,
        url: screenshotUrl,
        id: Date.now() // Unique ID for this screenshot
      }
      
      setScreenshots(prev => [...prev, newScreenshot])

      // Add to imageFiles
      const screenshotFile = {
        url: screenshotUrl,
        name: `screenshot-${Math.floor(screenshot.timestamp)}s.jpg`,
        isScreenshot: true,
        originalUrl: screenshot.url,
        timestamp: screenshot.timestamp
      }
      
      setImageFiles(prev => [...prev, screenshotFile])
      
      // Store position to restore after render
      savedVideoPositionRef.current = { currentTime, wasPlaying }
      
      // Restore video position and playing state after React finishes rendering
      // Use requestAnimationFrame to ensure DOM is updated and browser has painted
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (videoRef.current && savedVideoPositionRef.current) {
            const { currentTime: savedTime, wasPlaying: savedWasPlaying } = savedVideoPositionRef.current
            videoRef.current.currentTime = savedTime
            if (savedWasPlaying) {
              videoRef.current.play().catch(() => {
                // Ignore play errors (user might have paused manually)
              })
            }
            savedVideoPositionRef.current = null
          }
        })
      })
      
      toast.success(`Screenshot captured at ${Math.floor(screenshot.timestamp)}s!`, { id: 'screenshot' })
    } catch (error) {
      console.error('Error capturing screenshot:', error)
      const errorMessage = error.response?.data?.message || error.message || 'Failed to capture screenshot'
      toast.error(errorMessage, { id: 'screenshot' })
      
      // Restore video position even on error
      savedVideoPositionRef.current = { currentTime, wasPlaying: false }
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (videoRef.current && savedVideoPositionRef.current) {
            videoRef.current.currentTime = savedVideoPositionRef.current.currentTime
            savedVideoPositionRef.current = null
          }
        })
      })
    } finally {
      setIsCapturingScreenshot(false)
    }
  }

  const removeScreenshot = (screenshotId) => {
    // Avoid calling setState inside another setState updater (React warns in concurrent rendering).
    const removed = screenshots.find((s) => s.id === screenshotId)
    setScreenshots((prev) => prev.filter((s) => s.id !== screenshotId))
    if (removed) {
      setImageFiles((current) =>
        current.filter((file) => !file.isScreenshot || file.originalUrl !== removed.url)
      )
    }
  }

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files)
    const newImageFiles = files.filter((file) => {
      if (!file.type.startsWith('image/')) return false
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 10MB limit`)
        return false
      }
      return true
    })
    
    // Filter out screenshots from count
    const nonScreenshotImages = imageFiles.filter(file => !file.isScreenshot)
    if (nonScreenshotImages.length + newImageFiles.length > 20) {
      toast.error('Maximum 20 images allowed')
      return
    }
    
    setImageFiles((prev) => [...prev, ...newImageFiles])
  }

  const removeImage = (index) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleContinue = () => {
    // Title/description are optional here — enforced on the later review step.
    if (!videoFile) {
      toast.error('Please upload or capture a video')
      return
    }
    const nonScreenshotImages = imageFiles.filter((file) => !file.isScreenshot)
    const screenshotImages = imageFiles.filter((file) => file.isScreenshot)
    if (nonScreenshotImages.length === 0 && screenshotImages.length === 0) {
      toast.error('Please upload at least 1 image or capture a screenshot')
      return
    }
    onNext()
  }

  const currentTipText = VIDEO_TIPS[tipIndex % VIDEO_TIPS.length]

  return (
    <div className="post-ad-step-shell-narrow pb-32 sm:pb-36">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="self-start mb-6 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-800"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
      )}

      <div className="text-center mb-5 sm:mb-6 w-full">
        <h2 className="post-ad-step-heading">Create or upload your reel and watch the magic happen</h2>
        <p className="post-ad-step-subheading">
          Upload your video and let AI auto-fill the details, so you can save time and get started faster.
        </p>
      </div>

      <PostAdListingBreadcrumb items={[...breadcrumbItems, 'upload video']} />

      <div className="space-y-5 sm:space-y-6 w-full">
        {/* <div style={{ display: 'none' }}>
          <label className="block text-sm font-medium text-gray-800 mb-2">
            Title
          </label>
          <div className="relative">
            <input
              type="text"
              {...register('title')}
              className={`${POST_AD_INPUT} pr-11`}
              placeholder="Enter product title"
            />
            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          </div>
          {errors?.title && <p className="mt-1.5 text-sm text-red-600">{errors.title.message}</p>}
        </div> */}

        {/* <div style={{ display: 'none' }}>
          <label className="block text-sm font-medium text-gray-800 mb-2">
            Description
          </label>
          <textarea
            {...register('description')}
            rows={6}
            className={`${POST_AD_INPUT} resize-none min-h-[150px]`}
            placeholder="Enter product description"
          />
          {errors?.description && (
            <p className="mt-1.5 text-sm text-red-600">{errors.description.message}</p>
          )}
        </div> */}

        {!videoFile ? (
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-4">
            <label className="flex min-h-[200px] w-full flex-1 cursor-pointer flex-col items-center justify-center rounded-3xl border border-[#2563eb] bg-white px-3 py-8 transition hover:bg-blue-50/40 sm:min-h-[260px] sm:py-10 md:min-h-[280px]">
              <UploadCloud className="mb-4 h-10 w-10 text-[#2563eb] sm:mb-5 sm:h-14 sm:w-14" strokeWidth={1.5} />
              <span className="text-base font-semibold text-gray-900 sm:text-lg">Upload Video</span>
              <span className="mt-1.5 text-xs text-gray-500 sm:text-sm">Max video duration 2 mins</span>
              <input
                type="file"
                className="hidden"
                accept="video/mp4,video/quicktime,video/x-msvideo,video/x-matroska,video/webm,.mp4,.mov,.avi,.mkv,.webm"
                onChange={handleVideoUpload}
                disabled={isProcessing}
              />
            </label>
            <span className="shrink-0 text-center text-sm font-medium text-gray-400 sm:text-left">Or</span>
            <button
              type="button"
              onClick={() => captureVideoInputRef.current?.click()}
              disabled={isProcessing}
              className="flex min-h-[200px] w-full flex-1 flex-col items-center justify-center rounded-3xl border border-[#2563eb] bg-white px-3 py-8 transition hover:bg-blue-50/40 disabled:opacity-50 sm:min-h-[260px] sm:py-10 md:min-h-[280px]"
            >
              <Camera className="mb-4 h-10 w-10 text-[#2563eb] sm:mb-5 sm:h-14 sm:w-14" strokeWidth={1.5} />
              <span className="text-base font-semibold text-gray-900 sm:text-lg">Capture Video</span>
              <span className="mt-1.5 text-xs text-gray-500 sm:text-sm">Max video duration 2 mins</span>
            </button>
            <input
              ref={captureVideoInputRef}
              type="file"
              className="hidden"
              accept="video/*"
              capture="environment"
              onChange={handleVideoUpload}
            />
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-2xl border border-[#2563eb] bg-black">
            <video
              ref={videoRef}
              src={videoPreviewSrc}
              className="max-h-[200px] w-full object-contain sm:max-h-[220px] md:max-h-[280px]"
              controls
            />
            <button
              type="button"
              onClick={removeVideo}
              className="absolute right-2 top-2 rounded-full bg-red-500 p-2 text-white hover:bg-red-600"
              aria-label="Remove video"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="pt-1">
          <p className="mb-4 text-sm text-gray-500">Tips for a great video</p>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#eef0f6]">
              <SwitchCamera className="h-6 w-6 text-[#2563eb]" strokeWidth={1.75} />
            </div>
            <p className="text-[15px] leading-snug text-gray-800">{currentTipText}</p>
          </div>
          <div className="mt-5 flex justify-center gap-2">
            {VIDEO_TIPS.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Tip ${i + 1}`}
                aria-current={i === tipIndex ? 'true' : undefined}
                onClick={() => setTipIndex(i)}
                className={`rounded-full transition-all ${
                  i === tipIndex ? 'h-2 w-2 bg-[#2563eb]' : 'h-2 w-2 bg-gray-300 hover:bg-gray-400'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {videoFile && (
        <details className="mt-8 w-full group">
          <summary className="cursor-pointer list-none text-sm font-medium text-[#2563eb] hover:underline [&::-webkit-details-marker]:hidden">
            Screenshots, photos &amp; auto-fill tools
          </summary>
          <div className="mt-4 space-y-4">
          {/* Manual Screenshot Capture */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-purple-900">
                  📸 Capture Screenshots
                </p>
                <p className="text-xs text-purple-700 mt-1">
                  Play the video and click the button to capture a screenshot at the current time
                </p>
            </div>
              <button
                type="button"
                onClick={captureScreenshot}
                disabled={isCapturingScreenshot}
                className="btn-primary flex w-full sm:w-auto shrink-0 items-center justify-center gap-2 px-4 py-2"
              >
                {isCapturingScreenshot ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Capturing...
                  </>
                ) : (
                  <>
                    <Camera className="h-4 w-4" />
                    Capture Screenshot
                  </>
                )}
              </button>
        </div>

            {screenshots.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-purple-800 mb-2">
                  Captured Screenshots ({screenshots.length})
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {screenshots.map((screenshot) => (
                    <div
                      key={screenshot.id}
                      className="relative border-2 border-purple-300 rounded-lg overflow-hidden bg-gray-100"
                    >
                      <img
                        src={screenshot.url}
                        alt={`Screenshot at ${Math.floor(screenshot.timestamp)}s`}
                        className="w-full h-auto object-contain"
                      />
                <button
                  type="button"
                        onClick={() => removeScreenshot(screenshot.id)}
                  className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
                >
                  <X className="h-3 w-3" />
                </button>
                      <div className="absolute bottom-1 left-1 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                        {Math.floor(screenshot.timestamp)}s
                      </div>
              </div>
            ))}
                </div>
              </div>
            )}
          </div>

          {(isProcessing || uploadStage !== 'idle') && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
              {[
                { key: 'uploading', label: 'Uploading Video...', done: ['uploaded', 'transcribing', 'ready'].includes(uploadStage) },
                { key: 'uploaded', label: 'Video Uploaded', done: ['uploaded', 'transcribing', 'ready'].includes(uploadStage) && uploadStage !== 'uploading' },
                { key: 'transcribing', label: 'Processing Video...', active: uploadStage === 'transcribing', done: uploadStage === 'ready' },
                { key: 'ready', label: 'Video Ready', done: uploadStage === 'ready' && !isProcessing },
              ].map(({ key, label, active, done }) => {
                const isActive = active || (key === 'uploading' && uploadStage === 'uploading') || (key === 'transcribing' && isProcessing)
                const isDone = done || (key === 'uploaded' && uploadStage !== 'uploading' && uploadStage !== 'idle')
                if (key === 'uploaded' && uploadStage === 'uploading') return null
                if (key === 'ready' && uploadStage !== 'ready') return null
                return (
                  <div
                    key={key}
                    className={`flex items-center gap-3 text-sm ${
                      isDone ? 'text-green-700' : isActive ? 'text-blue-900 font-medium' : 'text-gray-400'
                    }`}
                  >
                    {isActive && !isDone ? (
                      <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                    ) : isDone ? (
                      <CheckCircle className="h-4 w-4 flex-shrink-0" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border border-gray-300 flex-shrink-0" />
                    )}
                    <span>{label}</span>
                    {key === 'transcribing' && isActive && (
                      <span className="text-xs text-blue-700 font-normal">Transcribing and extracting information</span>
                    )}
                  </div>
                )
              })}
              <p className="text-xs text-blue-600 pt-1">
                HLS streaming files are generated in the background after you publish your listing.
              </p>
            </div>
          )}

          {transcript && !isProcessing && uploadStage === 'ready' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm font-medium text-green-900 mb-2">✓ Video transcribed successfully!</p>
              {extractedData && (
                <p className="text-xs text-green-800 mb-3">
                  Form fields have been auto-filled. Please review and continue.
                </p>
              )}
              <details className="mt-2">
                <summary className="text-xs text-green-700 cursor-pointer hover:text-green-900">
                  View transcript
                </summary>
                <p className="text-xs text-green-800 mt-2 p-2 bg-green-100 rounded">
                  {transcript}
                </p>
              </details>
            </div>
          )}


          {extractedData && !isProcessing && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-900 mb-2">Extracted Information:</p>
              <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                {extractedData.title && (
                  <div><span className="font-medium">Title:</span> {extractedData.title}</div>
                )}
                {extractedData.price && (
                  <div>
                    <span className="font-medium">Price:</span> {extractedData.currency || MARKETPLACE_CURRENCY}{' '}
                    {extractedData.price}
                  </div>
                )}
                {extractedData.currency && (
                  <div><span className="font-medium">Currency:</span> {extractedData.currency}</div>
                )}
                {extractedData.condition && (
                  <div><span className="font-medium">Condition:</span> {extractedData.condition}</div>
                )}
                {extractedData.brand && (
                  <div><span className="font-medium">Brand:</span> {extractedData.brand}</div>
                )}
                {extractedData.color && (
                  <div><span className="font-medium">Color:</span> {extractedData.color}</div>
                )}
                {extractedData.material && (
                  <div><span className="font-medium">Material:</span> {extractedData.material}</div>
                )}
                {extractedData.model && (
                  <div><span className="font-medium">Model:</span> {extractedData.model}</div>
                )}
                {extractedData.year && (
                  <div><span className="font-medium">Year:</span> {extractedData.year}</div>
                )}
                {extractedData.mileage && (
                  <div>
                    <span className="font-medium">Kilometers:</span>{' '}
                    {typeof extractedData.mileage === 'number'
                      ? `${extractedData.mileage.toLocaleString()} km`
                      : `${extractedData.mileage} km`}
                  </div>
                )}
                {extractedData.storageCapacity && (
                  <div><span className="font-medium">Storage:</span> {extractedData.storageCapacity}</div>
                )}
                {extractedData.size && (
                  <div><span className="font-medium">Size:</span> {extractedData.size}</div>
                )}
              </div>
            </div>
          )}

          {aiListingExtraction?.enrichment && !isProcessing && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-blue-900 mb-1">
                    Vehicle profile enriched by AI
                  </p>
                  <p className="text-xs text-blue-800">
                    Source: {aiListingExtraction.enrichment.source || 'unknown'}
                    {typeof aiListingExtraction.enrichment.confidence === 'number'
                      ? ` · Confidence: ${aiListingExtraction.enrichment.confidence}%`
                      : ''}
                  </p>
                </div>
              </div>

              {aiListingExtraction.enrichment.profile?.variant && (
                <p className="text-sm text-blue-900">
                  <span className="font-medium">Identified variant:</span>{' '}
                  {aiListingExtraction.enrichment.profile.variant}
                  {aiListingExtraction.enrichment.profile.generation
                    ? ` (${aiListingExtraction.enrichment.profile.generation})`
                    : ''}
                </p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                {(aiListingExtraction.enrichment.transcription_fields || []).length > 0 && (
                  <div className="bg-white rounded-md border border-green-200 p-2">
                    <p className="font-semibold text-green-800 mb-1">From transcription</p>
                    <p className="text-green-900">
                      {aiListingExtraction.enrichment.transcription_fields.join(', ')}
                    </p>
                  </div>
                )}
                {(aiListingExtraction.enrichment.enriched_fields || []).length > 0 && (
                  <div className="bg-white rounded-md border border-blue-200 p-2">
                    <p className="font-semibold text-blue-800 mb-1">AI enriched</p>
                    <p className="text-blue-900">
                      {aiListingExtraction.enrichment.enriched_fields.join(', ')}
                    </p>
                  </div>
                )}
                {(aiListingExtraction.enrichment.not_found_fields || []).length > 0 && (
                  <div className="bg-white rounded-md border border-gray-200 p-2">
                    <p className="font-semibold text-gray-700 mb-1">Not found</p>
                    <p className="text-gray-600">
                      {aiListingExtraction.enrichment.not_found_fields.slice(0, 12).join(', ')}
                      {aiListingExtraction.enrichment.not_found_fields.length > 12 ? '…' : ''}
                    </p>
                  </div>
                )}
              </div>

              {Array.isArray(aiListingExtraction.enrichment.profile?.features) &&
                aiListingExtraction.enrichment.profile.features.length > 0 && (
                  <div className="text-xs text-blue-900">
                    <span className="font-semibold">Detected features:</span>{' '}
                    {aiListingExtraction.enrichment.profile.features.join(', ')}
                  </div>
                )}

              {aiListingExtraction.enrichment.vehicleSpecifications && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-blue-900">
                  {aiListingExtraction.enrichment.vehicleSpecifications.engineCapacity && (
                    <div><span className="font-medium">Engine:</span> {aiListingExtraction.enrichment.vehicleSpecifications.engineCapacity}</div>
                  )}
                  {aiListingExtraction.enrichment.vehicleSpecifications.fuelType && (
                    <div><span className="font-medium">Fuel:</span> {aiListingExtraction.enrichment.vehicleSpecifications.fuelType}</div>
                  )}
                  {aiListingExtraction.enrichment.vehicleSpecifications.transmission && (
                    <div><span className="font-medium">Transmission:</span> {aiListingExtraction.enrichment.vehicleSpecifications.transmission}</div>
                  )}
                  {aiListingExtraction.enrichment.vehicleSpecifications.driveType && (
                    <div><span className="font-medium">Drive:</span> {aiListingExtraction.enrichment.vehicleSpecifications.driveType}</div>
                  )}
                  {aiListingExtraction.enrichment.vehicleSpecifications.horsepower && (
                    <div><span className="font-medium">Power:</span> {aiListingExtraction.enrichment.vehicleSpecifications.horsepower}</div>
                  )}
                  {aiListingExtraction.enrichment.vehicleSpecifications.seatingCapacity && (
                    <div><span className="font-medium">Seats:</span> {aiListingExtraction.enrichment.vehicleSpecifications.seatingCapacity}</div>
                  )}
                </div>
              )}
            </div>
          )}

          {(aiListingMissingFields || []).filter((fieldKey) =>
            ['brand', 'condition', 'price', 'currency', 'location_city'].includes(fieldKey)
          ).length > 0 && !isProcessing && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="text-sm font-semibold text-yellow-900 mb-1">
                    AI needs a few details to complete your car listing
                  </p>
                  <p className="text-xs text-yellow-800">
                    Fill the missing fields below. Low-confidence values are highlighted so you can confirm.
                  </p>
                </div>
              </div>

              {(() => {
                const REQUIRED_FIELDS = [
                  // Only show fields that are actually required by the existing UI steps.
                  // This keeps AI auto-fill "hands-off" for car posting.
                  'brand', // maps to `make`/`brand`
                  'condition',
                  'price',
                  'currency',
                  'location_city', // maps to `city`
                ]
                const missing = new Set(aiListingMissingFields || [])
                const low = REQUIRED_FIELDS.filter((k) => {
                  if (missing.has(k)) return false
                  const c = aiListingConfidence?.[k]
                  return typeof c === 'number' && c < 0.7
                })
                if (!low.length) return null
                return (
                  <div className="bg-yellow-100 border border-yellow-200 rounded-lg p-3 mb-4">
                    <p className="text-sm font-medium text-yellow-900 mb-1">AI low-confidence fields (please review):</p>
                    <div className="text-xs text-yellow-800">
                      {low.map((k) => `${k} (${Math.round((aiListingConfidence?.[k] || 0) * 100)}%)`).join(', ')}
                    </div>
                  </div>
                )
              })()}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {aiListingMissingFields
                  .filter((fieldKey) =>
                    [
                      'brand',
                      'condition',
                      'price',
                      'currency',
                      'location_city',
                    ].includes(fieldKey)
                  )
                  .map((fieldKey) => {
                  const conf = aiListingConfidence?.[fieldKey]
                  const isLow = typeof conf === 'number' && conf < 0.7
                  const ringClass = isLow ? 'ring-2 ring-yellow-400' : ''

                  switch (fieldKey) {
                    case 'brand':
                      return (
                        <div key={fieldKey}>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Brand {isLow ? <span className="text-yellow-700 text-xs ml-2">(low confidence)</span> : null}
                          </label>
                          <input
                            type="text"
                            {...register('brand')}
                            className={`input-field ${ringClass}`}
                            placeholder="e.g., Toyota"
                          />
                        </div>
                      )
                    case 'model':
                      return (
                        <div key={fieldKey}>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Model {isLow ? <span className="text-yellow-700 text-xs ml-2">(low confidence)</span> : null}
                          </label>
                          <input
                            type="text"
                            {...register('model')}
                            className={`input-field ${ringClass}`}
                            placeholder="e.g., Corolla"
                          />
                        </div>
                      )
                    case 'year':
                      return (
                        <div key={fieldKey}>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Year {isLow ? <span className="text-yellow-700 text-xs ml-2">(low confidence)</span> : null}
                          </label>
                          <input
                            type="number"
                            {...register('year')}
                            className={`input-field ${ringClass}`}
                            placeholder="e.g., 2020"
                            min={1900}
                            max={new Date().getFullYear() + 1}
                          />
                        </div>
                      )
                    case 'price':
                      return (
                        <div key={fieldKey}>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Price {isLow ? <span className="text-yellow-700 text-xs ml-2">(low confidence)</span> : null}
                          </label>
                          <input
                            type="number"
                            {...register('price')}
                            className={`input-field ${ringClass}`}
                            placeholder="e.g., 25000"
                            min={0}
                            step={0.01}
                          />
                        </div>
                      )
                    case 'currency':
                      return (
                        <div key={fieldKey}>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Currency {isLow ? <span className="text-yellow-700 text-xs ml-2">(low confidence)</span> : null}
                          </label>
                          <select
                            {...register('currency')}
                            className={`input-field ${ringClass}`}
                            defaultValue={watch('currency') || MARKETPLACE_CURRENCY}
                          >
                            <option value={MARKETPLACE_CURRENCY}>{MARKETPLACE_CURRENCY}</option>
                          </select>
                        </div>
                      )
                    case 'location_city':
                      return (
                        <div key={fieldKey}>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            City {isLow ? <span className="text-yellow-700 text-xs ml-2">(low confidence)</span> : null}
                          </label>
                          <input
                            type="text"
                            {...register('city')}
                            className={`input-field ${ringClass}`}
                            placeholder="e.g., Dubai"
                          />
                        </div>
                      )
                    case 'mileage_km':
                      return (
                        <div key={fieldKey}>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Mileage (km) {isLow ? <span className="text-yellow-700 text-xs ml-2">(low confidence)</span> : null}
                          </label>
                          <input
                            type="number"
                            {...register('mileage')}
                            className={`input-field ${ringClass}`}
                            placeholder="e.g., 50000"
                            min={0}
                          />
                        </div>
                      )
                    case 'engine_cc':
                      return (
                        <div key={fieldKey}>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Engine (cc) {isLow ? <span className="text-yellow-700 text-xs ml-2">(low confidence)</span> : null}
                          </label>
                          <input
                            type="number"
                            value={aiListingUserOverrides?.engine_cc ?? ''}
                            onChange={(e) => {
                              const n = e.target.value === '' ? null : Number(e.target.value)
                              setAiListingUserOverrides((prev) => ({ ...prev, engine_cc: n }))
                              if (n !== null && Number.isFinite(n) && !Number.isNaN(n)) {
                                setValue('engineSize', `${n}cc`, { shouldDirty: true, shouldTouch: true })
                              }
                            }}
                            className={`input-field ${ringClass}`}
                            placeholder="e.g., 2000"
                            min={1}
                          />
                        </div>
                      )
                    case 'horsepower':
                      return (
                        <div key={fieldKey}>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Horsepower {isLow ? <span className="text-yellow-700 text-xs ml-2">(low confidence)</span> : null}
                          </label>
                          <input
                            type="number"
                            value={aiListingUserOverrides?.horsepower ?? ''}
                            onChange={(e) => {
                              const n = e.target.value === '' ? null : Number(e.target.value)
                              setAiListingUserOverrides((prev) => ({ ...prev, horsepower: n }))
                            }}
                            className={`input-field ${ringClass}`}
                            placeholder="e.g., 150"
                            min={1}
                          />
                        </div>
                      )
                    case 'transmission':
                      return (
                        <div key={fieldKey}>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Transmission {isLow ? <span className="text-yellow-700 text-xs ml-2">(low confidence)</span> : null}
                          </label>
                          <select
                            {...register('transmission')}
                            className={`input-field ${ringClass}`}
                            defaultValue={watch('transmission') || ''}
                          >
                            <option value="">Select transmission</option>
                            {['Manual', 'Automatic', 'CVT', 'Semi-Automatic'].map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </div>
                      )
                    case 'fuel_type':
                      return (
                        <div key={fieldKey}>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Fuel Type {isLow ? <span className="text-yellow-700 text-xs ml-2">(low confidence)</span> : null}
                          </label>
                          <select
                            {...register('fuelType')}
                            className={`input-field ${ringClass}`}
                            defaultValue={watch('fuelType') || ''}
                          >
                            <option value="">Select fuel type</option>
                            {['Petrol', 'Diesel', 'Hybrid', 'Electric', 'CNG', 'LPG', 'Other'].map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </div>
                      )
                    case 'body_type':
                      return (
                        <div key={fieldKey}>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Body Type {isLow ? <span className="text-yellow-700 text-xs ml-2">(low confidence)</span> : null}
                          </label>
                          <select
                            {...register('bodyType')}
                            className={`input-field ${ringClass}`}
                            defaultValue={watch('bodyType') || ''}
                          >
                            <option value="">Select body type</option>
                            {['Sedan', 'SUV', 'Hatchback', 'Coupe', 'Convertible', 'Wagon', 'Pickup'].map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </div>
                      )
                    case 'condition':
                      return (
                        <div key={fieldKey}>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Condition {isLow ? <span className="text-yellow-700 text-xs ml-2">(low confidence)</span> : null}
                          </label>
                          <select
                            {...register('condition')}
                            className={`input-field ${ringClass}`}
                            defaultValue={watch('condition') || ''}
                          >
                            <option value="">Select condition</option>
                            {CONDITION_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </div>
                      )
                    case 'accident_free':
                      return (
                        <div key={fieldKey}>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Accident Free {isLow ? <span className="text-yellow-700 text-xs ml-2">(low confidence)</span> : null}
                          </label>
                          <select
                            value={
                              aiListingUserOverrides?.accident_free === null ||
                              aiListingUserOverrides?.accident_free === undefined
                                ? ''
                                : aiListingUserOverrides.accident_free
                                ? 'yes'
                                : 'no'
                            }
                            onChange={(e) => {
                              const v = e.target.value
                              if (v === 'yes') setAiListingUserOverrides((prev) => ({ ...prev, accident_free: true }))
                              else if (v === 'no') setAiListingUserOverrides((prev) => ({ ...prev, accident_free: false }))
                              else setAiListingUserOverrides((prev) => ({ ...prev, accident_free: null }))
                            }}
                            className={`input-field ${ringClass}`}
                          >
                            <option value="">Select</option>
                            <option value="yes">Yes (no accidents)</option>
                            <option value="no">No (has accident history)</option>
                          </select>
                        </div>
                      )
                    default:
                      return null
                  }
                })}
              </div>
            </div>
          )}

          {/* Image Upload Section */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-medium text-blue-900">
                  📷 Upload Images
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  Upload additional images of your product (at least 1 image required)
                </p>
              </div>
            </div>

            <div className="mt-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {imageFiles.filter(file => !file.isScreenshot).map((file, index) => {
                  // Find the actual index in imageFiles array
                  const actualIndex = imageFiles.findIndex(f => f === file)
                  return (
                    <div key={actualIndex} className="relative aspect-square">
                      <ImagePreviewImg
                        file={file}
                        alt={`Preview ${actualIndex + 1}`}
                        className="w-full h-full object-cover rounded-lg"
                      />
                <button
                  type="button"
                        onClick={() => removeImage(actualIndex)}
                  className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
                >
                  <X className="h-3 w-3" />
                </button>
                      {file?.isExisting && (
                        <span className="absolute bottom-1 left-1 bg-blue-500 text-white text-xs px-2 py-1 rounded">
                          Existing
                        </span>
                      )}
              </div>
                  )
                })}
                {imageFiles.filter(file => !file.isScreenshot).length < 20 && (
                  <label className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary-500">
                    <Upload className="h-8 w-8 text-gray-400 mb-2" />
                    <span className="text-xs text-gray-500">Add Photo</span>
                <input
                  type="file"
                  className="hidden"
                      accept="image/jpeg,image/png,image/jpg"
                  multiple
                  onChange={handleImageUpload}
                />
              </label>
            )}
              </div>
              <p className="text-xs text-blue-800 mt-2">
                {imageFiles.filter(file => !file.isScreenshot).length} / 20 images uploaded
              </p>
          </div>
        </div>
          </div>
        </details>
      )}

      <div className="post-ad-fixed-footer">
        <div className="mx-auto w-full max-w-[640px] px-4 pt-4 sm:px-6 sm:pt-5">
          <div className="mb-3 flex gap-1 sm:mb-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-[3px] flex-1 rounded-full"
                style={{ backgroundColor: i === 0 ? POST_AD_NAVY : '#e5e7eb' }}
              />
            ))}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-600">1 of 4</p>
            <button
              type="button"
              onClick={handleContinue}
              disabled={isProcessing}
              className="inline-flex w-full items-center justify-center gap-1 rounded-xl px-8 py-3.5 text-[15px] font-semibold text-white transition disabled:opacity-50 sm:w-auto sm:px-10"
              style={{ backgroundColor: POST_AD_BLUE }}
              onMouseEnter={(e) => {
                if (!isProcessing) e.currentTarget.style.backgroundColor = '#1d4ed8'
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
    </div>
  )
}

// Step 4: Title & Photos Review — shown right after AI video transcription finishes.
// Sub-view of Step4TitlePhotosReview: scrub the video to a moment and crop that frame in,
// replacing whichever photo tile's pencil icon was clicked.
const CROP_THUMBNAIL_COUNT = 10

function PhotoCropFromVideo({ videoFile, onBack, onCrop }) {
  const videoRef = useRef(null)
  const thumbVideoRef = useRef(null)
  const videoSrc = useVideoPreviewSrc(videoFile)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isCropping, setIsCropping] = useState(false)
  const [thumbnails, setThumbnails] = useState([])
  const [thumbsLoading, setThumbsLoading] = useState(false)

  // Generate a filmstrip of evenly-spaced frames client-side (canvas capture from a
  // hidden video element) so the user can tap a frame instead of dragging a bare slider.
  // Falls back to the plain slider below if the canvas capture is blocked (tainted
  // canvas on a cross-origin video source).
  useEffect(() => {
    if (!duration || !videoSrc) return
    let cancelled = false

    const generateThumbnails = async () => {
      const video = thumbVideoRef.current
      if (!video) return
      setThumbsLoading(true)
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const results = []

      for (let i = 0; i < CROP_THUMBNAIL_COUNT; i++) {
        if (cancelled) return
        const time = (duration * i) / (CROP_THUMBNAIL_COUNT - 1)
        try {
          // eslint-disable-next-line no-await-in-loop
          await new Promise((resolve, reject) => {
            const onSeeked = () => {
              video.removeEventListener('seeked', onSeeked)
              try {
                canvas.width = video.videoWidth || 160
                canvas.height = video.videoHeight || 90
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
                results.push({ time, dataUrl: canvas.toDataURL('image/jpeg', 0.6) })
                resolve()
              } catch (err) {
                reject(err)
              }
            }
            video.addEventListener('seeked', onSeeked)
            video.currentTime = time
          })
        } catch {
          break
        }
      }

      if (!cancelled) {
        setThumbnails(results)
        setThumbsLoading(false)
      }
    }

    generateThumbnails()
    return () => {
      cancelled = true
    }
  }, [duration, videoSrc])

  const seekTo = (time) => {
    setCurrentTime(time)
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.currentTime = time
    }
  }

  const handleSeek = (e) => {
    seekTo(Number(e.target.value))
  }

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) video.play()
    else video.pause()
  }

  const activeThumbIndex = thumbnails.length
    ? thumbnails.reduce(
        (closest, thumb, i) =>
          Math.abs(thumb.time - currentTime) < Math.abs(thumbnails[closest].time - currentTime) ? i : closest,
        0,
      )
    : -1

  const handleCropThis = async () => {
    setIsCropping(true)
    try {
      toast.loading('Capturing frame...', { id: 'crop-frame' })
      const res = await videoService.captureScreenshot(videoFile, currentTime)
      const { screenshot } = res.data
      const BASE_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:8029'
      const screenshotUrl = screenshot.url.startsWith('http') ? screenshot.url : `${BASE_URL}${screenshot.url}`
      onCrop({
        url: screenshotUrl,
        name: `screenshot-${Math.floor(screenshot.timestamp)}s.jpg`,
        isScreenshot: true,
        originalUrl: screenshot.url,
        timestamp: screenshot.timestamp,
      })
      toast.success('Photo updated!', { id: 'crop-frame' })
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to capture frame', { id: 'crop-frame' })
    } finally {
      setIsCropping(false)
    }
  }

  return (
    <div className="post-ad-step-shell-narrow pb-32 sm:pb-36">
      <div className="text-center mb-5 sm:mb-6 w-full">
        <h2 className="post-ad-step-heading">Crop photo from video</h2>
        <p className="post-ad-step-subheading">Move the slider to generate image</p>
      </div>

      <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-black">
        <video
          ref={videoRef}
          src={videoSrc}
          className="w-full h-full object-cover"
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          playsInline
        />
        <button
          type="button"
          onClick={togglePlay}
          disabled={!duration}
          className="absolute inset-0 flex items-center justify-center"
          aria-label={isPlaying ? 'Pause video' : 'Play video'}
        >
          {!isPlaying && (
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/50 text-white">
              <Play className="h-6 w-6 translate-x-0.5" fill="currentColor" />
            </span>
          )}
        </button>
      </div>

      {/* Hidden video used only to extract frame thumbnails for the filmstrip below. */}
      <video ref={thumbVideoRef} src={videoSrc} className="hidden" playsInline muted />

      {thumbnails.length > 0 ? (
        <>
          <div className="w-full mt-4 flex gap-1 overflow-x-auto pb-1">
            {thumbnails.map((thumb, i) => (
              <button
                key={thumb.time}
                type="button"
                onClick={() => seekTo(thumb.time)}
                className={`relative shrink-0 h-16 w-16 sm:h-20 sm:w-20 overflow-hidden rounded-lg border-2 transition-colors ${
                  i === activeThumbIndex ? 'border-blue-600' : 'border-transparent'
                }`}
              >
                <img src={thumb.dataUrl} alt="" className="w-full h-full object-cover" />
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/90 shadow">
                    <Pause className="h-3.5 w-3.5 text-gray-800" fill="currentColor" />
                  </span>
                </span>
              </button>
            ))}
          </div>

          <div className="w-full mt-2 flex items-center justify-center gap-1">
            {thumbnails.map((thumb, i) => {
              const distance = Math.abs(i - activeThumbIndex)
              const opacity = i === activeThumbIndex ? 1 : Math.max(0.25, 1 - distance * 0.3)
              const scale = i === activeThumbIndex ? 1 : Math.max(0.85, 1 - distance * 0.05)
              return (
                <button
                  key={`preview-${thumb.time}`}
                  type="button"
                  onClick={() => seekTo(thumb.time)}
                  style={{ opacity, transform: `scale(${scale})` }}
                  className="h-10 w-10 shrink-0 overflow-hidden rounded-md transition-all sm:h-12 sm:w-12"
                >
                  <img src={thumb.dataUrl} alt="" className="w-full h-full object-cover" />
                </button>
              )
            })}
          </div>
        </>
      ) : thumbsLoading ? (
        <div className="w-full mt-4 flex gap-1 overflow-x-auto pb-1">
          {Array.from({ length: CROP_THUMBNAIL_COUNT }).map((_, i) => (
            <div key={i} className="h-16 w-16 shrink-0 animate-pulse rounded-lg bg-gray-200 sm:h-20 sm:w-20" />
          ))}
        </div>
      ) : (
        <div className="w-full mt-4">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            disabled={!duration}
            className="w-full accent-blue-600"
          />
        </div>
      )}

      <div className="w-full flex gap-3 mt-6">
        <button type="button" onClick={onBack} className="btn-secondary flex-1">
          Back
        </button>
        <button
          type="button"
          onClick={handleCropThis}
          disabled={isCropping || !duration}
          className="flex-1 rounded-xl px-8 py-3.5 text-[15px] font-semibold text-white transition disabled:opacity-50"
          style={{ backgroundColor: POST_AD_BLUE }}
        >
          {isCropping ? 'Cropping...' : 'Crop this'}
        </button>
      </div>
    </div>
  )
}

function Step4TitlePhotosReview({ register, errors, imageFiles, setImageFiles, videoFile, breadcrumbItems = [], onBack, onNext }) {
  const [isAutoCapturing, setIsAutoCapturing] = useState(false)
  const [editingIndex, setEditingIndex] = useState(null)

  const handleAddPhotos = (e) => {
    const files = Array.from(e.target.files)
    const newImageFiles = files.filter((file) => {
      if (!file.type.startsWith('image/')) return false
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 10MB limit`)
        return false
      }
      return true
    })
    setImageFiles((prev) => [...prev, ...newImageFiles])
  }

  const handleScreenGrab = async () => {
    if (!videoFile) {
      toast.error('Video not loaded')
      return
    }
    setIsAutoCapturing(true)
    try {
      toast.loading('Capturing screenshots from your video...', { id: 'auto-screenshot' })
      const res = await videoService.autoCaptureScreenshots(videoFile)
      const captured = Array.isArray(res.data?.screenshots) ? res.data.screenshots : []
      if (!captured.length) {
        toast.error('No screenshots could be captured from this video.', { id: 'auto-screenshot' })
        return
      }
      const newImages = captured.map((shot) => ({
        url: shot.url,
        name: `screenshot-${Math.floor(shot.timestamp || 0)}s.jpg`,
        isScreenshot: true,
        originalUrl: shot.url,
        timestamp: shot.timestamp,
      }))
      setImageFiles((prev) => [...prev, ...newImages])
      toast.success(`Captured ${captured.length} screenshot${captured.length > 1 ? 's' : ''}!`, { id: 'auto-screenshot' })
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to capture screenshots', { id: 'auto-screenshot' })
    } finally {
      setIsAutoCapturing(false)
    }
  }

  const removeImage = (index) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index))
  }

  if (editingIndex !== null) {
    return (
      <PhotoCropFromVideo
        videoFile={videoFile}
        onBack={() => setEditingIndex(null)}
        onCrop={(newImage) => {
          setImageFiles((prev) => prev.map((f, i) => (i === editingIndex ? newImage : f)))
          setEditingIndex(null)
        }}
      />
    )
  }

  return (
    <div className="post-ad-step-shell-narrow pb-32 sm:pb-36">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="self-start mb-6 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-800"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
      )}

      <div className="text-center mb-5 sm:mb-6 w-full">
        <h2 className="post-ad-step-heading">Your Ad Is Coming Together! Here&apos;s Your Title &amp; Photos</h2>
        <p className="post-ad-step-subheading">
          Your ad title and photos are ready. You can edit them anytime before publishing.
        </p>
      </div>

      <PostAdListingBreadcrumb items={[...breadcrumbItems, 'upload video']} />

      <div className="space-y-5 sm:space-y-6 w-full">
        <div>
          <label className="block text-sm font-medium text-gray-800 mb-2">
            Title<span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            {...register('title', {
              required: 'Title is required',
              minLength: { value: 10, message: 'Title must be at least 10 characters' },
            })}
            className={POST_AD_INPUT}
            placeholder="Enter product title"
          />
          {errors?.title && <p className="mt-1.5 text-sm text-red-600">{errors.title.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-800 mb-2">
            Description<span className="text-red-500">*</span>
          </label>
          <textarea
            {...register('description', {
              required: 'Description is required',
              minLength: { value: 30, message: 'Description must be at least 30 characters' },
              maxLength: { value: 2500, message: 'Description must not exceed 2500 characters' },
            })}
            rows={6}
            className={`${POST_AD_INPUT} resize-none min-h-[150px]`}
            placeholder="Enter product description"
          />
          {errors?.description && (
            <p className="mt-1.5 text-sm text-red-600">{errors.description.message}</p>
          )}
        </div>

        <div>
          <p className="text-sm font-medium text-gray-800 mb-2">Photos (Max 10 images)</p>
          <div className="space-y-1">
            {(() => {
              const rows = []
              let i = 0
              let isFullWidthRow = true
              while (i < imageFiles.length) {
                const rowSize = isFullWidthRow ? 1 : 2
                rows.push(
                  imageFiles.slice(i, i + rowSize).map((file, offset) => ({ file, index: i + offset })),
                )
                i += rowSize
                isFullWidthRow = !isFullWidthRow
              }
              return rows
            })().map((row, rowIndex) => (
              <div key={rowIndex} className={row.length === 2 ? 'grid grid-cols-2 gap-1' : ''}>
                {row.map(({ file, index }) => (
                  <div key={index} className="relative h-64 sm:h-72">
                    <ImagePreviewImg
                      file={file}
                      alt={`Photo ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!videoFile) {
                          toast.error('No video available to crop from')
                          return
                        }
                        setEditingIndex(index)
                      }}
                      className="absolute top-2 right-11 bg-gray-900/70 text-white p-1.5 rounded-full hover:bg-gray-900"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-2 right-2 bg-gray-900/70 text-white p-1.5 rounded-full hover:bg-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={handleScreenGrab}
              disabled={isAutoCapturing || !videoFile}
              className="btn-secondary flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isAutoCapturing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Capturing...
                </>
              ) : (
                <>
                  <Camera className="h-4 w-4" />
                  Screen Grab
                </>
              )}
            </button>
            <label className="btn-secondary flex-1 flex items-center justify-center gap-2 cursor-pointer">
              <Upload className="h-4 w-4" />
              Add Photos
              <input
                type="file"
                className="hidden"
                accept="image/jpeg,image/png,image/jpg"
                multiple
                onChange={handleAddPhotos}
              />
            </label>
          </div>
        </div>
      </div>

      <div className="post-ad-fixed-footer">
        <div className="mx-auto w-full max-w-[640px] px-4 pt-4 sm:px-6 sm:pt-5">
          <div className="mb-3 flex gap-1 sm:mb-4">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="h-[3px] flex-1 rounded-full"
                style={{ backgroundColor: i === 0 ? POST_AD_NAVY : '#e5e7eb' }}
              />
            ))}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-600">1 of 2</p>
            <button
              type="button"
              onClick={onNext}
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
    </div>
  )
}

// Step 5: Basic Details (renamed from Step4)
function Step4BasicDetails({
  register,
  watch,
  setValue,
  getValues,
  control,
  errors,
  categories,
  selectedCategory,
  subcategories,
  breadcrumbItems = [],
  onBack,
  onNext,
  initialDynamicFormValues,
}) {
  const selectedCategoryObj = categories.find(cat => cat._id === selectedCategory)
  const selectedSubcategory = subcategories.find(sub => sub._id === watch('subcategory'))
  
  const categoryName = selectedCategoryObj?.name || ''
  const subcategoryName = selectedSubcategory?.name || ''
  const isVehicle = /vehicles?|motors?|cars?|auto/i.test(categoryName || '')
  const isBicycle = isVehicle && isVehicleSubcategoryBicycle(subcategoryName)

  const categoryFilters = watch('__categoryFilters') || []

  // When user reaches Step 4 after AI video processing, re-apply brand + filter prefills.
  useEffect(() => {
    if (!categoryFilters.length || !getValues) return
    const aiPayload = getValues('__aiListingExtraction')
    const extracted = getValues('__extractedData')
    if (!aiPayload && !extracted) return

    syncBrandChoiceFromMake({
      getValues,
      setValue,
      categoryName,
      subcategoryName,
    })

    if (aiPayload) {
      applyAiVehicleFormPrefill({
        setValue,
        getValues,
        mappingResult: aiPayload,
        context: {
          categoryName,
          subcategoryName,
          isVehicle,
        },
      })

      if (aiPayload.filter_selections && typeof aiPayload.filter_selections === 'object') {
        const sanitizedAiFilters = omitAdsPostedFromSelections(aiPayload.filter_selections, categoryFilters)
        Object.entries(sanitizedAiFilters).forEach(([key, value]) => {
          if (key.startsWith('filter_') && value) {
            setValue(key, mergeFilterValues(getValues(key), value), {
              shouldDirty: true,
              shouldTouch: true,
              shouldValidate: true,
            })
          }
        })
      }
    }

    applyTranscriptFilterSelections({
      filters: categoryFilters,
      getValues,
      setValue,
      extractedData: extracted,
      aiExtraction: aiPayload,
      force: false,
    })
  }, [
    categoryFilters,
    categoryName,
    subcategoryName,
    isVehicle,
    getValues,
    setValue,
    watch('__aiListingExtraction'),
    watch('__extractedData'),
  ])

  // When Vehicle subcategory switches to Bicycles, clear transmission/fuelType (aligned with vehicle filters)
  useEffect(() => {
    if (isVehicle && isBicycle) {
      setValue('transmission', '')
      setValue('fuelType', '')
    }
  }, [isVehicle, isBicycle, setValue])

  return (
    <div className="post-ad-step-shell-wide pb-32 sm:pb-36">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="self-start mb-6 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-800"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
      )}

      <div className="text-center mb-5 sm:mb-6 w-full">
        <h2 className="post-ad-step-heading">Use plenty of photos, add useful details, and set the right price.</h2>
        <p className="post-ad-step-subheading">Select the area that suits your ad best.</p>
      </div>

      <PostAdListingBreadcrumb items={[...breadcrumbItems, 'upload video', 'Basic Details', 'Additional Details']} />

      {!categoryName && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 w-full">
          <p className="text-sm text-yellow-800">
            ⚠️ Please select a category first to see relevant fields.
          </p>
        </div>
      )}

      {/* Admin-configured dynamic fields (FormField collection), scoped to the selected category.
          Use the deepest category the user picked in Step 2 (child category, then subcategory,
          then root) as the base categoryId. */}
      <DynamicCategoryFormSection
        categoryId={watch('childCategory') || watch('subcategory') || selectedCategory}
        onAdvancePastForm={onNext}
        setValue={setValue}
        watch={watch}
        initialValues={initialDynamicFormValues}
      />
    </div>
  )
}

// Step 6: Review & Confirm
function ReviewSectionCard({ title, onEdit, editing, children }) {
  return (
    <div className="w-full bg-white rounded-xl border border-gray-200 p-5 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <button type="button" onClick={onEdit} className="text-sm font-medium hover:underline" style={{ color: POST_AD_BLUE }}>
          {editing ? 'Done' : 'Edit'}
        </button>
      </div>
      {children}
    </div>
  )
}

function Step10Review({
  formData,
  imageFiles,
  videoFile,
  categories,
  selectedCategory,
  subcategories,
  categoryPathNames,
  register,
  errors,
  setValue,
  watch,
  isSubmitting,
  isEditMode,
  onBack,
}) {
  const dispatch = useDispatch()
  const allDynamicFields = useSelector(selectDynamicFormAllFields)
  const dynamicValues = useSelector(selectDynamicFormValues)
  const computedOptionsMap = useSelector((state) => state.dynamicForm.computedOptions)

  const overviewFields = allDynamicFields.filter((f) => getFieldKind(f.fieldType) !== FIELD_KIND.CHECKBOX)
  const featureFields = allDynamicFields.filter((f) => getFieldKind(f.fieldType) === FIELD_KIND.CHECKBOX)

  const setDynamicField = (field, next) => {
    dispatch(setDynamicFieldValue({ fieldName: field.fieldName, value: next }))
  }

  const [editingOverview, setEditingOverview] = useState(false)
  const [editingDescription, setEditingDescription] = useState(false)
  const [editingFeatures, setEditingFeatures] = useState(false)
  const [editingLocation, setEditingLocation] = useState(false)
  const [expandedFeatureGroup, setExpandedFeatureGroup] = useState(null)
  const [descriptionExpanded, setDescriptionExpanded] = useState(false)
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [requestPreview, setRequestPreview] = useState(null)

  const totalImages = imageFiles.length
  const activeImage = imageFiles[Math.min(activeImageIndex, Math.max(totalImages - 1, 0))]

  const locationSummary =
    watch('locationAddress') || [formData.area, formData.city, formData.country].filter(Boolean).join(', ')

  /**
   * Builds the same [key, value] `_parts` shape as the real POST /api/products request
   * for on-screen display — shown alongside the actual submission (triggered separately
   * by this button's type="submit"), not instead of it.
   */
  const buildRequestPreview = () => {
    const BASE_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:8029'
    const token = localStorage.getItem('token') || ''
    const redactedToken = token ? `${token.slice(0, 6)}...${token.slice(-6)}` : ''

    const VIDEO_EXT_TYPES = {
      mp4: 'video/mp4',
      mov: 'video/quicktime',
      avi: 'video/x-msvideo',
      mkv: 'video/x-matroska',
      webm: 'video/webm',
    }
    const guessTypeFromName = (name, fallback) => {
      const ext = String(name || '').split('.').pop()?.toLowerCase()
      return (ext && VIDEO_EXT_TYPES[ext]) || fallback
    }

    const toFileDescriptor = (file, fallbackName, fallbackType) => {
      if (!file) return null
      if (typeof file === 'object' && typeof file.url === 'string') {
        const name = file.name || fallbackName
        return { uri: file.url, name, type: file.type || guessTypeFromName(name, fallbackType) }
      }
      if (file instanceof File || file instanceof Blob) {
        const name = file.name || fallbackName
        return {
          uri: URL.createObjectURL(file),
          name,
          type: file.type || guessTypeFromName(name, fallbackType),
        }
      }
      return null
    }

    // [key, value] tuples — matches the exact _parts shape shown in the mobile app's
    // own [HTTP:REQUEST] debug log (React Native's internal FormData representation).
    // Display-only: the real API submission is unaffected by this format.
    const parts = []

    const pushPart = (key, value) => {
      if (!hasFormPayloadValue(value)) return
      parts.push([key, value])
    }

    const video = toFileDescriptor(videoFile, 'video.mp4', 'video/mp4')
    if (video) parts.push(['video', video])

    imageFiles.forEach((file, i) => {
      const image = toFileDescriptor(file, `photo_${i}.jpg`, 'image/jpeg')
      if (image) parts.push(['images', image])
    })

    pushPart('title', formData.title)
    pushPart('description', formData.description)
    pushPart('price', formData.price)
    pushPart('currency', formData.currency || MARKETPLACE_CURRENCY)
    pushPart('category', selectedCategory)
    pushPart('subcategory', formData.subcategory)
    pushPart('location', locationSummary)
    pushPart('country', formData.country)
    pushPart('city', formData.city)
    pushPart('area', formData.area)
    pushPart('brand', formData.brand)
    pushPart('contactName', formData.contactName)
    pushPart('contactPhone', formData.contactPhone)
    pushPart(
      'condition',
      Array.isArray(formData.condition) ? formData.condition[0] : formData.condition
    )
    pushPart('priceType', formData.priceType || 'Fixed')
    pushPart('adType', formData.adType || 'free')

    allDynamicFields.forEach((field) => {
      const raw = dynamicValues[field.fieldName]
      if (raw === undefined || raw === null || raw === '') return
      const value = Array.isArray(raw) ? raw.join(',') : String(raw)
      if (!value) return
      parts.push([field.fieldName, value])
    })

    return {
      url: `${BASE_URL}/api/products`,
      headers: {
        Accept: 'application/json, text/plain, */*',
        'Content-Type': 'multipart/form-data',
        ...(token ? { Authorization: `Bearer ${redactedToken}` } : {}),
      },
      data: { _parts: parts },
    }
  }

  const description = formData.description || ''
  const descriptionPreview =
    description.length > 180 && !descriptionExpanded ? `${description.slice(0, 180)}...` : description

  return (
    <div className="post-ad-step-shell-wide pb-32 sm:pb-36">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="self-start mb-6 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-800"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
      )}

      <div className="text-center mb-5 sm:mb-6 w-full">
        <h2 className="post-ad-step-heading">We are all set to go!</h2>
        <p className="post-ad-step-subheading">Review your all details and we will be live soon</p>
      </div>

      <PostAdListingBreadcrumb
        items={[...(categoryPathNames || []), 'upload video', 'Basic Details', 'Additional Details', 'Summary']}
      />

      <div className="relative w-full rounded-xl overflow-hidden bg-gray-100 mb-6">
        {activeImage ? (
          <ImagePreviewImg
            file={activeImage}
            alt="Listing photo"
            className="w-full h-[280px] sm:h-[420px] object-cover"
          />
        ) : (
          <div className="w-full h-[280px] sm:h-[420px] flex items-center justify-center text-gray-400">
            No photos
          </div>
        )}

        {totalImages > 1 && (
          <>
            <button
              type="button"
              onClick={() => setActiveImageIndex((i) => (i - 1 + totalImages) % totalImages)}
              className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 rounded-full p-2 shadow"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setActiveImageIndex((i) => (i + 1) % totalImages)}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/90 rounded-full p-2 shadow"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <span className="absolute top-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
              <ImageIcon className="h-3 w-3" /> {activeImageIndex + 1}/{totalImages}
            </span>
          </>
        )}

        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
          <span
            className="inline-flex items-center rounded-full px-3 py-1.5 text-sm font-semibold text-white"
            style={{ backgroundColor: POST_AD_BLUE }}
          >
            {formData.currency || MARKETPLACE_CURRENCY} {formData.price || '0'}
          </span>
          <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-medium text-amber-700">
            Draft
          </span>
        </div>
      </div>

      <div className="w-full mb-4">
        <h3 className="text-xl font-bold text-gray-900">{formData.title}</h3>
        <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-600">
          {formData.year && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-4 w-4" /> {formData.year}
            </span>
          )}
          {formData.mileage && (
            <span className="inline-flex items-center gap-1">
              <Gauge className="h-4 w-4" /> {formData.mileage} km
            </span>
          )}
          {categoryPathNames?.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <Globe className="h-4 w-4" /> {categoryPathNames[categoryPathNames.length - 1]}
            </span>
          )}
        </div>
      </div>

      <ReviewSectionCard title="Car Overview" editing={editingOverview} onEdit={() => setEditingOverview((v) => !v)}>
        {editingOverview ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5">
            {overviewFields.map((field) => (
              <div key={field.id || field.fieldName}>
                <FieldRenderer
                  field={field}
                  value={dynamicValues[field.fieldName]}
                  onChange={(next) => setDynamicField(field, next)}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
            {overviewFields.map((field) => {
              const display = resolveFieldDisplayValue(
                field,
                dynamicValues[field.fieldName],
                computedOptionsMap[field.fieldName],
              )
              if (!display || (Array.isArray(display) && !display.length)) return null
              return (
                <div key={field.id || field.fieldName}>
                  <p className="text-xs text-gray-500">{field.fieldTitle}</p>
                  <p className="text-sm font-medium text-gray-900">
                    {Array.isArray(display) ? display.join(', ') : display}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </ReviewSectionCard>

      <ReviewSectionCard
        title={formData.title || 'Description'}
        editing={editingDescription}
        onEdit={() => setEditingDescription((v) => !v)}
      >
        {editingDescription ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-2">Title</label>
              <input type="text" className={POST_AD_INPUT} {...register('title')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-2">Description</label>
              <textarea rows={5} className={`${POST_AD_INPUT} resize-none`} {...register('description')} />
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-700 whitespace-pre-line">{descriptionPreview}</p>
            {description.length > 180 && (
              <button
                type="button"
                onClick={() => setDescriptionExpanded((v) => !v)}
                className="mt-2 text-sm font-medium hover:underline"
                style={{ color: POST_AD_BLUE }}
              >
                {descriptionExpanded ? 'Show Less' : 'Read More'}
              </button>
            )}
          </div>
        )}
      </ReviewSectionCard>

      <ReviewSectionCard title="Features" editing={editingFeatures} onEdit={() => setEditingFeatures((v) => !v)}>
        {editingFeatures ? (
          <div className="space-y-5">
            {featureFields.map((field) => (
              <FieldRenderer
                key={field.id || field.fieldName}
                field={field}
                value={dynamicValues[field.fieldName]}
                onChange={(next) => setDynamicField(field, next)}
              />
            ))}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {featureFields.map((field) => {
              const selected = Array.isArray(dynamicValues[field.fieldName]) ? dynamicValues[field.fieldName] : []
              if (!selected.length) return null
              const isExpanded = expandedFeatureGroup === field.fieldName
              const labels = resolveFieldDisplayValue(field, selected, computedOptionsMap[field.fieldName])
              return (
                <div key={field.id || field.fieldName} className="py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">{field.fieldTitle}</span>
                    <button
                      type="button"
                      onClick={() => setExpandedFeatureGroup(isExpanded ? null : field.fieldName)}
                      className="flex items-center gap-2 text-sm font-medium text-gray-900"
                    >
                      {selected.length}
                      <Plus
                        className="h-4 w-4 transition-transform"
                        style={{ color: POST_AD_BLUE, transform: isExpanded ? 'rotate(45deg)' : 'none' }}
                      />
                    </button>
                  </div>
                  {isExpanded && <p className="mt-2 text-sm text-gray-600">{labels.join(', ')}</p>}
                </div>
              )
            })}
          </div>
        )}
      </ReviewSectionCard>

      <ReviewSectionCard title="Location" editing={editingLocation} onEdit={() => setEditingLocation((v) => !v)}>
        {editingLocation ? (
          <LocationMapPicker setValue={setValue} watch={watch} />
        ) : (
          <div>
            <p className="text-sm text-gray-600 mb-3">{locationSummary || 'No location set'}</p>
            <LocationMapPicker setValue={setValue} watch={watch} readOnly />
          </div>
        )}
      </ReviewSectionCard>

      {!videoFile && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-4 w-full">
          ⚠️ No video uploaded
        </div>
      )}
      {imageFiles.length === 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-4 w-full">
          ⚠️ No images uploaded
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 w-full">
        <div className="flex items-start gap-2">
          <input
            type="checkbox"
            id="acceptRules"
            {...register('acceptRules', { required: 'You must accept the posting rules' })}
            className="mt-1"
          />
          <label htmlFor="acceptRules" className="text-sm text-blue-900">
            I accept the posting rules and confirm that all information is accurate. I understand that wrong
            category, fake locations, stock images, or misleading information will result in rejection.
          </label>
        </div>
        {errors.acceptRules && <p className="mt-2 text-sm text-red-600">{errors.acceptRules.message}</p>}
      </div>

      {requestPreview && (
        <div className="w-full bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <h3 className="font-semibold text-gray-900 mb-3">Request Preview (posting this to the API)</h3>
          <pre className="text-xs text-gray-700 whitespace-pre-wrap break-words bg-gray-50 rounded-lg p-3 overflow-x-auto">
{`LOG  [HTTP:REQUEST] POST ${requestPreview.url}
headers=${JSON.stringify(requestPreview.headers, null, 2)}
params=undefined
data=${JSON.stringify(requestPreview.data, null, 2)}`}
          </pre>
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
              type="submit"
              disabled={isSubmitting || watch('acceptRules') !== true}
              onClick={(e) => {
                if (watch('acceptRules') !== true) {
                  e.preventDefault()
                  toast.error('Please accept the posting rules to continue')
                  return
                }
                setRequestPreview(buildRequestPreview())
              }}
              className="inline-flex w-full items-center justify-center gap-1 rounded-xl px-8 py-3.5 text-[15px] font-semibold text-white transition disabled:opacity-50 sm:w-auto sm:px-10"
              style={{ backgroundColor: POST_AD_BLUE }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#1d4ed8'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = POST_AD_BLUE
              }}
            >
              {isSubmitting ? (isEditMode ? 'Saving...' : 'Posting...') : isEditMode ? 'Save Changes' : 'Post Ad'}
              <span className="text-lg leading-none">&gt;</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Main Component
function PostAdPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const editProductId = searchParams.get('edit')
  const isEditMode = !!editProductId
  const [editProductPostedAt, setEditProductPostedAt] = useState(null)

  const { categories } = useSelector((state) => state.categories)
  const { loading } = useSelector((state) => state.products)
  const { user } = useSelector((state) => state.auth)
  // Admin-configured Car Overview/Features fields live in their own Redux slice
  // (dynamicForm), not react-hook-form — pulled in here so onSubmit can send them.
  const allDynamicFieldsForSubmit = useSelector(selectDynamicFormAllFields)
  const dynamicFormSubmitValues = useSelector(selectDynamicFormValues)
  
  const { register, handleSubmit, watch, setValue, getValues, trigger, control, reset, formState: { errors } } = useForm({
    mode: 'onChange', // Validate on change for better UX
    defaultValues: {
      currency: MARKETPLACE_CURRENCY,
      adType: 'free',
      priceType: 'Fixed',
      deliveryOptions: {
        buyerPickup: true,
        sellerDelivery: false,
        deliveryCharges: 0
      },
      contactOptions: {
        inAppChat: true,
        call: true,
        whatsapp: false
      },
      dimensions: {
        unit: 'cm'
      },
      brand: '',
      brandChoice: [],
      condition: [],
      make: '',
      model: '',
      childCategory: '',
      year: '',
      mileage: '',
      transmission: '',
      fuelType: '',
      purchaseYear: '',
      usageDuration: { value: '', unit: '' },
      reasonForSelling: '',
    }
  })

  // Reactive subscription to every field so the draft-autosave effect below re-runs
  // as the user types, not just when step/category/video/photos change.
  const watchedFormValuesForDraft = watch()

  const [currentStep, setCurrentStep] = useState(1)
  const [initialStepResolved, setInitialStepResolved] = useState(false)
  const isDynamicFormReadyToSubmit = useSelector(selectDynamicFormIsReadyToSubmit)
  const [imageFiles, setImageFiles] = useState([])
  const [videoFile, setVideoFile] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState('')
  const [subcategories, setSubcategories] = useState([])
  const [levelOptions, setLevelOptions] = useState([[]])
  const [selectedPath, setSelectedPath] = useState([])
  const [levelLabelsFromApi, setLevelLabelsFromApi] = useState(null)
  const [loadingLevels, setLoadingLevels] = useState(false)
  const [categoryPhase, setCategoryPhase] = useState('root')
  const [loadingSubcategories, setLoadingSubcategories] = useState(false)
  const [loadingProduct, setLoadingProduct] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // AI listing extraction state (used for car auto-fill + missing-field UX)
  const [aiListingExtraction, setAiListingExtraction] = useState(null)
  const [aiListingConfidence, setAiListingConfidence] = useState({})
  const [aiListingMissingFields, setAiListingMissingFields] = useState([])
  const [aiListingUserOverrides, setAiListingUserOverrides] = useState({
    engine_cc: null,
    horsepower: null,
    accident_free: null,
  })

  // Step 5's admin-configured fields live in a Redux slice that gets wiped as soon
  // as that step mounts (setActiveCategory resets `values`), so a restored draft's
  // dynamic-form values are handed down via ref and re-applied right after — see
  // useCategoryDynamicForm.
  const restoredDynamicFormValuesRef = useRef(null)

  // Restore session from storage when entering post-ad (prevents false logout on Back).
  useEffect(() => {
    dispatch(rehydrateSessionFromStorage())
  }, [dispatch])

  // Fresh post-ad flow each visit — UNLESS a previously saved draft exists for this
  // user (IndexedDB; see postAdDraftStore), in which case it's restored instead so a
  // refresh, or leaving and coming back to /post-ad, picks up right where they left
  // off (title/description/category/photos/video and admin-configured fields).
  // A `step` URL param (kept in sync below) still wins over the draft's own step
  // when present, so deep-linking to a specific step keeps working.
  useEffect(() => {
    if (isEditMode) {
      setInitialStepResolved(true)
      return
    }

    let cancelled = false

    const restoreOrReset = async () => {
      const draft = user?._id ? await loadPostAdDraft(user._id) : null

      if (!cancelled && draft && draft.currentStep > 1) {
        Object.entries(draft.formValues || {}).forEach(([key, value]) => setValue(key, value))
        if (draft.videoFile) setValue('video', draft.videoFile)
        setSelectedPath(draft.selectedPath || [])
        setSelectedCategory(draft.selectedCategory || '')
        setCategoryPhase(draft.categoryPhase || 'root')
        setVideoFile(draft.videoFile || null)
        setImageFiles(draft.imageFiles || [])
        restoredDynamicFormValuesRef.current = draft.dynamicFormValues || null

        const requestedDisplayStep = Number(searchParams.get('step'))
        const requestedStep = Number.isInteger(requestedDisplayStep) ? toInternalStep(requestedDisplayStep) : NaN
        const canHonorRequestedStep =
          Number.isInteger(requestedStep) && requestedStep >= 2 && requestedStep <= TOTAL_STEPS
        setCurrentStep(canHonorRequestedStep ? requestedStep : draft.currentStep)
        setInitialStepResolved(true)
        return
      }

      if (cancelled) return

      setSelectedPath([])
      setSelectedCategory('')
      setValue('category', '')
      setValue('subcategory', '')
      setValue('childCategory', '')
      setValue('categoryPath', [])
      setVideoFile(null)
      setImageFiles([])
      setCategoryPhase('root')

      const defaultStep = user ? (user?.role === 'admin' || user.isVerified ? 2 : 1) : 1
      const requestedDisplayStep = Number(searchParams.get('step'))
      const requestedStep = Number.isInteger(requestedDisplayStep) ? toInternalStep(requestedDisplayStep) : NaN
      const canHonorRequestedStep =
        defaultStep > 1 && Number.isInteger(requestedStep) && requestedStep >= 2 && requestedStep <= TOTAL_STEPS
      setCurrentStep(canHonorRequestedStep ? requestedStep : defaultStep)
      setInitialStepResolved(true)
    }

    restoreOrReset()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, isEditMode, setValue, user?.id])

  // Debounced autosave of the in-progress draft (text fields, category, video, photos,
  // and Step 5's admin-configured fields) so it survives a refresh or navigating away.
  useEffect(() => {
    if (isEditMode || !initialStepResolved || !user?._id || currentStep < 2) return

    const timeoutId = window.setTimeout(() => {
      const { video, ...formValues } = getValues()
      savePostAdDraft(user._id, {
        currentStep,
        categoryPhase,
        selectedPath,
        selectedCategory,
        formValues,
        videoFile,
        imageFiles,
        dynamicFormValues: dynamicFormSubmitValues,
      })
    }, 800)

    return () => window.clearTimeout(timeoutId)
  }, [
    isEditMode,
    initialStepResolved,
    user?._id,
    currentStep,
    categoryPhase,
    selectedPath,
    selectedCategory,
    videoFile,
    imageFiles,
    dynamicFormSubmitValues,
    watchedFormValuesForDraft,
    getValues,
  ])

  // Keep the URL's `step` param in sync so a refresh returns to this step.
  useEffect(() => {
    if (!initialStepResolved) return
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('step', String(toDisplayStep(currentStep)))
        return next
      },
      { replace: true },
    )
  }, [currentStep, initialStepResolved, setSearchParams])

  // Root categories for step 2 (single request; aborted on leave via route scope).
  useEffect(() => {
    const signal = getRouteAbortSignal()
    let cancelled = false
    setLoadingLevels(true)

    const timeoutId = window.setTimeout(() => {
      if (!cancelled) {
        setLoadingLevels(false)
        setLevelOptions((prev) => (prev[0]?.length ? prev : [[]]))
      }
    }, 30000)

    categoryService
      .getCategoryChildren(null, { signal })
      .then((res) => {
        if (cancelled) return
        setLevelOptions([Array.isArray(res.data) ? res.data : []])
      })
      .catch(() => {
        if (!cancelled) setLevelOptions([[]])
      })
      .finally(() => {
        if (!cancelled) setLoadingLevels(false)
        window.clearTimeout(timeoutId)
      })

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [])

  // Fetch level labels from backend when root category changes (for cascading dropdown labels)
  useEffect(() => {
    const rootId = selectedPath[0]
    if (!rootId || !levelOptions[0]?.length) {
      setLevelLabelsFromApi(null)
      return
    }
    const root = levelOptions[0].find((c) => String(c._id) === String(rootId))
    const rootName = root?.name
    if (!rootName) {
      setLevelLabelsFromApi(null)
      return
    }
    let cancelled = false
    categoryService
      .getLevelLabels(rootName)
      .then((res) => {
        if (!cancelled && res?.data?.labels) setLevelLabelsFromApi(res.data.labels)
      })
      .catch(() => {
        if (!cancelled) setLevelLabelsFromApi(null)
      })
    return () => { cancelled = true }
  }, [selectedPath[0], levelOptions[0]])

  // Load product data if in edit mode
  useEffect(() => {
    const loadProductData = async () => {
      if (!isEditMode || !editProductId) return

      try {
        setLoadingProduct(true)
        const response = await productService.getProductById(editProductId)
        const product = response.data
        
        if (!product) {
          toast.error('Product not found')
          navigate('/dashboard')
          return
        }

        setEditProductPostedAt(product.createdAt ? new Date(product.createdAt) : new Date())
        
        // Check ownership
        if (user && product.seller) {
          const sellerId = product.seller._id || product.seller
          const userId = user._id
          if (sellerId && userId && sellerId.toString() !== userId.toString()) {
            toast.error('You are not authorized to edit this product')
            navigate('/dashboard')
            return
          }
        }
        
        // Populate form with the same fields used in post-ad
        const formValues = buildPostAdFormValuesFromProduct(product, user)
        Object.keys(formValues).forEach((key) => {
          setValue(key, formValues[key])
        })

        if (product.ai_raw_response) {
          setAiListingExtraction(product.ai_raw_response)
        } else if (product.display_data || product.filter_data) {
          setAiListingExtraction({
            display_data: product.display_data,
            filter_data: product.filter_data,
            missing_fields: product.missing_fields || [],
          })
        }

        let restoredCategoryPath = false
        if (product.category) {
          const categoryId = product.category._id || product.category
          setSelectedCategory(categoryId)
          try {
            const pathRes = await categoryService.getCategoryPath(categoryId)
            const pathCategories = pathRes.data?.categories || []
            if (pathCategories.length > 0) {
              const MAX_CATEGORY_LEVEL_INDEX = 2
              const maxPathLen = MAX_CATEGORY_LEVEL_INDEX + 1
              const truncatedPathCategories = pathCategories.slice(0, maxPathLen)

              setSelectedPath(truncatedPathCategories.map((c) => c._id))
              const level1SubcategoryId = truncatedPathCategories[1]?._id || ''
              const level2ChildCategoryId = truncatedPathCategories[2]?._id || ''
              setValue('subcategory', level1SubcategoryId)
              setValue('childCategory', level2ChildCategoryId)
              const rootsRes = await categoryService.getCategoryChildren(null)
              const roots = Array.isArray(rootsRes.data) ? rootsRes.data : []
              const opts = [roots]
              for (let i = 0; i < truncatedPathCategories.length - 1; i++) {
                const childRes = await categoryService.getCategoryChildren(truncatedPathCategories[i]._id)
                opts.push(Array.isArray(childRes.data) ? childRes.data : [])
              }
              setLevelOptions(opts)
              restoredCategoryPath = true
              restoreProductFilterSelections(product, setValue)
            } else {
              const category = categories.find((cat) => cat._id === categoryId)
              if (category) setSubcategories(category.subcategories || [])
            }
          } catch {
            const category = categories.find((cat) => cat._id === categoryId)
            if (category) setSubcategories(category.subcategories || [])
          }
        }

        if (!restoredCategoryPath && product.category) {
          restoreProductFilterSelections(product, setValue)
        }

        // Set brandChoice for edit mode: if existing brand is in the category brand options, pre-select it;
        // otherwise mark as 'Other' and populate canonical 'brand' with the saved value.
        if (product.brand && product.category) {
          const categoryId = product.category._id || product.category
          const pathRes = await categoryService.getCategoryPath(categoryId).catch(() => ({ data: {} }))
          const pathCategories = pathRes.data?.categories || []
          const category = pathCategories[pathCategories.length - 1] || categories.find((cat) => cat._id === categoryId)
          if (category) {
            let prodSubName = ''
            if (pathCategories.length >= 2) {
              prodSubName = pathCategories[pathCategories.length - 2].name || ''
            } else if (product.subcategory) {
              if (typeof product.subcategory === 'object' && product.subcategory?.name) prodSubName = product.subcategory.name
              else if (category.subcategories) {
                const foundSub = category.subcategories.find((s) => String(s._id) === String(product.subcategory))
                prodSubName = foundSub?.name || ''
              }
            }
            const options = getBrandOptionsForCategory(resolveCategoryKeyForFields(category.name), prodSubName)
            if (options && options.includes(product.brand)) {
              setValue('brandChoice', [product.brand])
            } else {
              setValue('brandChoice', ['Other'])
              setValue('brand', product.brand)
            }
          } else {
            // fallback: set brand directly
            setValue('brand', product.brand)
            setValue('brandChoice', [product.brand])
          }
        }

        // Load existing images and video
        if (product.images && product.images.length > 0) {
          // Convert image URLs to objects that can be displayed
          const existingImages = product.images.map((img, index) => ({
            url: getMediaUrl(img),
            name: `existing-image-${index}.jpg`,
            isExisting: true, // Flag to identify existing images
            originalUrl: img
          }))
          setImageFiles(existingImages)
        }
        
        if (product.video) {
          // Convert video URL to object that can be displayed
          setVideoFile({
            url: getMediaUrl(product.video),
            name: 'existing-video.mp4',
            isExisting: true, // Flag to identify existing video
            originalUrl: product.video
          })
        }

        setCurrentStep(5)
        window.scrollTo(0, 0)
      } catch (error) {
        console.error('Error loading product:', error)
        toast.error(error.response?.data?.message || 'Failed to load product data')
        navigate('/dashboard')
      } finally {
        setLoadingProduct(false)
      }
    }

    loadProductData()
  }, [isEditMode, editProductId, user, navigate, setValue])

  const handleLevelChange = async (levelIndex, categoryId) => {
    const MAX_CATEGORY_LEVEL_INDEX = 1
    const maxPathLen = MAX_CATEGORY_LEVEL_INDEX + 1

    const newPathRaw = categoryId
      ? [...selectedPath.slice(0, levelIndex), categoryId]
      : selectedPath.slice(0, levelIndex)
    const newPath = newPathRaw.slice(0, maxPathLen)

    setSelectedPath(newPath)
    const rootId = newPath[0] || ''
    const subcategoryId = newPath[1] || ''
    setValue('category', rootId)
    setValue('subcategory', subcategoryId)
    setValue('childCategory', '')
    setValue('categoryPath', newPath.filter(Boolean))

    if (!categoryId) {
      setLevelOptions((prev) => prev.slice(0, Math.min(levelIndex + 1, maxPathLen)))
      return
    }

    if (levelIndex >= MAX_CATEGORY_LEVEL_INDEX) {
      setLevelOptions((prev) => prev.slice(0, maxPathLen))
      return
    }

    setLoadingLevels(true)
    try {
      const res = await categoryService.getCategoryChildren(categoryId)
      const children = Array.isArray(res.data) ? res.data : []
      const nextLevelIndex = levelIndex + 1
      if (nextLevelIndex > MAX_CATEGORY_LEVEL_INDEX) {
        setLevelOptions((prev) => prev.slice(0, maxPathLen))
      } else {
        setLevelOptions((prev) => [...prev.slice(0, nextLevelIndex), children])
      }
    } catch {
      setLevelOptions((prev) => prev.slice(0, Math.min(levelIndex + 1, maxPathLen)))
    } finally {
      setLoadingLevels(false)
    }
  }

  /** Step 2a: pick root category → show subcategory list (or skip if none). */
  const handleRootCategorySelect = (categoryId) => {
    if (!categoryId) return

    setSelectedPath([categoryId])
    setSelectedCategory(categoryId)
    setValue('category', categoryId, { shouldValidate: true })
    setValue('subcategory', '')
    setValue('childCategory', '')
    setValue('categoryPath', [categoryId])

    const roots = levelOptions[0] || []
    setLoadingSubcategories(true)
    categoryService
      .getCategoryChildren(categoryId, { signal: getRouteAbortSignal() })
      .then((res) => {
        const children = Array.isArray(res.data) ? res.data : []
        setLevelOptions([roots, children])
        setSubcategories(children)
        if (children.length === 0) {
          setCategoryPhase('root')
          toast.success('Category selected')
          setCurrentStep(3)
          window.scrollTo(0, 0)
        } else {
          setCategoryPhase('subcategory')
          window.scrollTo(0, 0)
        }
      })
      .catch(() => {
        setLevelOptions([roots])
        setSubcategories([])
        setCategoryPhase('root')
      })
      .finally(() => setLoadingSubcategories(false))
  }

  const handleSubcategorySelect = (subcategoryId) => {
    if (!subcategoryId) return
    const rootId = selectedPath[0]
    setSelectedPath([rootId, subcategoryId])
    setValue('subcategory', subcategoryId, { shouldValidate: true })
    setValue('childCategory', '')
    setValue('categoryPath', [rootId, subcategoryId].filter(Boolean))

    const roots = levelOptions[0] || []
    const subs = levelOptions[1] || []

    // Motors: skip the child-category step entirely — even if children exist — so the
    // dynamic form loads for the chosen subcategory.
    const rootName = roots.find((c) => String(c._id) === String(rootId))?.name
    if (isMotorsRootCategory(rootName)) {
      setLevelOptions([roots, subs])
      setCurrentStep(3)
      window.scrollTo(0, 0)
      return
    }

    setLoadingSubcategories(true)
    categoryService
      .getCategoryChildren(subcategoryId, { signal: getRouteAbortSignal() })
      .then((res) => {
        const children = Array.isArray(res.data) ? res.data : []
        setLevelOptions([roots, subs, children])
        if (children.length > 0) {
          setCategoryPhase('childCategory')
          window.scrollTo(0, 0)
        } else {
          setCurrentStep(3)
          window.scrollTo(0, 0)
        }
      })
      .catch(() => {
        setLevelOptions([roots, subs])
        setCurrentStep(3)
        window.scrollTo(0, 0)
      })
      .finally(() => setLoadingSubcategories(false))
  }

  const handleChildCategorySelect = (childCategoryId) => {
    if (!childCategoryId) return
    const rootId = selectedPath[0]
    const subId = selectedPath[1]
    setSelectedPath([rootId, subId, childCategoryId])
    setValue('childCategory', childCategoryId, { shouldValidate: true })
    setValue('categoryPath', [rootId, subId, childCategoryId].filter(Boolean))
    setCurrentStep(3)
    window.scrollTo(0, 0)
  }

  const handleCategoryPhaseBack = () => {
    if (categoryPhase === 'childCategory') {
      const rootId = selectedPath[0]
      const subId = selectedPath[1]
      setCategoryPhase('subcategory')
      setValue('childCategory', '')
      setSelectedPath([rootId, subId].filter(Boolean))
      setValue('categoryPath', [rootId, subId].filter(Boolean))
      window.scrollTo(0, 0)
      return
    }
    const rootId = selectedPath[0]
    if (!rootId) {
      navigate('/', { replace: true })
      return
    }
    setCategoryPhase('root')
    setValue('subcategory', '')
    setValue('childCategory', '')
    setSelectedPath([rootId])
    setValue('categoryPath', [rootId])
    window.scrollTo(0, 0)
  }

  const handleCategoryChange = (categoryId) => {
    setSelectedCategory(categoryId)
    const category = categories.find((cat) => cat._id === categoryId)
    setSubcategories(category?.subcategories || [])
    setValue('category', categoryId)
    setValue('subcategory', '')
  }

  const rootCategoryName =
    levelOptions[0]?.find((c) => String(c._id) === String(selectedPath[0]))?.name || ''
  const subcategoryOptions = levelOptions[1] || []
  const selectedSubcategoryId = watch('subcategory') || selectedPath[1] || ''
  const selectedSubcategoryName =
    subcategoryOptions.find((c) => String(c._id) === String(selectedSubcategoryId))?.name || ''
  const childCategoryOptions = levelOptions[2] || []
  const selectedChildCategoryId = watch('childCategory') || selectedPath[2] || ''
  const levelLabels = levelLabelsFromApi ?? getLevelLabels(rootCategoryName)
  const flatCategoriesForSteps = levelOptions.flat()
  const selectedCategoryForSteps = watch('category')
  const selectedCategoryObjForSteps = flatCategoriesForSteps.find(
    (c) => c && String(c._id) === String(selectedCategoryForSteps)
  )
  const categoryPathNames = selectedPath
    .map((id, i) => levelOptions[i]?.find((c) => String(c._id) === String(id))?.name)
    .filter(Boolean)

  const validateStep = (step) => {
  switch (step) {
    case 1: {
      const isAdmin = user?.role === 'admin'
      return !!user && (isAdmin || user.isVerified)
    }

    case 2: {
      if (!watch('category')) return false
      const subs = levelOptions[1] || []
      if (subs.length > 0) return !!watch('subcategory')
      return true
    }

    case 3: {
      if (!videoFile) return false

      const nonScreenshotImages = imageFiles.filter(f => !f.isScreenshot)
      const screenshotImages = imageFiles.filter(f => f.isScreenshot)

      return nonScreenshotImages.length > 0 || screenshotImages.length > 0
    }

    case 4: {
      const title = (watch('title') || '').trim()
      const desc = (watch('description') || '').trim()
      if (!title || title.length < 10) return false
      if (!desc || desc.length < 30) return false
      return imageFiles.length > 0
    }

    case 5:
      return isDynamicFormReadyToSubmit

    case 6:
      return watch('acceptRules') === true

    default:
      return true
  }
}

  const nextStep = async () => {
    // Trigger validation for current step fields
    const stepFields = getStepFields(currentStep)
    
    // Trigger react-hook-form validation for all fields in current step
    if (stepFields.length > 0) {
      const isValid = await trigger(stepFields, { shouldFocus: true })
      if (!isValid) {
        const errorMessage = getStepValidationMessage(currentStep)
        toast.error(errorMessage)
        return
      }
    }
    
    // Additional custom validation
    if (validateStep(currentStep)) {
      if (currentStep < TOTAL_STEPS) {
        setCurrentStep(currentStep + 1)
        window.scrollTo(0, 0)
      }
    } else {
      // Show specific validation messages
      const errorMessage = getStepValidationMessage(currentStep)
      toast.error(errorMessage)
    }
  }
  
  const getStepFields = (step) => {
    switch (step) {
      case 2: {
        const subs = levelOptions[1] || []
        return subs.length > 0 ? ['category', 'subcategory'] : ['category']
      }
      // Optional on the upload-video step; required on the review step below it.
      case 3: return []
      case 4: return ['title', 'description']
      case 5: return []
      case 6: return ['acceptRules']
      default: return []
    }
  }

  const validateField = (step, field, value) => {
    switch (step) {
      case 2:
        if (field === 'category') return !!value
        return true
      case 3:
        if (field === 'title') return value && value.length >= 10 && value.length <= 100
        if (field === 'condition') return !!value
        return true
      case 6:
        if (field === 'acceptRules') return value === true
        return true
      default:
        return true
    }
  }
  
  const getStepValidationMessage = (step) => {
  switch (step) {
    case 2:
      if (!watch('category')) return 'Please select a category'
      if ((levelOptions[1] || []).length > 0 && !watch('subcategory')) return 'Please select a subcategory'
      return 'Please complete all required fields'

    case 3: {
      if (!videoFile) return 'Please upload or capture a video'

      const nonScreenshotImages = imageFiles.filter(f => !f.isScreenshot)
      const screenshotImages = imageFiles.filter(f => f.isScreenshot)

      if (nonScreenshotImages.length === 0 && screenshotImages.length === 0) {
        return 'Please upload at least 1 image or capture a screenshot'
      }

      return 'Please complete all required fields'
    }

    case 4: {
      const title = (watch('title') || '').trim()
      const desc = (watch('description') || '').trim()
      if (!title) return 'Please enter a title'
      if (title.length < 10) return 'Title must be at least 10 characters'
      if (!desc) return 'Please enter a description'
      if (desc.length < 30) return 'Description must be at least 30 characters'
      if (imageFiles.length === 0) return 'Please add at least one photo'
      return 'Please complete all required fields'
    }

    case 5:
      if (!isDynamicFormReadyToSubmit) return 'Please complete the additional details below'
      return 'Please complete all required fields'

    case 6:
      if (!watch('acceptRules')) return 'Please accept the posting rules'
      return 'Please complete all required fields'

    default:
      return 'Please complete all required fields'
  }
}
  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
      window.scrollTo(0, 0)
    }
  }

  const handlePostAdBack = () => {
    if (currentStep === 3) {
      if (isEditMode) {
        setCurrentStep(5)
        window.scrollTo(0, 0)
        return
      }
      const hasChildCategory = selectedPath.length > 2 && (levelOptions[2] || []).length > 0
      const hasSubs = (levelOptions[1] || []).length > 0
      setCurrentStep(2)
      setCategoryPhase(hasChildCategory ? 'childCategory' : hasSubs ? 'subcategory' : 'root')
      window.scrollTo(0, 0)
      return
    }
    if (currentStep === 2 && (categoryPhase === 'subcategory' || categoryPhase === 'childCategory')) {
      handleCategoryPhaseBack()
      return
    }
    if (currentStep === 2) {
      navigate('/', { replace: true })
    }
  }

  // True once the user has entered anything worth offering to discard — used to
  // show/hide the "Flush Data" button below.
  const hasEnteredData =
    currentStep > 2 ||
    (currentStep === 2 && selectedPath.length > 0) ||
    Boolean(videoFile) ||
    imageFiles.length > 0 ||
    Boolean((watch('title') || '').trim()) ||
    Boolean((watch('description') || '').trim())

  const handleFlushData = () => {
    if (user?._id) clearPostAdDraft(user._id)
    reset()
    setSelectedPath([])
    setSelectedCategory('')
    setVideoFile(null)
    setImageFiles([])
    setCategoryPhase('root')
    dispatch(resetDynamicForm())
    restoredDynamicFormValuesRef.current = null
    setCurrentStep(user ? (user?.role === 'admin' || user.isVerified ? 2 : 1) : 1)
    window.scrollTo(0, 0)
    toast.success('All entered data cleared.')
  }

  const onSubmit = async (data) => {
    // Prevent double submission
    if (isSubmitting) {
      return
    }
    
    setIsSubmitting(true)
    
    try {
      // Validate media before submission
      if (!videoFile) {
        toast.error('Please upload a video')
        setCurrentStep(3)
        setIsSubmitting(false)
        return
      }
      if (imageFiles.length === 0) {
        toast.error('Please upload at least 1 image')
        setCurrentStep(4)
        setIsSubmitting(false)
        return
      }

      // Combine location fields. The old Location & Delivery step (country/city/area)
      // was removed, and the map picker's locationAddress only populates once Google
      // Maps is actually configured (VITE_GOOGLE_MAPS_API_KEY) — until then, fall back
      // to any admin-configured free-text field (e.g. "Locate your item"), since the
      // backend's `location` schema field is required and rejects an empty string.
      const dynamicTextFallback = allDynamicFieldsForSubmit
        .filter((f) => getFieldKind(f.fieldType) === FIELD_KIND.TEXT)
        .map((f) => dynamicFormSubmitValues[f.fieldName])
        .filter(Boolean)
        .join(', ')
      const location =
        data.location ||
        data.locationAddress ||
        (data.area && data.city && data.country ? `${data.area}, ${data.city}, ${data.country}` : '') ||
        dynamicTextFallback ||
        'Not specified' // last-resort fallback — Product.location is a required schema field

      // AI validation layer for car listings:
      // Merge AI extracted values + user edits, then ensure all required car fields exist before submit.
      let aiMergedCarListing = null
      const selectedCat =
        (categories || []).find((c) => String(c._id) === String(data.category || watch('category'))) || null
      const isVehicleListing = Boolean(selectedCat?.name && /vehicles?|motors?|cars?|auto/i.test(String(selectedCat.name)))
      if (aiListingExtraction && isVehicleListing) {
        const REQUIRED_FIELDS = [
          'brand',
          'model',
          'year',
          'price',
          'currency',
          'location_city',
          'mileage_km',
          'engine_cc',
          'horsepower',
          'transmission',
          'fuel_type',
          'body_type',
          'condition',
          'accident_free',
        ]

        const toNumberOrNull = (v) => {
          if (v === null || v === undefined || v === '') return null
          const n = typeof v === 'number' ? v : Number(v)
          return Number.isFinite(n) ? n : null
        }

        const toFilterEnum = (v) => {
          const s = v === null || v === undefined ? '' : String(v).trim()
          if (!s) return null
          return s.toLowerCase().replace(/[\s\-_]+/g, '_')
        }

        const toFilterString = (v) => {
          const s = v === null || v === undefined ? '' : String(v).trim()
          if (!s) return null
          return s.toLowerCase()
        }

        const parseEngineSizeToCc = (engineSize) => {
          if (engineSize === null || engineSize === undefined || engineSize === '') return null
          if (typeof engineSize === 'number') return Number.isFinite(engineSize) ? engineSize : null
          const s = String(engineSize).trim().toLowerCase()
          if (!s) return null
          // "2000cc"
          if (s.includes('cc')) return toNumberOrNull(s.replace(/cc/g, ''))
          // "1.5l"
          if (s.includes('l')) {
            const liters = toNumberOrNull(s.replace(/l/g, '').trim())
            if (liters === null) return null
            return Math.round(liters * 1000)
          }
          // fallback number in string
          return toNumberOrNull(s.match(/-?\d+(?:\.\d+)?/)?.[0])
        }

        const baseDisplay = aiListingExtraction?.display_data || {}
        const baseFilter = aiListingExtraction?.filter_data || {}
        const baseSpecs = aiListingExtraction?.specifications || {}

        const userBrand = data.brand || data.make || baseDisplay.brand || null
        const userModel = data.model || baseDisplay.model || null
        const userYear = data.year || baseDisplay.year || null
        const userPrice = data.price || baseDisplay.price || null
        const userCurrency = MARKETPLACE_CURRENCY
        const userCity = data.city || baseDisplay.location_city || null
        const userMileage = data.mileage || baseDisplay.mileage_km || null
        const engineCcParsed = parseEngineSizeToCc(data.engineSize || '')
        const userEngineCc = engineCcParsed || aiListingUserOverrides?.engine_cc || baseDisplay.engine_cc || null
        const userHorsepower = aiListingUserOverrides?.horsepower || baseDisplay.horsepower || null
        const userTransmission = data.transmission || baseDisplay.transmission || null
        const userFuelType = data.fuelType || baseDisplay.fuel_type || null
        const userBodyType = data.bodyType || baseDisplay.body_type || null
        const userCondition = scalarFromMultiSelect(data.condition) || baseDisplay.condition || null
        const userAccidentFree = aiListingUserOverrides?.accident_free ?? baseDisplay.accident_free ?? null

        const display_data = {
          brand: userBrand,
          model: userModel,
          year: userYear,
          price: userPrice,
          currency: userCurrency ? String(userCurrency).toUpperCase() : null,
          location_city: userCity,
          mileage_km: userMileage,
          engine_cc: userEngineCc,
          horsepower: userHorsepower,
          transmission: scalarFromMultiSelect(data.transmission) || userTransmission,
          fuel_type: scalarFromMultiSelect(data.fuelType) || userFuelType,
          body_type: scalarFromMultiSelect(data.bodyType) || userBodyType,
          condition: userCondition,
          accident_free: userAccidentFree,
        }

        const filter_data = {
          brand: toFilterString(userBrand),
          model: toFilterString(userModel),
          year: toNumberOrNull(userYear),
          price: toNumberOrNull(userPrice),
          currency: userCurrency ? String(userCurrency).toLowerCase() : null,
          location_city: toFilterString(userCity),
          mileage_km: toNumberOrNull(userMileage),
          engine_cc: toNumberOrNull(userEngineCc),
          horsepower: toNumberOrNull(userHorsepower),
          transmission: toFilterEnum(userTransmission),
          fuel_type: toFilterEnum(userFuelType),
          body_type: toFilterEnum(userBodyType),
          condition: toFilterEnum(userCondition),
          accident_free: typeof userAccidentFree === 'boolean' ? userAccidentFree : null,
        }

        // Ensure `missing_fields` is computed from merged data.
        const missing_fields = REQUIRED_FIELDS.filter((k) => {
          const v = filter_data[k]
          if (v === null || v === undefined || v === '') return true
          return false
        })

        // Do not block submission on AI "required fields" completeness.
        // The existing multi-step UI flow already enforces the truly required inputs (title/condition/make, price, location).
        // We still store missing_fields for debugging + later enrichment.

        const vehicleSpecifications =
          getValues('__vehicleSpecifications') ||
          aiListingExtraction?.vehicleSpecifications ||
          aiListingExtraction?.enrichment?.vehicleSpecifications ||
          null

        aiMergedCarListing = {
          display_data,
          filter_data,
          specifications: {
            ...baseSpecs,
            engine_cc: filter_data.engine_cc,
            horsepower: filter_data.horsepower,
            accident_free: filter_data.accident_free,
          },
          vehicleSpecifications,
          missing_fields,
          ai_raw_response: aiListingExtraction,
        }
      }
      
      // Separate new files from existing media URLs
      // Convert screenshot URLs to File objects
      const screenshotFiles = await Promise.all(
        imageFiles
          .filter(file => file.isScreenshot && !file.isExisting)
          .map(async (screenshot) => {
            try {
              const response = await fetch(screenshot.url)
              const blob = await response.blob()
              const file = new File([blob], screenshot.name || 'screenshot.jpg', { type: 'image/jpeg' })
              return file
            } catch (error) {
              console.error('Error converting screenshot to file:', error)
              return null
            }
          })
      )
      
      const regularImageFiles = imageFiles.filter(file => 
        !file.isScreenshot && !file.isExisting && file instanceof File
      )
      const newImages = [...regularImageFiles, ...screenshotFiles.filter(f => f !== null)]
      const existingImageUrls = imageFiles.filter(file => file.isExisting).map(file => file.originalUrl || file.url)
      
      let newVideo =
        videoFile && !videoFile.isExisting && videoFile instanceof File ? videoFile : null
      if (!newVideo && videoFile instanceof Blob && !videoFile.isExisting) {
        const name = videoFile.name || 'listing-video.mp4'
        newVideo = new File([videoFile], name, { type: videoFile.type || 'video/mp4' })
      }
      const existingVideoUrl = videoFile?.isExisting ? (videoFile.originalUrl || videoFile.url) : null

      if (!newVideo && !existingVideoUrl) {
        toast.error('Video file is missing. Please re-upload your video on step 3.')
        setCurrentStep(3)
        setIsSubmitting(false)
        return
      }
      
      // Build the full category hierarchy path (IDs + names)
      const pathIds = selectedPath.filter(Boolean)
      const pathNames = selectedPath
        .map((id, i) => levelOptions[i]?.find((c) => String(c._id) === String(id))?.name)
        .filter(Boolean)

      // Prepare form data with proper structure
      // Price/condition come only from AI extraction now (their manual steps were
      // removed) — fall back to a dummy value when AI didn't detect one, since both
      // are required by the backend's route-level and schema validation.
      const priceNumeric = Number(data.price)
      const priceValue = data.price !== '' && data.price != null && !Number.isNaN(priceNumeric) && priceNumeric > 0
        ? data.price
        : 1
      const conditionValue = scalarFromMultiSelect(data.condition) || 'Good'

      const formData = {
        title: data.title,
        description: data.description,
        price: priceValue,
        currency: MARKETPLACE_CURRENCY,
        category: data.category,
        // Two-level category flow: category + subcategory only.
        subcategory: data.subcategory || null,
        childCategory: null,
        categoryPath: JSON.stringify(pathIds),
        categoryPathNames: JSON.stringify(pathNames),
        location: location,
        condition: conditionValue,
        priceType: data.priceType || 'Fixed',
        adType: data.adType || 'free',
        images: newImages.length > 0 ? newImages : undefined,
        existingImages: isEditMode
          ? existingImageUrls
          : existingImageUrls.length > 0
            ? existingImageUrls
            : undefined,
        video: newVideo || undefined,
        existingVideo: existingVideoUrl || undefined,
        ...(aiMergedCarListing
          ? {
              display_data: aiMergedCarListing.display_data,
              filter_data: aiMergedCarListing.filter_data,
              specifications: aiMergedCarListing.specifications,
              vehicleSpecifications: aiMergedCarListing.vehicleSpecifications,
              missing_fields: aiMergedCarListing.missing_fields,
              ai_raw_response: aiMergedCarListing.ai_raw_response,
            }
          : {}),
      }

      assignIfPresent(formData, 'latitude', data.latitude)
      assignIfPresent(formData, 'longitude', data.longitude)
      assignIfPresent(formData, 'locationAddress', data.locationAddress)
      assignIfPresent(formData, 'country', data.country)
      assignIfPresent(formData, 'city', data.city)
      assignIfPresent(formData, 'area', data.area)
      assignIfPresent(formData, 'brand', data.brand)
      assignIfPresent(formData, 'contactName', data.contactName)
      assignIfPresent(formData, 'contactPhone', data.contactPhone)
      assignIfPresent(formData, 'material', data.material)
      assignIfPresent(formData, 'make', data.make)
      assignIfPresent(formData, 'model', data.model)
      assignIfPresent(formData, 'assemblyStatus', data.assemblyStatus)

      const colorValue = scalarFromMultiSelect(data.color)
      if (hasFormPayloadValue(colorValue)) formData.color = colorValue

      if (data.year !== '' && data.year != null) formData.year = Number(data.year)
      if (data.mileage !== '' && data.mileage != null) formData.mileage = Number(data.mileage)

      const transmissionValue = scalarFromMultiSelect(data.transmission)
      if (hasFormPayloadValue(transmissionValue)) formData.transmission = transmissionValue

      const fuelTypeValue = scalarFromMultiSelect(data.fuelType)
      if (hasFormPayloadValue(fuelTypeValue)) formData.fuelType = fuelTypeValue

      if (data.seatingCapacity) formData.seatingCapacity = Number(data.seatingCapacity)

      // Attach category filter selections (exclude Ads Posted — set automatically below).
      const categoryFilterList = getValues('__categoryFilters') || []
      const adsPostedAuto = resolveAdsPostedSelectionForDate(
        isEditMode && editProductPostedAt ? editProductPostedAt : new Date(),
        categoryFilterList,
      )
      const filterEntries = {}
      Object.keys(data || {}).forEach((key) => {
        if (!key.startsWith('filter_')) return
        if (adsPostedAuto?.fieldKey && key === adsPostedAuto.fieldKey) return
        const v = data[key]
        if (v === undefined || v === null || v === '') return
        const normalized = toFilterArray(v)
        if (!normalized.length) return
        formData[key] = normalized
        filterEntries[key] = normalized
      })
      applyAdsPostedToFormData(formData, categoryFilterList, {
        postedAt: isEditMode && editProductPostedAt ? editProductPostedAt : new Date(),
      })
      if (adsPostedAuto?.fieldKey) {
        filterEntries[adsPostedAuto.fieldKey] = formData[adsPostedAuto.fieldKey]
      }
      if (Object.keys(filterEntries).length) {
        console.log('[PostAd] Sending filter data:', filterEntries)
      }

      // Admin-configured Car Overview/Features fields (modelid, trimid, cityid,
      // driverassistancesafetyid, ...) live in the dynamicForm Redux slice, not
      // react-hook-form, so they need to be attached explicitly. Sent as raw ids under
      // each field's own fieldName, multi-select values comma-joined — matching the
      // backend's productVehicleFields lowercase-key aliasing (see api/utils/productVehicleFields.js).
      //
      // Any field whose admin-configured type is "checkbox" (multi-select — see
      // FIELD_KIND.CHECKBOX / getFieldKind) is ALSO grouped into a single `features`
      // JSON array of { title, values }, purely by field type so it applies to every
      // category automatically, including ones added later — no per-field allowlist.
      const features = []
      allDynamicFieldsForSubmit.forEach((field) => {
        const raw = dynamicFormSubmitValues[field.fieldName]
        if (raw === undefined || raw === null || raw === '') return

        // Admin-configured field names aren't guaranteed unique against reserved
        // top-level keys (title, description, price, ...) — never let one clobber
        // a value already set above (e.g. a category field labeled "Description"
        // silently truncating the real ad description before submit).
        const value = Array.isArray(raw) ? raw.join(',') : String(raw)
        if (value && !formData.hasOwnProperty(field.fieldName)) formData[field.fieldName] = value

        if (getFieldKind(field.fieldType) === FIELD_KIND.CHECKBOX) {
          const values = (Array.isArray(raw) ? raw : [raw]).filter(Boolean).map(String)
          if (values.length) {
            features.push({ title: field.fieldTitle || field.fieldName, values })
          }
        }
      })
      if (features.length > 0) {
        formData.features = features
      }

      // Attach any other transcription/dynamic primitive fields so they persist.
      // (React Hook Form may hold values for fields we don't explicitly map above.)
      const allValues = getValues()
      const excludedExtraKeys = new Set([
        // Helpers / UI-only
        'brandChoice',
        'acceptRules',
        'currency',
        '__categoryFilters',
        '__categoryFilterFieldKeys',
        '__categoryFiltersLoading',
        '__categoryFiltersError',
        '__suggestedFilters',
        '__suggestedFilterData',
        'categoryPath',
        'categoryPathNames',
        // Media handled separately
        'video',
        'images',
        // Existing-media helper keys
        'existingImages',
        'existingVideo',
      ])
      Object.keys(allValues || {}).forEach((key) => {
        if (formData.hasOwnProperty(key)) return
        if (excludedExtraKeys.has(key)) return
        if (key.startsWith('filter_')) return // already handled above

        const value = allValues[key]
        if (value === undefined || value === null || value === '') return

        if (Array.isArray(value)) {
          const scalar = scalarFromMultiSelect(value)
          if (scalar) formData[key] = scalar
          return
        }

        // Avoid sending nested objects unless explicitly mapped above.
        if (typeof value === 'object') return

        if (typeof value === 'string') {
          formData[key] = value.trim()
        } else {
          // numbers/booleans
          formData[key] = value
        }
      })

      // Dimensions
      if (data.dimensions && (data.dimensions.length || data.dimensions.width || data.dimensions.height)) {
        formData.dimensions = {
          length: data.dimensions.length ? Number(data.dimensions.length) : null,
          width: data.dimensions.width ? Number(data.dimensions.width) : null,
          height: data.dimensions.height ? Number(data.dimensions.height) : null,
          unit: data.dimensions.unit || 'cm'
        }
      }

      // Usage details
      if (data.purchaseYear) {
        formData.purchaseYear = Number(data.purchaseYear)
      }
      if (data.usageDuration && (data.usageDuration.value || data.usageDuration.unit)) {
        formData.usageDuration = {
          value: data.usageDuration.value ? Number(data.usageDuration.value) : null,
          unit: data.usageDuration.unit || null
        }
      }
      if (data.reasonForSelling) {
        formData.reasonForSelling = data.reasonForSelling
      }

      // Delivery options
      if (data.deliveryOptions) {
        formData.deliveryOptions = {
          buyerPickup: data.deliveryOptions.buyerPickup !== false,
          sellerDelivery: data.deliveryOptions.sellerDelivery === true,
          deliveryCharges: data.deliveryOptions.deliveryCharges ? Number(data.deliveryOptions.deliveryCharges) : 0
        }
      }

      // Contact options
      if (data.contactOptions) {
        formData.contactOptions = {
          inAppChat: data.contactOptions.inAppChat !== false,
          call: data.contactOptions.call !== false,
          whatsapp: data.contactOptions.whatsapp === true
        }
      }

      console.log('[PostAd] Submit payload:', formData)

      if (isEditMode) {
        const updatedProduct = await dispatch(updateProduct({ id: editProductId, productData: formData })).unwrap()
        toast.success('Product updated successfully!')
        if (user?._id) {
          dispatch(fetchProducts({ userId: user._id }))
        }
      } else {
        const createdProduct = await dispatch(createProduct(formData)).unwrap()
        toast.success('Product submitted for review! It will be visible after admin approval.')
        if (user?._id) clearPostAdDraft(user._id)

        // Listing is saved (isPaymentDone = 0) — send the seller on to pick a package.
        const createdId = createdProduct?._id || createdProduct?.id
        if (createdId) {
          navigate(`/post-ad/select-package?productId=${createdId}`, {
            state: { breadcrumbItems: [...pathNames, 'Summary'] },
          })
          return
        }
      }
      navigate('/dashboard')
    } catch (error) {
      console.error('Error submitting form:', error)
      // `error` here is normally the createProduct/updateProduct thunk's
      // rejectWithValue({ message, angleChecklist }), but stay defensive — a raw
      // axios error (response.data.message) or a plain thrown Error can also reach
      // this catch (e.g. a failure earlier in the try block, before dispatch).
      const responseData = error?.response?.data
      let errorMessage
      let angleChecklist
      if (typeof error === 'string') {
        errorMessage = error
      } else if (typeof responseData === 'string') {
        errorMessage = responseData
      } else if (responseData?.message) {
        errorMessage = responseData.message
        angleChecklist = responseData.angleChecklist
      } else if (error?.message) {
        errorMessage = error.message
        angleChecklist = error.angleChecklist
      } else {
        errorMessage = `Failed to ${isEditMode ? 'update' : 'post'} product`
      }
      toast.error(
        Array.isArray(angleChecklist) && angleChecklist.length
          ? `${errorMessage} (${angleChecklist.join(', ')})`
          : errorMessage,
        { duration: 6000 },
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loadingProduct) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </div>
    )
  }

  if (!initialStepResolved) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-600 border-t-transparent" />
        </div>
      </div>
    )
  }

  const formData = watch()

  const isCategoryStep = currentStep === 2 && !isEditMode
  const isListingDetailsStep = currentStep === 3 && !isEditMode
  const isTitlePhotosStep = currentStep === 4 && !isEditMode
  const isBasicDetailsStep = currentStep === 5
  const isReviewStep = currentStep === 6

  return (
    <div className={`mx-auto w-full ${isCategoryStep || isListingDetailsStep || isTitlePhotosStep || isBasicDetailsStep || isReviewStep ? 'max-w-none px-0 py-0' : 'max-w-4xl px-3 sm:px-4 md:px-6 lg:px-8 py-6 sm:py-8'}`}>
      {!isEditMode && hasEnteredData && (
        <button
          type="button"
          onClick={handleFlushData}
          className="fixed top-16 right-3 z-40 inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-100 sm:top-20 sm:right-6"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Flush Data
        </button>
      )}

      {!isCategoryStep && !isListingDetailsStep && !isTitlePhotosStep && !isBasicDetailsStep && !isReviewStep && (
        <>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 sm:mb-8">
            {isEditMode ? 'Edit Product' : 'Post Your Ad'}
          </h1>

          {/* Progress Bar */}
          <div className="mb-6 sm:mb-8">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="text-sm font-medium text-gray-700">
                Step {toDisplayStep(currentStep)} of {DISPLAY_TOTAL_STEPS}
              </span>
              <span className="text-sm text-gray-500">
                {Math.round((toDisplayStep(currentStep) / DISPLAY_TOTAL_STEPS) * 100)}% Complete
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(toDisplayStep(currentStep) / DISPLAY_TOTAL_STEPS) * 100}%` }}
              />
            </div>
          </div>
        </>
      )}

      {/* Step Content */}
      <form onSubmit={handleSubmit(onSubmit)}>
        {currentStep === 1 && <Step1Auth user={user} onNext={nextStep} />}
        {currentStep === 2 && categoryPhase === 'root' && (
          <Step2Category
            levelOptions={levelOptions}
            selectedPath={selectedPath}
            onCategorySelect={handleRootCategorySelect}
            onBack={handlePostAdBack}
            loadingLevels={loadingLevels || loadingSubcategories}
            register={register}
            errors={errors}
          />
        )}
        {currentStep === 2 && categoryPhase === 'subcategory' && (
          <Step2Subcategory
            rootCategoryName={rootCategoryName}
            subcategories={subcategoryOptions}
            selectedSubcategoryId={selectedSubcategoryId}
            onSubcategorySelect={handleSubcategorySelect}
            onBack={handleCategoryPhaseBack}
            loading={loadingSubcategories}
            register={register}
            errors={errors}
          />
        )}
        {currentStep === 2 && categoryPhase === 'childCategory' && (
          <Step2Subcategory
            rootCategoryName={
              selectedSubcategoryName ? `${rootCategoryName} > ${selectedSubcategoryName}` : rootCategoryName
            }
            subcategories={childCategoryOptions}
            selectedSubcategoryId={selectedChildCategoryId}
            onSubcategorySelect={handleChildCategorySelect}
            onBack={handleCategoryPhaseBack}
            loading={loadingSubcategories}
            register={register}
            errors={errors}
          />
        )}
        {currentStep === 3 && (
          <Step3VideoUpload
            videoFile={videoFile}
            setVideoFile={setVideoFile}
            setValue={setValue}
            getValues={getValues}
            register={register}
            watch={watch}
            errors={errors}
            selectedCategory={selectedCategoryForSteps || selectedCategory}
            subcategories={levelOptions[1] || []}
            categories={flatCategoriesForSteps.length ? flatCategoriesForSteps : categories}
            breadcrumbItems={categoryPathNames}
            onBack={handlePostAdBack}
            onNext={nextStep}
            imageFiles={imageFiles}
            setImageFiles={setImageFiles}
            setAiListingExtraction={setAiListingExtraction}
            setAiListingConfidence={setAiListingConfidence}
            setAiListingMissingFields={setAiListingMissingFields}
            aiListingExtraction={aiListingExtraction}
            aiListingConfidence={aiListingConfidence}
            aiListingMissingFields={aiListingMissingFields}
            aiListingUserOverrides={aiListingUserOverrides}
            setAiListingUserOverrides={setAiListingUserOverrides}
          />
        )}
        {currentStep === 4 && (
          <Step4TitlePhotosReview
            register={register}
            errors={errors}
            imageFiles={imageFiles}
            setImageFiles={setImageFiles}
            videoFile={videoFile}
            breadcrumbItems={categoryPathNames}
            onBack={prevStep}
            onNext={nextStep}
          />
        )}
        {currentStep === 5 && (
          <Step4BasicDetails
            register={register}
            watch={watch}
            setValue={setValue}
            getValues={getValues}
            control={control}
            errors={errors}
            categories={flatCategoriesForSteps.length ? flatCategoriesForSteps : categories}
            selectedCategory={selectedCategoryForSteps || selectedCategory}
            subcategories={levelOptions[1] || []}
            breadcrumbItems={categoryPathNames}
            onBack={prevStep}
            onNext={nextStep}
            initialDynamicFormValues={restoredDynamicFormValuesRef.current}
          />
        )}
        {currentStep === 6 && (
          <Step10Review
            formData={watch()}
            imageFiles={imageFiles}
            videoFile={videoFile}
            categories={flatCategoriesForSteps.length ? flatCategoriesForSteps : categories}
            selectedCategory={selectedCategoryForSteps || selectedCategory}
            subcategories={levelOptions[1] || []}
            categoryPathNames={categoryPathNames}
            register={register}
            errors={errors}
            setValue={setValue}
            watch={watch}
            isSubmitting={isSubmitting}
            isEditMode={isEditMode}
            onBack={prevStep}
          />
        )}

        {currentStep === 1 && (
          <div className="flex justify-stretch sm:justify-end mt-6 sm:mt-8">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn-secondary w-full sm:w-auto"
          >
            Cancel
          </button>
        </div>
        )}
      </form>
    </div>
  )
}

export default PostAdPage
