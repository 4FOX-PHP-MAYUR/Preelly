import { useState, useEffect, useMemo, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { createProduct, updateProduct, fetchProductById, fetchProducts } from '../store/slices/productSlice'
import { fetchCategories } from '../store/slices/categorySlice'
import { selectIsAdmin, refreshUser } from '../store/slices/authSlice'
import { productService, videoService, listingService } from '../services/api'
import toast from 'react-hot-toast'
import { ChevronLeft, ChevronRight, CheckCircle, AlertCircle, Upload, X, Image as ImageIcon, Loader2, Camera } from 'lucide-react'
import { getMediaUrl } from '../utils/helpers'
import { 
  getFieldsForCategory, 
  getBrandOptionsForCategory, 
  getFieldConfig,
  FIELD_TYPES,
  isVehicleSubcategoryBicycle,
  CONDITION_OPTIONS,
  getLevelLabels,
  resolveCategoryKeyForFields,
} from '../utils/categoryFields'
import { categoryService } from '../services/api'

const TOTAL_STEPS = 11

/** All listings use UAE Dirham (Dubai / UAE marketplace). */
const MARKETPLACE_CURRENCY = 'AED'

// Step 1: Authentication Check
function Step1Auth({ user, onNext }) {
  if (!user) {
    return (
      <div className="card text-center py-12">
        <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Authentication Required</h2>
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
      <div className="card text-center py-12">
        <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Verification Required</h2>
        <p className="text-gray-600 mb-6">Your account needs to be verified to post ads</p>
        <p className="text-sm text-gray-500">Please contact support to verify your account</p>
      </div>
    )
  }

  return (
    <div className="card text-center py-12">
      <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        Welcome{isAdmin ? ' Admin' : ''}, {user.name}!
      </h2>
      <p className="text-gray-600 mb-6">You're ready to post your ad</p>
      <button onClick={onNext} className="btn-primary">
        Continue
      </button>
    </div>
  )
}

// Step 2: Cascading Category Selection (hierarchical, dynamic labels)
function Step2Category({
  levelOptions,
  selectedPath,
  levelLabels,
  onLevelChange,
  loadingLevels,
  register,
  setValue,
  errors,
}) {
  const MAX_CATEGORY_LEVEL_INDEX = 1 // Two levels only: category (0) + subcategory (1)
  const visibleLevelOptions = Array.isArray(levelOptions) ? levelOptions.slice(0, MAX_CATEGORY_LEVEL_INDEX + 1) : []

  return (
    <div className="card">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Select Category</h2>
      <div className="space-y-4">
        {visibleLevelOptions.map((options, levelIndex) => {
          const label = levelLabels[levelIndex] ?? `Level ${levelIndex + 1}`
          const value = selectedPath[levelIndex] || ''
          const isFirst = levelIndex === 0
          const optionList = options || []
          return (
            <div key={levelIndex}>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {label} {isFirst ? <span className="text-red-500">*</span> : null}
              </label>
              <select
                value={value}
                onChange={(e) => {
                  const id = e.target.value || ''
                  onLevelChange(levelIndex, id)
                }}
                className="input-field"
                disabled={isFirst && loadingLevels}
              >
                <option value="">
                  {isFirst && loadingLevels ? 'Loading...' : `Select ${label.toLowerCase()}`}
                </option>
                {optionList.map((cat) => (
                  <option key={cat._id} value={cat._id}>
                    {cat.emoji ? `${cat.emoji} ` : ''}{cat.name}
                  </option>
                ))}
              </select>
              {isFirst && errors.category && (
                <p className="mt-1 text-sm text-red-600">{errors.category.message}</p>
              )}
            </div>
          )
        })}
        <p className="mt-2 text-xs text-gray-500">
          ⚠️ Category cannot be changed after posting. Wrong category = rejection.
        </p>
        <input type="hidden" {...register('category', { required: 'Category is required' })} />
        <input type="hidden" {...register('subcategory')} />
        <input type="hidden" {...register('childCategory')} />
      </div>
    </div>
  )
}

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
  watch,
  register,
  selectedCategory,
  subcategories,
  categories,
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
  const [isProcessing, setIsProcessing] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [extractedData, setExtractedData] = useState(null)
  const [screenshots, setScreenshots] = useState([])
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false)
  const videoRef = useRef(null)
  const savedVideoPositionRef = useRef(null)
  const videoPreviewSrc = useVideoPreviewSrc(videoFile)

  // Get current category name to show vehicle-specific prompt
  const selectedCategoryObjForPrompt = categories.find(cat => cat._id === selectedCategory)
  const categoryNameForPrompt = selectedCategoryObjForPrompt?.name || ''

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

        if (!durationValid) return
        
        // Automatically process video for transcription
        await processVideo(file)
      } else {
        toast.error('Please upload a video file (MP4, MOV, AVI, etc.)')
      }
    }
  }

  const processVideo = async (file) => {
    setIsProcessing(true)
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
          childCategoryId: '',
        }
      )
      
      console.log('Video transcription response:', response.data)
      
      const { transcript: videoTranscript, extractedData: data, suggestedFilters, categoryValidation, errors } = response.data
      
      setTranscript(videoTranscript || '')
      setExtractedData(data || null)

      // Car-specific structured extraction (display_data + filter_data + missing_fields + confidence).
      let aiPayload = null
      const isVehicleCategory = /vehicles?|motors?|cars?|auto/i.test(String(categoryName || ''))
      if (isVehicleCategory && videoTranscript && String(videoTranscript).trim()) {
        try {
          toast.loading('Extracting car specs with AI...', { id: 'ai-extract' })
          const aiRes = await listingService.aiExtract({ input_text: String(videoTranscript) })
          aiPayload = aiRes?.data || null

          if (aiPayload) {
            setAiListingExtraction(aiPayload)
            setAiListingConfidence(aiPayload?.confidence || {})
            setAiListingMissingFields(Array.isArray(aiPayload?.missing_fields) ? aiPayload.missing_fields : [])

            // Pre-fill override-only fields.
            setAiListingUserOverrides((prev) => ({
              ...prev,
              engine_cc:
                aiPayload?.filter_data?.engine_cc ?? aiPayload?.display_data?.engine_cc ?? prev.engine_cc,
              horsepower:
                aiPayload?.filter_data?.horsepower ?? aiPayload?.display_data?.horsepower ?? prev.horsepower,
              accident_free:
                aiPayload?.filter_data?.accident_free ?? aiPayload?.display_data?.accident_free ?? prev.accident_free,
            }))
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
        setValue('__suggestedFilters', suggestedFilters.selections, { shouldDirty: false, shouldTouch: false })
        console.log('[PostAd] Suggested filter selections from transcript:', suggestedFilters.selections)

        // Also pre-set filter values directly in the form so they're available at submission
        // even before the filter dropdowns load in Step 4.
        Object.entries(suggestedFilters.selections).forEach(([key, value]) => {
          if (key.startsWith('filter_') && value) {
            setValue(key, value, { shouldDirty: true, shouldTouch: true })
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
        }
        if (errors.extraction) {
          console.error('Extraction error:', errors.extraction)
          toast.error(`Data extraction failed: ${errors.extraction}`, { duration: 5000 })
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
            setValue('condition', mappedCondition)
          }
        }
        
        // Brand / Make mapping:
        // - Always populate generic `brand` (used by many categories + title placeholder).
        // - For vehicles, extracted "brand" usually represents the car make (Toyota, Mercedes, etc.),
        //   so also populate vehicle-specific `make`.
        if (data.brand) {
          const brandVal = String(data.brand).trim()
          const options = getBrandOptionsForCategory(categoryName, subcategoryName) || []

          // Generic brand (for all categories)
          setValue('brand', brandVal)
          if (options.length > 0) {
            if (options.includes(brandVal)) setValue('brandChoice', brandVal)
            else setValue('brandChoice', 'Other')
          } else {
            // Keep brandChoice in sync even when options are empty (prevents UI mismatch later)
            setValue('brandChoice', brandVal)
          }

          // Vehicles: also set `make` when brand is present.
          if (isVehicle) {
            setValue('make', brandVal)
          }
        }
        
        // Color
        if (data.color) {
          setValue('color', data.color)
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

        // Apply AI extractor (takes precedence over heuristic GPT transcript values).
        if (aiPayload) {
          const aiDisplay = aiPayload?.display_data || {}
          const aiFilter = aiPayload?.filter_data || {}

          const getAiField = (k) => (aiDisplay[k] !== undefined ? aiDisplay[k] : aiFilter[k]) ?? null

          const normalizeToOption = (raw, options) => {
            if (raw === null || raw === undefined) return null
            const r = String(raw).trim().toLowerCase()
            if (!r) return null
            const match = options.find((opt) => String(opt).trim().toLowerCase() === r)
            if (match) return match
            // Handle normalized enum values like "semi_automatic"
            const normalized = r.replace(/[\s\-_]+/g, '_')
            const match2 = options.find((opt) => String(opt).trim().toLowerCase().replace(/[\s\-_]+/g, '_') === normalized)
            return match2 || null
          }

          const transmissionOptions = ['Manual', 'Automatic', 'CVT', 'Semi-Automatic']
          const fuelTypeOptions = ['Petrol', 'Diesel', 'Electric', 'Hybrid', 'CNG', 'LPG', 'Other']
          const bodyTypeOptions = ['Sedan', 'SUV', 'Hatchback', 'Coupe', 'Convertible', 'Wagon', 'Pickup']
          const currencyVal = getAiField('currency')

          const brandVal = getAiField('brand')
          if (brandVal) {
            const brandStr = String(brandVal).trim()
            setValue('brand', brandStr)
            if (isVehicle) setValue('make', brandStr)

            const brandOptions = getBrandOptionsForCategory(categoryName, subcategoryName) || []
            if (brandOptions.includes(brandStr)) {
              setValue('brandChoice', brandStr)
            } else {
              setValue('brandChoice', 'Other')
            }
          }

          const modelVal = getAiField('model')
          if (modelVal) setValue('model', String(modelVal).trim())

          const yearVal = getAiField('year')
          if (yearVal !== null && yearVal !== undefined && yearVal !== '') setValue('year', Number(yearVal))

          const priceVal = getAiField('price')
          if (priceVal !== null && priceVal !== undefined && priceVal !== '') setValue('price', Number(priceVal))

          if (currencyVal) setValue('currency', String(currencyVal).trim().toUpperCase())

          const locationCityVal = getAiField('location_city')
          if (locationCityVal) setValue('city', String(locationCityVal).trim())

          const mileageVal = getAiField('mileage_km')
          if (mileageVal !== null && mileageVal !== undefined && mileageVal !== '') setValue('mileage', Number(mileageVal))

          const engineCcVal = getAiField('engine_cc')
          if (engineCcVal !== null && engineCcVal !== undefined && engineCcVal !== '') {
            const n = Number(engineCcVal)
            if (!Number.isNaN(n) && Number.isFinite(n)) {
              setValue('engineSize', `${n}cc`)
              setAiListingUserOverrides((prev) => ({ ...prev, engine_cc: n }))
            } else {
              setValue('engineSize', String(engineCcVal).trim())
              setAiListingUserOverrides((prev) => ({ ...prev, engine_cc: engineCcVal }))
            }
          }

          const txVal = getAiField('transmission')
          const txOpt = normalizeToOption(txVal, transmissionOptions)
          if (txOpt) setValue('transmission', txOpt)

          const fuelVal = getAiField('fuel_type')
          const fuelOpt = normalizeToOption(fuelVal, fuelTypeOptions)
          if (fuelOpt) setValue('fuelType', fuelOpt)

          const bodyVal = getAiField('body_type')
          const bodyOpt = normalizeToOption(bodyVal, bodyTypeOptions)
          if (bodyOpt) setValue('bodyType', bodyOpt)

          const conditionVal = getAiField('condition')
          const conditionOpt = normalizeToOption(conditionVal, CONDITION_OPTIONS)
          if (conditionOpt) setValue('condition', conditionOpt)

          const accidentFreeVal = getAiField('accident_free')
          if (accidentFreeVal !== null && accidentFreeVal !== undefined) {
            setAiListingUserOverrides((prev) => ({ ...prev, accident_free: accidentFreeVal }))
          }

          const horsepowerVal = getAiField('horsepower')
          if (horsepowerVal !== null && horsepowerVal !== undefined && horsepowerVal !== '') {
            const n = Number(horsepowerVal)
            if (!Number.isNaN(n) && Number.isFinite(n)) {
              setAiListingUserOverrides((prev) => ({ ...prev, horsepower: n }))
            }
          }
        }
        
        toast.success('Video processed! Form fields have been auto-filled.', { id: 'transcribe' })
      } else {
        // Apply AI extractor values even if heuristic transcript extraction didn't return `extractedData`.
        if (aiPayload) {
          const aiDisplay = aiPayload?.display_data || {}
          const aiFilter = aiPayload?.filter_data || {}

          const getAiField = (k) => (aiDisplay[k] !== undefined ? aiDisplay[k] : aiFilter[k]) ?? null

          const normalizeToOption = (raw, options) => {
            if (raw === null || raw === undefined) return null
            const r = String(raw).trim().toLowerCase()
            if (!r) return null
            const match = options.find((opt) => String(opt).trim().toLowerCase() === r)
            if (match) return match
            const normalized = r.replace(/[\s\-_]+/g, '_')
            const match2 = options.find(
              (opt) => String(opt).trim().toLowerCase().replace(/[\s\-_]+/g, '_') === normalized
            )
            return match2 || null
          }

          const transmissionOptions = ['Manual', 'Automatic', 'CVT', 'Semi-Automatic']
          const fuelTypeOptions = ['Petrol', 'Diesel', 'Electric', 'Hybrid', 'CNG', 'LPG', 'Other']
          const bodyTypeOptions = ['Sedan', 'SUV', 'Hatchback', 'Coupe', 'Convertible', 'Wagon', 'Pickup']
          const currencyVal = getAiField('currency')

          const brandVal = getAiField('brand')
          if (brandVal) {
            const brandStr = String(brandVal).trim()
            setValue('brand', brandStr)
            if (isVehicleCategory) setValue('make', brandStr)

            const brandOptions = getBrandOptionsForCategory(categoryName, subcategoryName) || []
            if (brandOptions.includes(brandStr)) {
              setValue('brandChoice', brandStr)
            } else {
              setValue('brandChoice', 'Other')
            }
          }

          const modelVal = getAiField('model')
          if (modelVal) setValue('model', String(modelVal).trim())

          const yearVal = getAiField('year')
          if (yearVal !== null && yearVal !== undefined && yearVal !== '') setValue('year', Number(yearVal))

          const priceVal = getAiField('price')
          if (priceVal !== null && priceVal !== undefined && priceVal !== '') setValue('price', Number(priceVal))

          if (currencyVal) setValue('currency', String(currencyVal).trim().toUpperCase())

          const locationCityVal = getAiField('location_city')
          if (locationCityVal) setValue('city', String(locationCityVal).trim())

          const mileageVal = getAiField('mileage_km')
          if (mileageVal !== null && mileageVal !== undefined && mileageVal !== '') setValue('mileage', Number(mileageVal))

          const engineCcVal = getAiField('engine_cc')
          if (engineCcVal !== null && engineCcVal !== undefined && engineCcVal !== '') {
            const n = Number(engineCcVal)
            if (!Number.isNaN(n) && Number.isFinite(n)) {
              setValue('engineSize', `${n}cc`)
              setAiListingUserOverrides((prev) => ({ ...prev, engine_cc: n }))
            } else {
              setValue('engineSize', String(engineCcVal).trim())
              setAiListingUserOverrides((prev) => ({ ...prev, engine_cc: engineCcVal }))
            }
          }

          const txVal = getAiField('transmission')
          const txOpt = normalizeToOption(txVal, transmissionOptions)
          if (txOpt) setValue('transmission', txOpt)

          const fuelVal = getAiField('fuel_type')
          const fuelOpt = normalizeToOption(fuelVal, fuelTypeOptions)
          if (fuelOpt) setValue('fuelType', fuelOpt)

          const bodyVal = getAiField('body_type')
          const bodyOpt = normalizeToOption(bodyVal, bodyTypeOptions)
          if (bodyOpt) setValue('bodyType', bodyOpt)

          const conditionVal = getAiField('condition')
          const conditionOpt = normalizeToOption(conditionVal, CONDITION_OPTIONS)
          if (conditionOpt) setValue('condition', conditionOpt)

          const accidentFreeVal = getAiField('accident_free')
          if (accidentFreeVal !== null && accidentFreeVal !== undefined) {
            setAiListingUserOverrides((prev) => ({ ...prev, accident_free: accidentFreeVal }))
          }

          const horsepowerVal = getAiField('horsepower')
          if (horsepowerVal !== null && horsepowerVal !== undefined && horsepowerVal !== '') {
            const n = Number(horsepowerVal)
            if (!Number.isNaN(n) && Number.isFinite(n)) {
              setAiListingUserOverrides((prev) => ({ ...prev, horsepower: n }))
            }
          }
        }
        toast.success('Video transcribed successfully!', { id: 'transcribe' })
      }
    } catch (error) {
      console.error('Error processing video:', error)
      const errorMessage = error.response?.data?.message || error.message || 'Failed to process video'
      // Transcription is optional; failure should not block posting.
      toast.dismiss('transcribe')
    } finally {
      setIsProcessing(false)
    }
  }

  const removeVideo = () => {
    setVideoFile(null)
    setValue('video', null)
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

      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5002/api'
      const BASE_URL = API_URL.replace('/api', '')
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
    if (!videoFile) {
      toast.error('Please upload a video first')
      return
    }
    // Check if at least one image is uploaded (excluding screenshots)
    const nonScreenshotImages = imageFiles.filter(file => !file.isScreenshot)
    if (nonScreenshotImages.length === 0 && screenshots.length === 0) {
      toast.error('Please upload at least 1 image or capture a screenshot')
      return
    }
    onNext()
  }

  return (
    <div className="card space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Upload Video</h2>

      {/* Description Guide — read-only helper text */}
      <div className="border border-gray-200 rounded-lg bg-gray-50 p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-900">Description Guide</p>
        <ul className="text-sm text-gray-700 list-disc list-inside space-y-1.5">
          <li><strong>What is it?</strong> — name, brand, model, or item type</li>
          <li><strong>Condition</strong> — new, used, refurbished, mention any issues</li>
          <li><strong>Key features</strong> — specs, size, material, highlights</li>
          <li><strong>Usage or history</strong> — age, mileage, ownership details</li>
          <li><strong>What&apos;s included</strong> — accessories, box, warranty, extras</li>
          <li><strong>Price</strong> — asking price and if negotiable</li>
          <li><strong>Location</strong> — pickup or shipping area</li>
          <li><strong>Reason for selling</strong> (optional)</li>
          <li>Anything else buyers should know</li>
        </ul>
      </div>

      {/* Tips for a great video — static tips */}
      <div className="border border-gray-200 rounded-lg bg-gray-50 p-4 space-y-2">
        <p className="text-sm font-semibold text-gray-900">🎥 Tips for a great video:</p>
        <ul className="text-sm text-gray-700 space-y-1.5">
          <li className="flex items-start gap-2"><span className="text-green-600 font-medium">✔</span> Show the item from multiple angles</li>
          <li className="flex items-start gap-2"><span className="text-green-600 font-medium">✔</span> Zoom in on important details</li>
          <li className="flex items-start gap-2"><span className="text-green-600 font-medium">✔</span> Speak clearly and naturally</li>
          <li className="flex items-start gap-2"><span className="text-green-600 font-medium">✔</span> Keep it under 60–90 seconds</li>
        </ul>
      </div>

      {/* Vehicle-specific recording prompt */}
      {categoryNameForPrompt === 'Vehicles' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-yellow-900 flex items-center gap-2">
              <span className="text-lg">🎥</span>
              <span>Record Your Car Video</span>
            </p>
            <p className="mt-1 text-xs text-yellow-800">
              Show the car and clearly talk through the points below. Our system will auto-create your ad from the video.
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-yellow-900 mb-1">Checklist (keep this visible while recording):</p>
            <ul className="text-xs text-yellow-900 list-disc list-inside space-y-1">
              <li>Brand, model &amp; year</li>
              <li>Mileage (show odometer)</li>
              <li>Engine &amp; transmission</li>
              <li>Market spec (GCC / US / EU)</li>
              <li>Damages (or say “no damages”)</li>
              <li>Interior &amp; features</li>
              <li>Boot space &amp; extras</li>
              <li>Price &amp; location</li>
              <li>Any additional information</li>
            </ul>
          </div>
        </div>
      )}

      {!videoFile && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Video <span className="text-red-500">*</span> (Required)
          </label>
            <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <Upload className="w-10 h-10 mb-3 text-gray-400" />
                <p className="mb-2 text-sm text-gray-500">
                <span className="font-semibold">Click to upload video</span> or drag and drop
                </p>
              <p className="text-xs text-gray-500">MP4, MOV, AVI, MKV, WebM (MAX. 20MB)</p>
              </div>
              <input
                type="file"
                className="hidden"
              accept="video/mp4,video/quicktime,video/x-msvideo,video/x-matroska,video/webm,.mp4,.mov,.avi,.mkv,.webm"
                onChange={handleVideoUpload}
              disabled={isProcessing}
              />
            </label>
        </div>
      )}

      {videoFile && (
        <div className="space-y-4">
            <div className="relative">
              <video
              ref={videoRef}
              src={videoPreviewSrc}
              className="w-full h-96 object-contain rounded-lg bg-black"
                controls
              />
                <button
                  type="button"
                  onClick={removeVideo}
              className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

          {/* Manual Screenshot Capture */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
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
                className="btn-primary flex items-center gap-2 px-4 py-2"
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
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {screenshots.map((screenshot) => (
                    <div
                      key={screenshot.id}
                      className="relative aspect-video border-2 border-purple-300 rounded-lg overflow-hidden"
                    >
                      <img
                        src={screenshot.url}
                        alt={`Screenshot at ${Math.floor(screenshot.timestamp)}s`}
                        className="w-full h-full object-cover"
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

          {isProcessing && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                <div>
                  <p className="text-sm font-medium text-blue-900">Processing video...</p>
                  <p className="text-xs text-blue-700">Transcribing and extracting information</p>
                </div>
              </div>
            </div>
          )}

          {transcript && !isProcessing && (
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
              <div className="grid grid-cols-2 gap-2 text-xs">
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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

          <button
            type="button"
            onClick={handleContinue}
            className="w-full btn-primary"
          >
            Continue to Next Step
          </button>
              </div>
      )}
    </div>
  )
}

// Step 4: Basic Details (renamed from Step3)
function Step4BasicDetails({ register, watch, setValue, errors, categories, selectedCategory, subcategories }) {
  const condition = watch('condition')
  const selectedCategoryObj = categories.find(cat => cat._id === selectedCategory)
  const selectedSubcategory = subcategories.find(sub => sub._id === watch('subcategory'))
  
  const categoryName = selectedCategoryObj?.name || ''
  const subcategoryName = selectedSubcategory?.name || ''
  const categoryFieldGroupKey = categoryName ? resolveCategoryKeyForFields(categoryName) : ''
  
  // Get dynamic fields for this category/subcategory
  let dynamicFields = categoryFieldGroupKey ? getFieldsForCategory(categoryFieldGroupKey, subcategoryName) : []
  const isVehicle = /vehicles?|motors?|cars?|auto/i.test(categoryName || '')
  const isBicycle = isVehicle && isVehicleSubcategoryBicycle(subcategoryName)
  if (isVehicle && isBicycle) {
    dynamicFields = dynamicFields.filter((f) => f !== 'transmission' && f !== 'fuelType')
  }
  const brandOptions = categoryFieldGroupKey ? getBrandOptionsForCategory(categoryFieldGroupKey, subcategoryName) : []

  // Vehicles: only require core listing fields here. Extra specs (mileage, trim, VIN, etc.) stay optional
  // so users are not blocked by a long scroll of "required" fields that typical classifieds treat as optional.
  const VEHICLE_STEP4_REQUIRED = new Set(['make', 'model', 'year'])

  const itemFieldRequired = (fieldName) => {
    if (fieldName === 'brand' || fieldName === 'condition') return false
    if (fieldName === 'make') return isVehicle
    if (isVehicle) return VEHICLE_STEP4_REQUIRED.has(fieldName)
    return dynamicFields.includes(fieldName)
  }

  const fieldRequiredMessage = (fieldName) => {
    const cfg = getFieldConfig(fieldName)
    return `${cfg.label || fieldName} is required`
  }

  const categoryFilters = watch('__categoryFilters') || []
  const categoryFiltersLoading = watch('__categoryFiltersLoading') === true
  const categoryFiltersError = watch('__categoryFiltersError') || ''

  const filterGroups = useMemo(() => {
    const list = Array.isArray(categoryFilters) ? categoryFilters : []
    if (!list.length) return []

    const byId = new Map(list.map((f) => [String(f._id), f]))
    const childrenByParent = new Map()
    list.forEach((f) => {
      const pid = f.parentId ? String(f.parentId) : null
      if (!childrenByParent.has(pid)) childrenByParent.set(pid, [])
      childrenByParent.get(pid).push(f)
    })

    const roots = (childrenByParent.get(null) || []).slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

    const getPathLabels = (node) => {
      const labels = []
      let cur = node
      const guard = new Set()
      while (cur) {
        const id = String(cur._id)
        if (guard.has(id)) break
        guard.add(id)
        labels.unshift(cur.name)
        cur = cur.parentId ? byId.get(String(cur.parentId)) : null
      }
      return labels
    }

    const groups = roots.map((root) => {
      const rootId = String(root._id)
      const rootSlug = String(root.slug || rootId)
      const fieldKey = `filter_${rootSlug}`

      // If this "root" filter has explicit options, use them as selectable values.
      const explicitOptions = Array.isArray(root.options) ? root.options.filter(Boolean) : []
      if (explicitOptions.length) {
        return {
          root,
          fieldKey,
          mode: 'explicit',
          options: explicitOptions.map((opt) => ({ value: opt, label: opt })),
        }
      }

      // Cascading mode: first select children of this root, then children of selected node, and so on.
      const firstLevelOptions = (childrenByParent.get(rootId) || [])
        .map((node) => ({ value: String(node._id), label: node.name || '' }))
        .sort((a, b) => a.label.localeCompare(b.label))

      return {
        root,
        fieldKey,
        mode: 'cascade',
        byId,
        childrenByParent,
        options: firstLevelOptions,
        getPathLabels,
      }
    })

    return groups.filter((g) => (g.options?.length || 0) > 0)
  }, [categoryFilters])

  // When Vehicle subcategory switches to Bicycles, clear transmission/fuelType (aligned with vehicle filters)
  useEffect(() => {
    if (isVehicle && isBicycle) {
      setValue('transmission', '')
      setValue('fuelType', '')
    }
  }, [isVehicle, isBicycle, setValue])

  // Render a field based on its configuration (registerOptions e.g. { required } for vehicle make)
  const renderField = (fieldName, registerOptions = {}) => {
    const fieldConfig = getFieldConfig(fieldName)
    const req = itemFieldRequired(fieldName)
    const reqMsg = fieldRequiredMessage(fieldName)
    const merged = { ...registerOptions }
    if (req && merged.required === undefined) {
      merged.required = reqMsg
    }
    
    switch (fieldConfig.type) {
      case FIELD_TYPES.text:
        return (
          <div key={fieldName}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {fieldConfig.label}
              {req && <span className="text-red-500"> *</span>}
            </label>
            <input
              type="text"
              {...register(fieldName, merged)}
              className="input-field"
              placeholder={fieldConfig.placeholder}
            />
            {errors[fieldName] && (
              <p className="mt-1 text-sm text-red-600">{errors[fieldName].message}</p>
            )}
          </div>
        )
      
      case FIELD_TYPES.number:
        return (
          <div key={fieldName}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {fieldConfig.label}
              {req && <span className="text-red-500"> *</span>}
            </label>
            <input
              type="number"
              {...register(fieldName, {
                ...merged,
                min: fieldConfig.min,
                max: fieldConfig.max,
                valueAsNumber: true,
                validate: (v) => {
                  if (!req) return true
                  if (v === '' || v === undefined || v === null || (typeof v === 'number' && Number.isNaN(v))) {
                    return reqMsg
                  }
                  return true
                },
              })}
              className="input-field"
              placeholder={fieldConfig.placeholder}
            />
            {errors[fieldName] && (
              <p className="mt-1 text-sm text-red-600">{errors[fieldName].message}</p>
            )}
          </div>
        )
      
      case FIELD_TYPES.select:
        return (
          <div key={fieldName}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {fieldConfig.label}
              {req && <span className="text-red-500"> *</span>}
            </label>
            <select {...register(fieldName, merged)} className="input-field">
              <option value="">{fieldConfig.placeholder}</option>
              {fieldConfig.options?.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            {errors[fieldName] && (
              <p className="mt-1 text-sm text-red-600">{errors[fieldName].message}</p>
            )}
          </div>
        )
      
      case FIELD_TYPES.textarea:
        return (
          <div key={fieldName}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {fieldConfig.label}
            </label>
            <textarea
              {...register(fieldName)}
              rows={fieldConfig.rows || 4}
              className="input-field"
              placeholder={fieldConfig.placeholder}
            />
          </div>
        )
      
      case FIELD_TYPES.checkbox:
        return (
          <div key={fieldName} className="flex items-center gap-2">
                <input
              type="checkbox"
              {...register(fieldName)}
              className="w-4 h-4"
            />
            <label className="text-sm font-medium text-gray-700">
              {fieldConfig.label}
              </label>
          </div>
        )
      
      case 'dimensions':
        return (
          <div key={fieldName} className="grid grid-cols-4 gap-4">
            <div className="col-span-3 grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Length</label>
                <input
                  type="number"
                  {...register('dimensions.length', { min: 0 })}
                  className="input-field"
                  placeholder="Length"
                />
        </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Width</label>
                <input
                  type="number"
                  {...register('dimensions.width', { min: 0 })}
                  className="input-field"
                  placeholder="Width"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Height</label>
                <input
                  type="number"
                  {...register('dimensions.height', { min: 0 })}
                  className="input-field"
                  placeholder="Height"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Unit</label>
              <select {...register('dimensions.unit')} className="input-field">
                <option value="cm">cm</option>
                <option value="inch">inch</option>
              </select>
            </div>
          </div>
        )
      
      default:
        return (
          <div key={fieldName}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {fieldConfig.label}
            </label>
            <input
              type="text"
              {...register(fieldName)}
              className="input-field"
              placeholder={fieldConfig.placeholder}
            />
          </div>
        )
    }
  }

  return (
    <div className="card space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Item Information</h2>
      
      {!categoryName && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            ⚠️ Please select a category first to see relevant fields.
          </p>
        </div>
      )}

      {/* Brand - Show if brand is in dynamic fields or if brandOptions exist */}
      {(dynamicFields.includes('brand') || brandOptions.length > 0) && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Brand
            {brandOptions.length > 0 && <span className="text-red-500"> *</span>}
          </label>
          <select
            {...(() => {
              const reg = register('brandChoice', {
                validate: (v) => {
                  if (!brandOptions.length) return true
                  if (v && String(v).trim()) return true
                  return 'Please select a brand'
                },
              })
              return {
                ...reg,
                onChange: (e) => {
                  reg.onChange(e)
                  const selected = e.target.value
                  if (selected && selected !== 'Other') {
                    setValue('brand', selected)
                  } else if (selected === 'Other') {
                    setValue('brand', '')
                  } else {
                    setValue('brand', '')
                  }
                },
              }
            })()}
            className="input-field"
          >
            <option value="">Select brand</option>
            {brandOptions.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
            { !brandOptions.includes('Other') && <option value="Other">Other</option> }
          </select>
          {errors.brandChoice && (
            <p className="mt-1 text-sm text-red-600">{errors.brandChoice.message}</p>
          )}
          {watch('brandChoice') !== 'Other' && <input type="hidden" {...register('brand')} />}

          {watch('brandChoice') === 'Other' ? (
            <div className="mt-2">
              {/* When 'Other' is chosen, register a text input bound to canonical 'brand' */}
              <input
                type="text"
                {...register('brand', {
                  required: 'Please enter brand name',
                })}
                className="input-field"
                placeholder="Enter brand name"
              />
              {errors.brand && (
                <p className="mt-1 text-sm text-red-600">{errors.brand.message}</p>
              )}
            </div>
          ) : (
            // If a custom brand value exists while a non-Other selection is used, show it
            watch('brand') &&
            watch('brand') !== '' &&
            !brandOptions.includes(watch('brand')) && (
              <p className="mt-1 text-xs text-gray-500">Custom brand: {watch('brand')}</p>
            )
          )}
        </div>
      )}

      {/* Title - Always shown */}
      <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
          {...register('title', { 
            required: 'Title is required',
            minLength: { value: 10, message: 'Title must be at least 10 characters' }
          })}
            className="input-field"
          placeholder={selectedSubcategory ? `${watch('brand') || 'Brand'} ${selectedSubcategory.name}` : 'Enter product title'}
          />
          {errors.title && (
            <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
          )}
        </div>

      {/* Condition - Always shown */}
      <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
          Condition <span className="text-red-500">*</span>
          </label>
          <select
          {...register('condition', { required: 'Condition is required' })}
            className="input-field"
          >
          <option value="">Select condition</option>
          {CONDITION_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>{opt === 'Brand New' ? `${opt} (Unused)` : opt}</option>
          ))}
          </select>
        {errors.condition && (
          <p className="mt-1 text-sm text-red-600">{errors.condition.message}</p>
          )}
        </div>

      {/* Category Filters (from Admin -> Filters, applied by category/subcategory) */}
      {categoryFiltersLoading ? (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading category filters...
        </div>
      ) : categoryFiltersError ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">{categoryFiltersError}</p>
        </div>
      ) : filterGroups.length ? (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Category Filters</h3>
          {filterGroups.map((g) => (
            <div key={g.fieldKey} className="space-y-3">
              {g.mode === 'explicit' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {g.root.name}
                    {isVehicle && !isBicycle && <span className="text-red-500"> *</span>}
                  </label>
                  <select
                    {...register(
                      g.fieldKey,
                      isVehicle && !isBicycle ? { required: `${g.root.name} is required` } : {}
                    )}
                    className="input-field"
                  >
                    <option value="">Select {g.root.name.toLowerCase()}</option>
                    {g.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {errors[g.fieldKey] && (
                    <p className="mt-1 text-sm text-red-600">{errors[g.fieldKey].message}</p>
                  )}
                </div>
              ) : (
                (() => {
                  const levels = []
                  let currentOptions = g.options || []
                  let parentLabel = g.root.name
                  let levelIndex = 0

                  while (currentOptions.length > 0 && levelIndex < 8) {
                    const levelKey = `${g.fieldKey}_lvl${levelIndex}`
                    const selectedValue = watch(levelKey) || ''

                    levels.push(
                      <div key={levelKey}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {levelIndex === 0 ? g.root.name : parentLabel}
                          {isVehicle && !isBicycle && <span className="text-red-500"> *</span>}
                        </label>
                        <select
                          {...(() => {
                            const lvlReg = register(
                              levelKey,
                              isVehicle && !isBicycle ? { required: `${g.root.name} is required` } : {}
                            )
                            return {
                              ...lvlReg,
                              className: 'input-field',
                              value: selectedValue,
                              onChange: (e) => {
                                lvlReg.onChange(e)
                                const next = e.target.value
                                setValue(levelKey, next, { shouldDirty: true, shouldTouch: true })

                                // Clear deeper levels when parent changes
                                for (let i = levelIndex + 1; i < 8; i += 1) {
                                  setValue(`${g.fieldKey}_lvl${i}`, '', { shouldDirty: true, shouldTouch: true })
                                }

                                // Store the deepest-selected value in the base filter key
                                // so the backend receives filter_<slug> = <selected ObjectId>
                                setValue(g.fieldKey, next || '', { shouldDirty: true, shouldTouch: true })

                                // Also store the human-readable name for DB storage
                                const selectedNode = next ? g.byId.get(String(next)) : null
                                setValue(`${g.fieldKey}_name`, selectedNode?.name || '', { shouldDirty: true, shouldTouch: true })
                              },
                            }
                          })()}
                        >
                          <option value="">Select {(levelIndex === 0 ? g.root.name : parentLabel).toLowerCase()}</option>
                          {currentOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>,
                    )

                    if (!selectedValue) break
                    const selectedNode = g.byId.get(String(selectedValue))
                    parentLabel = selectedNode?.name || `Level ${levelIndex + 2}`
                    const kids = g.childrenByParent.get(String(selectedValue)) || []
                    currentOptions = kids
                      .map((node) => ({ value: String(node._id), label: node.name || '' }))
                      .sort((a, b) => a.label.localeCompare(b.label))
                    levelIndex += 1
                  }

                  return (
                    <>
                      {levels}
                    </>
                  )
                })()
              )}
            </div>
          ))}
        </div>
      ) : null}

      {/* Render dynamic fields */}
      {dynamicFields.map((fieldName) => {
        if (fieldName === 'brand' || fieldName === 'condition') return null
        return renderField(fieldName, {})
      })}

      {condition === 'Brand New' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            ⚠️ Brand New items cannot have visible damage in photos. Please ensure your photos show an unused item.
          </p>
        </div>
      )}
    </div>
  )
}

// Step 5: Usage Details (renamed from Step4)
function Step5Usage({ register, errors }) {
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 20 }, (_, i) => currentYear - i)

  return (
    <div className="card space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Usage Details</h2>
      <p className="text-sm text-gray-600 mb-4">All fields are required. Values may be prefilled from your video; complete anything missing.</p>
      
      <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
          Purchase Year <span className="text-red-500">*</span>
        </label>
        <select
          {...register('purchaseYear', { required: 'Purchase year is required' })}
          className="input-field"
        >
          <option value="">Select year</option>
          {years.map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
        {errors.purchaseYear && (
          <p className="mt-1 text-sm text-red-600">{errors.purchaseYear.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Usage Duration <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            {...register('usageDuration.value', {
              required: 'Usage duration is required',
              min: { value: 0, message: 'Must be 0 or greater' },
            })}
            className="input-field"
            placeholder="e.g., 2"
          />
          {errors.usageDuration?.value && (
            <p className="mt-1 text-sm text-red-600">{errors.usageDuration.value.message}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Unit <span className="text-red-500">*</span>
          </label>
          <select
            {...register('usageDuration.unit', { required: 'Select a unit' })}
            className="input-field"
          >
            <option value="">Select unit</option>
            <option value="months">Months</option>
            <option value="years">Years</option>
          </select>
          {errors.usageDuration?.unit && (
            <p className="mt-1 text-sm text-red-600">{errors.usageDuration.unit.message}</p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Reason for Selling <span className="text-red-500">*</span>
        </label>
        <textarea
          {...register('reasonForSelling', {
            required: 'Reason for selling is required',
            minLength: { value: 5, message: 'Please enter at least 5 characters' },
          })}
          rows={3}
          className="input-field"
          placeholder="e.g., Moving, Upgrading, No longer needed..."
        />
        {errors.reasonForSelling && (
          <p className="mt-1 text-sm text-red-600">{errors.reasonForSelling.message}</p>
        )}
      </div>
    </div>
  )
}

// Step 6: Price Details (renamed from Step5)
function Step6Price({ register, errors, watch, setValue }) {
  const price = watch('price')
  const priceType = watch('priceType') || 'Fixed'

  useEffect(() => {
    setValue('currency', MARKETPLACE_CURRENCY, { shouldDirty: true, shouldValidate: true })
  }, [setValue])

  const currency = MARKETPLACE_CURRENCY
  const selectedCurrency = { code: 'AED', symbol: 'AED', name: 'UAE Dirham' }

  return (
    <div className="card space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Pricing</h2>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Currency <span className="text-red-500">*</span>
            </label>
            <select
          {...register('currency', { required: 'Currency is required' })}
              className="input-field bg-gray-50"
        >
          <option value={MARKETPLACE_CURRENCY}>
            {MARKETPLACE_CURRENCY} — UAE Dirham (Dubai)
          </option>
            </select>
          <p className="mt-1 text-xs text-gray-500">All prices are in UAE Dirham (AED).</p>
          </div>

      <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Price <span className="text-red-500">*</span>
          </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            {...register('price', {
              required: 'Price is required',
              min: { value: 0.01, message: 'Price must be greater than 0' },
            })}
            className="input-field flex-1"
            placeholder="e.g. 80000"
            min={0.01}
            step="0.01"
          />
          <span className="text-gray-500 text-sm shrink-0 font-medium">{selectedCurrency.code}</span>
        </div>
          {errors.price && (
            <p className="mt-1 text-sm text-red-600">{errors.price.message}</p>
          )}
        {price && (price < 1 || price > 1000000) && (
          <p className="mt-1 text-sm text-yellow-600">
            ⚠️ Extreme prices will be flagged for review
          </p>
          )}
        </div>

      <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
          Price Type <span className="text-red-500">*</span>
        </label>
        <select
          {...register('priceType', { required: 'Price type is required' })}
          className="input-field"
        >
          <option value="Fixed">Fixed Price</option>
          <option value="Negotiable">Negotiable</option>
        </select>
        {errors.priceType && (
          <p className="mt-1 text-sm text-red-600">{errors.priceType.message}</p>
        )}
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <p className="text-sm text-slate-700">
          Tip: type digits only for the amount in <strong>AED</strong>. Do not enter words like &quot;Free&quot; or
          &quot;Contact for price&quot;, and do not paste currency symbols into the price box.
        </p>
      </div>
    </div>
  )
}

// Step 7: Location & Delivery (renamed from Step6)
function Step7Location({ register, errors }) {
  return (
    <div className="card space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Location & Delivery</h2>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Country <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
          {...register('country', { required: 'Country is required' })}
            className="input-field"
          placeholder="e.g., United States"
          />
        {errors.country && (
          <p className="mt-1 text-sm text-red-600">{errors.country.message}</p>
          )}
        </div>

      <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
          City <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
          {...register('city', { required: 'City is required' })}
            className="input-field"
          placeholder="e.g., New York"
          />
        {errors.city && (
          <p className="mt-1 text-sm text-red-600">{errors.city.message}</p>
        )}
        </div>

      <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
          Area / Locality <span className="text-red-500">*</span>
          </label>
        <input
          type="text"
          {...register('area', { required: 'Area is required' })}
            className="input-field"
          placeholder="e.g., Manhattan, Brooklyn"
        />
        {errors.area && (
          <p className="mt-1 text-sm text-red-600">{errors.area.message}</p>
          )}
        </div>

      <div className="space-y-4">
        <label className="block text-sm font-medium text-gray-700">
          Delivery Options
        </label>
        
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            {...register('deliveryOptions.buyerPickup')}
            defaultChecked
            className="w-4 h-4"
          />
          <label className="text-sm text-gray-700">Buyer Pickup</label>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            {...register('deliveryOptions.sellerDelivery')}
            className="w-4 h-4"
          />
          <label className="text-sm text-gray-700">Seller Delivery (optional)</label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Delivery Charges (if seller delivery)
          </label>
          <input
            type="number"
            {...register('deliveryOptions.deliveryCharges', { min: 0 })}
            className="input-field"
            placeholder="0.00"
            step="0.01"
          />
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          ⚠️ Accurate location only. Fake locations = rejection.
        </p>
      </div>
    </div>
  )
}

// Step 8: Description (renamed from Step9)
// Step 8: Description (renamed from Step9)
function Step8Description({ register, errors, watch, setValue }) {
  const description = watch('description') || ''
  const title = watch('title') || ''
  const charCount = description.length
  const [isEnhancing, setIsEnhancing] = useState(false)

  return (
    <div className="card space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Description</h2>
      
      <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
          {...register('description', {
            required: 'Description is required',
            minLength: { value: 30, message: 'Description must be at least 30 characters' },
            maxLength: { value: 2500, message: 'Description cannot exceed 2500 characters' },
            validate: (value) => {
              if (value.match(/[A-Z]{10,}/)) {
                return 'Avoid ALL CAPS spam'
              }
              if (value.match(/https?:\/\//)) {
                return 'External links are not allowed'
              }
              return true
            }
          })}
          rows={10}
            className="input-field"
          placeholder="Describe your item in detail. Include condition details, comfort/quality notes, reason for selling, pickup/delivery notes..."
        />
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <button
            type="button"
            className="btn-primary"
            disabled={isEnhancing || !description || description.length < 30}
            onClick={async () => {
              setIsEnhancing(true)
              try {
                const res = await videoService.enhanceDescription({ title, description })
                const nextDescription =
                  res?.data?.enhancedDescription || res?.data?.description || ''
                if (!nextDescription || typeof nextDescription !== 'string') {
                  toast.error('AI enhancement returned an empty description.')
                  return
                }
                setValue('description', nextDescription, { shouldDirty: true, shouldTouch: true })
                toast.success('Description enhanced by AI')
              } catch (e) {
                toast.error(e?.response?.data?.message || 'Failed to enhance description')
              } finally {
                setIsEnhancing(false)
              }
            }}
          >
            {isEnhancing ? 'Enhancing…' : 'AI Enhance'}
          </button>
          <p className="text-xs text-gray-500">
            Keeps it concise, engaging, and conversion-focused.
          </p>
        </div>
        <div className="flex justify-between mt-2">
          <p className="text-sm text-gray-500">
            {charCount < 30 ? `${30 - charCount} more characters needed` : 'Minimum length met'}
          </p>
          <p className={`text-sm ${charCount > 2500 ? 'text-red-600' : 'text-gray-500'}`}>
            {charCount} / 2,500 characters
          </p>
        </div>
          {errors.description && (
            <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
          )}
        </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <p className="text-sm font-medium text-green-900 mb-2">Allowed:</p>
        <ul className="text-sm text-green-800 space-y-1 list-disc list-inside">
          <li>Condition details</li>
          <li>Comfort / quality notes</li>
          <li>Reason for selling</li>
          <li>Pickup/delivery notes</li>
        </ul>
      </div>

      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-sm font-medium text-red-900 mb-2">Not Allowed:</p>
        <ul className="text-sm text-red-800 space-y-1 list-disc list-inside">
          <li>Phone numbers / emails</li>
          <li>External links</li>
          <li>ALL CAPS spam</li>
        </ul>
      </div>
    </div>
  )
}

// Step 10: Contact Details (renamed from Step9)
function Step9Contact({ register, errors, user }) {
  return (
    <div className="card space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Contact Preferences</h2>
      
      <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
          Contact Name <span className="text-red-500">*</span>
            </label>
        <input
          type="text"
          {...register('contactName', { required: 'Contact name is required' })}
              className="input-field"
          defaultValue={user?.name || ''}
          placeholder="Your name"
        />
        {errors.contactName && (
          <p className="mt-1 text-sm text-red-600">{errors.contactName.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Verified Phone Number <span className="text-red-500">*</span>
        </label>
        <input
          type="tel"
          {...register('contactPhone', { 
            required: 'Phone number is required',
            pattern: {
              value: /^[\d\s\-\+\(\)]+$/,
              message: 'Invalid phone number format'
            }
          })}
          className="input-field"
          defaultValue={user?.phone || ''}
          placeholder="+1234567890"
        />
        {errors.contactPhone && (
          <p className="mt-1 text-sm text-red-600">{errors.contactPhone.message}</p>
        )}
        {user?.phone && (
          <p className="mt-1 text-xs text-gray-500">
            Using verified phone: {user.phone}
          </p>
        )}
          </div>

      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          Contact Options <span className="text-red-500">*</span>
        </label>
        
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            {...register('contactOptions.inAppChat')}
            defaultChecked
            className="w-4 h-4"
          />
          <label className="text-sm text-gray-700">In-app chat</label>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            {...register('contactOptions.call')}
            defaultChecked
            className="w-4 h-4"
          />
          <label className="text-sm text-gray-700">Call</label>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            {...register('contactOptions.whatsapp')}
            className="w-4 h-4"
          />
          <label className="text-sm text-gray-700">WhatsApp (optional)</label>
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          ⚠️ Only verified numbers allowed. No contact info inside description.
        </p>
      </div>
    </div>
  )
}

// Step 11: Review & Confirm (renamed from Step10)
function Step10Review({ formData, imageFiles, videoFile, categories, selectedCategory, subcategories, categoryPathNames, register, errors }) {
  const category = categories.find(cat => cat._id === selectedCategory)
  const subcategory = subcategories.find(sub => sub._id === formData.subcategory)

  return (
    <div className="card space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Review Your Listing</h2>
      
      <div className="space-y-4">
        <div className="border-b pb-4">
          <h3 className="font-semibold text-gray-900 mb-2">Category</h3>
          {categoryPathNames?.length > 0 ? (
            <p className="text-gray-700">{categoryPathNames.join(' → ')}</p>
          ) : (
            <>
              <p className="text-gray-700">{category?.emoji} {category?.name}</p>
              {subcategory && <p className="text-sm text-gray-600">{subcategory.name}</p>}
            </>
          )}
        </div>

        <div className="border-b pb-4">
          <h3 className="font-semibold text-gray-900 mb-2">Basic Details</h3>
          <div className="space-y-1 text-sm text-gray-700">
            <p><strong>Title:</strong> {formData.title}</p>
            <p><strong>Brand:</strong> {formData.brand || 'Not specified'}</p>
            <p><strong>Condition:</strong> {formData.condition}</p>
            {formData.material && <p><strong>Material:</strong> {formData.material}</p>}
            {formData.color && <p><strong>Color:</strong> {formData.color}</p>}
          </div>
        </div>

        <div className="border-b pb-4">
          <h3 className="font-semibold text-gray-900 mb-2">Price</h3>
          <p className="text-gray-700">
            {formData.currency || MARKETPLACE_CURRENCY} {formData.price} ({formData.priceType || 'Fixed'})
          </p>
        </div>

        <div className="border-b pb-4">
          <h3 className="font-semibold text-gray-900 mb-2">Ad Category</h3>
          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="radio" value="free" {...register('adType', { required: 'Please select an ad type' })} defaultChecked={formData.adType === 'free'} className="mt-1" />
              <span>
                <span className="font-medium text-gray-900">Free</span>
                <span className="block text-xs text-gray-600">Standard visibility, pending moderation</span>
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="radio" value="basic" {...register('adType', { required: 'Please select an ad type' })} defaultChecked={formData.adType === 'basic'} className="mt-1" />
              <span>
                <span className="font-medium text-gray-900">Basic</span>
                <span className="block text-xs text-gray-600">Boosted visibility, pending moderation</span>
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="radio" value="premium" {...register('adType', { required: 'Please select an ad type' })} defaultChecked={formData.adType === 'premium'} className="mt-1" />
              <span>
                <span className="font-medium text-gray-900">Premium</span>
                <span className="block text-xs text-gray-600">Top placement, pending moderation</span>
              </span>
            </label>
          </div>
          {errors.adType && (
            <p className="mt-2 text-sm text-red-600">{errors.adType.message}</p>
          )}
        </div>

        <div className="border-b pb-4">
          <h3 className="font-semibold text-gray-900 mb-2">Location</h3>
          <p className="text-gray-700">{formData.area}, {formData.city}, {formData.country}</p>
        </div>

        <div className="border-b pb-4">
          <h3 className="font-semibold text-gray-900 mb-2">Media</h3>
          {videoFile ? (
            <p className="text-gray-700">✓ 1 video uploaded</p>
          ) : (
            <p className="text-gray-700 text-red-600">⚠️ No video uploaded</p>
          )}
          {imageFiles.length > 0 ? (
            <p className="text-gray-700">✓ {imageFiles.length} image(s) uploaded</p>
          ) : (
            <p className="text-gray-700 text-red-600">⚠️ No images uploaded</p>
          )}
        </div>

        <div className="border-b pb-4">
          <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
          <p className="text-gray-700 text-sm">{formData.description?.substring(0, 200)}...</p>
        </div>

        <div className="border-b pb-4">
          <h3 className="font-semibold text-gray-900 mb-2">Contact</h3>
          <p className="text-gray-700">{formData.contactName}</p>
          <p className="text-gray-700 text-sm">{formData.contactPhone}</p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <input 
            type="checkbox" 
            id="acceptRules" 
            {...register('acceptRules', { required: 'You must accept the posting rules' })}
            className="mt-1" 
          />
          <label htmlFor="acceptRules" className="text-sm text-blue-900">
            I accept the posting rules and confirm that all information is accurate. I understand that wrong category, fake locations, stock images, or misleading information will result in rejection.
          </label>
        </div>
        {errors.acceptRules && (
          <p className="mt-2 text-sm text-red-600">{errors.acceptRules.message}</p>
        )}
      </div>
    </div>
  )
}

// Main Component
function PostAdPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editProductId = searchParams.get('edit')
  const isEditMode = !!editProductId
  
  const { categories } = useSelector((state) => state.categories)
  const { loading } = useSelector((state) => state.products)
  const { user } = useSelector((state) => state.auth)
  
  const { register, handleSubmit, watch, setValue, getValues, trigger, formState: { errors } } = useForm({
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
      brandChoice: '',
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
  
  const [currentStep, setCurrentStep] = useState(1)
  const [initialStepResolved, setInitialStepResolved] = useState(false)
  const [imageFiles, setImageFiles] = useState([])
  const [videoFile, setVideoFile] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState('')
  const [subcategories, setSubcategories] = useState([])
  const [levelOptions, setLevelOptions] = useState([[]])
  const [selectedPath, setSelectedPath] = useState([])
  const [levelLabelsFromApi, setLevelLabelsFromApi] = useState(null)
  const [loadingLevels, setLoadingLevels] = useState(false)
  const [categoryFilters, setCategoryFilters] = useState([])
  const [loadingCategoryFilters, setLoadingCategoryFilters] = useState(false)
  const [categoryFiltersError, setCategoryFiltersError] = useState('')
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

  // Use refs to prevent multiple API calls
  const categoriesFetchedRef = useRef(false)
  const userRefreshedRef = useRef(false)
  const initialStepFetchedRef = useRef(false)
  const prevFilterScopeRef = useRef('')
  const prevFilterFieldKeysRef = useRef([])

  // Resolve initial step: first-time user → Step 1 (Welcome); returning user (has ≥1 product) → Step 2 (Category). Run before rendering flow.
  useEffect(() => {
    if (initialStepFetchedRef.current) return
    if (!user) {
      setInitialStepResolved(true)
      return
    }
    initialStepFetchedRef.current = true
    if (isEditMode) {
      initialStepFetchedRef.current = true
      setCurrentStep(2)
      setInitialStepResolved(true)
      return
    }
    setInitialStepResolved(false)
    productService
      .getProducts({ userId: user._id, limit: 1 })
      .then((res) => {
        const total = res?.data?.total ?? (Array.isArray(res?.data?.products) ? res.data.products.length : 0)
        if (total > 0) setCurrentStep(2)
        setInitialStepResolved(true)
      })
      .catch(() => setInitialStepResolved(true))
  }, [user, isEditMode])

  // Fetch categories only once (for any legacy use)
  useEffect(() => {
    if (!categoriesFetchedRef.current && categories.length === 0) {
      categoriesFetchedRef.current = true
      dispatch(fetchCategories())
    }
  }, [dispatch, categories.length])

  // Fetch root categories for cascading dropdowns
  useEffect(() => {
    let cancelled = false
    setLoadingLevels(true)
    categoryService
      .getCategoryChildren(null)
      .then((res) => {
        if (!cancelled) setLevelOptions([Array.isArray(res.data) ? res.data : []])
      })
      .catch(() => {
        if (!cancelled) setLevelOptions([[]])
      })
      .finally(() => {
        if (!cancelled) setLoadingLevels(false)
      })
    return () => { cancelled = true }
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

  // Fetch category filters for the currently selected category level (deepest selected node wins).
  useEffect(() => {
    const rootId = selectedPath[0] || ''
    const subId = selectedPath[1] || ''
    const childId = selectedPath.length > 2 ? selectedPath[selectedPath.length - 1] : ''

    // Clear when nothing selected
    if (!rootId) {
      setCategoryFilters([])
      setCategoryFiltersError('')
      setLoadingCategoryFilters(false)
      setValue('__categoryFilterFieldKeys', [], { shouldDirty: false, shouldTouch: false })
      return
    }

    const scopeKey = selectedPath.filter(Boolean).join('>')
    if (!scopeKey) return

    // If the scope changed, clear previously set filter fields
    if (prevFilterScopeRef.current && prevFilterScopeRef.current !== scopeKey) {
      prevFilterFieldKeysRef.current.forEach((k) => setValue(k, ''))
    }
    prevFilterScopeRef.current = scopeKey

    let cancelled = false
    setLoadingCategoryFilters(true)
    setCategoryFiltersError('')

    const levels = {
      categoryId: rootId,
      ...(subId ? { subcategoryId: subId } : {}),
      ...(childId ? { childCategoryId: childId } : {}),
    }

    categoryService
      .getCategoryFilters(levels)
      .then((res) => {
        if (cancelled) return
        const list = Array.isArray(res?.data?.filters) ? res.data.filters : []
        setCategoryFilters(list)
        setCategoryFiltersError('')

        // Track the field keys we need to clear on next scope change
        const rootFilters = list.filter((f) => !f.parentId)
        const fieldKeys = []
        for (const root of rootFilters) {
          const slug = String(root.slug || root._id)
          const base = `filter_${slug}`
          const explicitOpts = Array.isArray(root.options) ? root.options.filter(Boolean) : []
          if (explicitOpts.length) {
            fieldKeys.push(base)
          } else {
            for (let i = 0; i < 8; i += 1) fieldKeys.push(`${base}_lvl${i}`)
            fieldKeys.push(base)
          }
        }
        prevFilterFieldKeysRef.current = fieldKeys

        // Expose to Step4 via RHF watch (simple wiring without prop drilling too much)
        setValue('__categoryFilters', list, { shouldDirty: false, shouldTouch: false })
        setValue('__categoryFilterFieldKeys', fieldKeys, { shouldDirty: false, shouldTouch: false })
        setValue('__categoryFiltersLoading', false, { shouldDirty: false, shouldTouch: false })
        setValue('__categoryFiltersError', '', { shouldDirty: false, shouldTouch: false })

        // Auto-fill filter dropdowns from transcript-suggested filter values.
        // Suggested filters come from the transcribe API (stored in __suggestedFilters).
        // If no transcript suggestions, try matching current form data against filter names.
        const suggested = getValues('__suggestedFilters')
        if (suggested && typeof suggested === 'object' && list.length) {
          const byId = new Map(list.map((f) => [String(f._id), f]))
          const childrenByParent = new Map()
          list.forEach((f) => {
            const pid = f.parentId ? String(f.parentId) : null
            if (!childrenByParent.has(pid)) childrenByParent.set(pid, [])
            childrenByParent.get(pid).push(f)
          })

          for (const [fieldKey, value] of Object.entries(suggested)) {
            if (!fieldKey.startsWith('filter_')) continue
            const currentVal = getValues(fieldKey)
            if (currentVal) continue

            const rootSlug = fieldKey.replace('filter_', '')
            const matchingRoot = rootFilters.find(
              (r) => String(r.slug || r._id) === rootSlug
            )
            if (!matchingRoot) continue

            const explicitOpts = Array.isArray(matchingRoot.options) ? matchingRoot.options.filter(Boolean) : []
            if (explicitOpts.length) {
              if (explicitOpts.includes(value)) {
                setValue(fieldKey, value)
                console.log(`Auto-filled ${fieldKey} = "${value}" (from transcript)`)
              }
            } else {
              const children = childrenByParent.get(String(matchingRoot._id)) || []
              const childMatch = children.find((c) => String(c._id) === value)
              if (childMatch) {
                setValue(fieldKey, value)
                console.log(`Auto-filled ${fieldKey} = "${childMatch.name}" (id: ${value}, from transcript)`)
              }
            }
          }
        } else if (list.length) {
          // Fallback: try to match current form field values against filter names.
          // This covers cases where transcript didn't return suggestedFilters
          // (e.g. category IDs weren't available at transcription time).
          const formValues = getValues()
          const byId = new Map(list.map((f) => [String(f._id), f]))
          const childrenByParent = new Map()
          list.forEach((f) => {
            const pid = f.parentId ? String(f.parentId) : null
            if (!childrenByParent.has(pid)) childrenByParent.set(pid, [])
            childrenByParent.get(pid).push(f)
          })

          const normalizeStr = (s) => String(s || '').trim().toLowerCase()

          const fieldKeyMap = {
            condition: ['condition'],
            brand: ['brand', 'make'],
            make: ['make', 'brand'],
            color: ['color'],
            colour: ['color'],
            transmission: ['transmission'],
            'fuel type': ['fuelType'],
            fueltype: ['fuelType'],
            material: ['material'],
            'body type': ['bodyType'],
            size: ['size'],
            model: ['model'],
          }

          for (const root of rootFilters) {
            const rootId = String(root._id)
            const rootSlug = String(root.slug || rootId)
            const fieldKey = `filter_${rootSlug}`
            const currentVal = getValues(fieldKey)
            if (currentVal) continue

            const explicitOpts = Array.isArray(root.options) ? root.options.filter(Boolean) : []
            const children = childrenByParent.get(rootId) || []
            const normalizedRootName = normalizeStr(root.name)

            const productFieldKeys = fieldKeyMap[normalizedRootName] || []
            const titleText = normalizeStr(formValues.title || '')

            if (explicitOpts.length) {
              let matched = null
              for (const fk of productFieldKeys) {
                const fv = normalizeStr(formValues[fk])
                if (!fv) continue
                const opt = explicitOpts.find((o) => normalizeStr(o) === fv)
                if (opt) { matched = opt; break }
              }
              if (!matched) {
                for (const opt of explicitOpts) {
                  const normOpt = normalizeStr(opt)
                  if (normOpt.length >= 3 && titleText.includes(normOpt)) {
                    matched = opt
                    break
                  }
                }
              }
              if (matched) {
                setValue(fieldKey, matched)
                console.log(`Auto-filled ${fieldKey} = "${matched}" (from form data fallback)`)
              }
            } else if (children.length) {
              let matched = null
              for (const fk of productFieldKeys) {
                const fv = normalizeStr(formValues[fk])
                if (!fv) continue
                const child = children.find((c) => normalizeStr(c.name) === fv)
                if (child) { matched = child; break }
              }
              if (!matched) {
                for (const child of children) {
                  const normName = normalizeStr(child.name)
                  if (normName.length >= 3 && titleText.includes(normName)) {
                    matched = child
                    break
                  }
                }
              }
              if (matched) {
                setValue(fieldKey, String(matched._id))
                console.log(`Auto-filled ${fieldKey} = "${matched.name}" (from form data fallback)`)
              }
            }
          }
        }
      })
      .catch((err) => {
        if (cancelled) return
        setCategoryFilters([])
        const msg = err?.response?.data?.message || 'Failed to load category filters'
        setCategoryFiltersError(msg)
        setValue('__categoryFilters', [], { shouldDirty: false, shouldTouch: false })
        setValue('__categoryFilterFieldKeys', [], { shouldDirty: false, shouldTouch: false })
        setValue('__categoryFiltersLoading', false, { shouldDirty: false, shouldTouch: false })
        setValue('__categoryFiltersError', msg, { shouldDirty: false, shouldTouch: false })
      })
      .finally(() => {
        if (cancelled) return
        setLoadingCategoryFilters(false)
        setValue('__categoryFiltersLoading', false, { shouldDirty: false, shouldTouch: false })
      })

    // Set loading for Step4 immediately
    setValue('__categoryFiltersLoading', true, { shouldDirty: false, shouldTouch: false })
    return () => {
      cancelled = true
    }
  }, [selectedPath, setValue])

  // Refresh user data only once when user is available
  useEffect(() => {
    if (user?._id && !userRefreshedRef.current) {
      userRefreshedRef.current = true
      // Only refresh if verification status is missing from current user data
      // This prevents unnecessary API calls if user data is already complete
      if (user.isVerified === undefined) {
        dispatch(refreshUser()).catch(() => {
          // If refresh fails, reset ref so it can try again later
          userRefreshedRef.current = false
        })
      }
    }
  }, [user?._id, user?.isVerified, dispatch]) // Depend on user ID and verification status

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
        
        // Populate form
        const formValues = {
          title: product.title || '',
          description: product.description || '',
          price: product.price || 0,
          currency: product.currency || MARKETPLACE_CURRENCY,
          category: product.category?._id || product.category || '',
          subcategory: '',
          childCategory: product.subcategory?._id || product.subcategory || '',
          country: product.country || '',
          city: product.city || '',
          area: product.area || product.location || '',
          brand: product.brand || '',
          condition: product.condition || '',
          material: product.material || '',
          color: product.color || '',
          priceType: product.priceType || 'Fixed',
          contactName: product.contactName || user?.name || '',
          contactPhone: product.contactPhone || user?.phone || '',
          make: product.make || '',
          model: product.model || '',
          year: product.year ?? '',
          mileage: product.mileage ?? '',
          transmission: product.transmission || '',
          fuelType: product.fuelType || '',
          ...product.dimensions && { dimensions: product.dimensions },
          ...product.usageDuration && { usageDuration: product.usageDuration },
          ...product.deliveryOptions && { deliveryOptions: product.deliveryOptions },
          ...product.contactOptions && { contactOptions: product.contactOptions },
        }
        
        Object.keys(formValues).forEach(key => {
          setValue(key, formValues[key])
        })

        // Restore persisted dynamic fields (including category filter selections) from additionalFields
        const extras = product?.additionalFields
        if (extras && typeof extras === 'object') {
          Object.keys(extras).forEach((k) => {
            if (extras[k] !== undefined && extras[k] !== null) {
              setValue(k, extras[k])
            }
          })
        }

        if (product.category) {
          const categoryId = product.category._id || product.category
          setSelectedCategory(categoryId)
          try {
            const pathRes = await categoryService.getCategoryPath(categoryId)
            const pathCategories = pathRes.data?.categories || []
            if (pathCategories.length > 0) {
              const MAX_CATEGORY_LEVEL_INDEX = 1
              const maxPathLen = MAX_CATEGORY_LEVEL_INDEX + 1
              const truncatedPathCategories = pathCategories.slice(0, maxPathLen)

              setSelectedPath(truncatedPathCategories.map((c) => c._id))
              const level1SubcategoryId = truncatedPathCategories[1]?._id || ''
              const deepestId = truncatedPathCategories[truncatedPathCategories.length - 1]?._id || ''
              setValue('subcategory', level1SubcategoryId)
              setValue('childCategory', '')
              const rootsRes = await categoryService.getCategoryChildren(null)
              const roots = Array.isArray(rootsRes.data) ? rootsRes.data : []
              const opts = [roots]
              for (let i = 0; i < truncatedPathCategories.length - 1; i++) {
                const childRes = await categoryService.getCategoryChildren(truncatedPathCategories[i]._id)
                opts.push(Array.isArray(childRes.data) ? childRes.data : [])
              }
              setLevelOptions(opts)
            } else {
              const category = categories.find((cat) => cat._id === categoryId)
              if (category) setSubcategories(category.subcategories || [])
            }
          } catch {
            const category = categories.find((cat) => cat._id === categoryId)
            if (category) setSubcategories(category.subcategories || [])
          }
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
            const options = getBrandOptionsForCategory(category.name, prodSubName)
            if (options && options.includes(product.brand)) {
              setValue('brandChoice', product.brand)
            } else {
              setValue('brandChoice', 'Other')
              setValue('brand', product.brand)
            }
          } else {
            // fallback: set brand directly
            setValue('brand', product.brand)
            setValue('brandChoice', product.brand)
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
    const MAX_CATEGORY_LEVEL_INDEX = 1 // selection capped at index 1 => 2 levels total
    const maxPathLen = MAX_CATEGORY_LEVEL_INDEX + 1

    const newPathRaw = categoryId
      ? [...selectedPath.slice(0, levelIndex), categoryId]
      : selectedPath.slice(0, levelIndex)
    const newPath = newPathRaw.slice(0, maxPathLen)

    setSelectedPath(newPath)
    // Map hierarchy to backend model:
    // - `category` is the root (level 0)
    // - `subcategory` is the level 1 selection (e.g. Vehicles -> Cars)
    // - `childCategory` is not used in this two-level flow
    const rootId = newPath[0] || ''
    const subcategoryId = newPath[1] || ''
    const childCategoryId = ''
    setValue('category', rootId)
    setValue('subcategory', subcategoryId)
    setValue('childCategory', childCategoryId)
    setValue('categoryPath', newPath.filter(Boolean))

    if (!categoryId) {
      setLevelOptions((prev) => prev.slice(0, Math.min(levelIndex + 1, maxPathLen)))
      return
    }

    // If user picked the last allowed level, do not fetch deeper options.
    if (levelIndex >= MAX_CATEGORY_LEVEL_INDEX) {
      setLevelOptions((prev) => prev.slice(0, maxPathLen))
      return
    }

    setLoadingLevels(true)
    try {
      const res = await categoryService.getCategoryChildren(categoryId)
      const children = Array.isArray(res.data) ? res.data : []
      // Prevent extending beyond max allowed hierarchy depth.
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

  const handleCategoryChange = (categoryId) => {
    setSelectedCategory(categoryId)
    const category = categories.find((cat) => cat._id === categoryId)
    setSubcategories(category?.subcategories || [])
    setValue('category', categoryId)
    setValue('subcategory', '')
  }

  const handleSubcategoryChange = (subcategoryId) => {
    setValue('subcategory', subcategoryId)
  }

  const rootCategoryName = levelOptions[0]?.find((c) => c._id === selectedPath[0])?.name || ''
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

    case 2:
      return !!watch('category')

    case 3: {
      if (!videoFile) return false

      const nonScreenshotImages = imageFiles.filter(f => !f.isScreenshot)
      const screenshotImages = imageFiles.filter(f => f.isScreenshot)

      return nonScreenshotImages.length > 0 || screenshotImages.length > 0
    }

    case 4: {
      const cat = categories.find((c) => c._id === watch('category'))
      const isVehicle = cat && /vehicles?|motors?|cars?|auto/i.test(String(cat.name || ''))
      const base = !!watch('title') && watch('title').length >= 10 && !!watch('condition')
      if (isVehicle) return base && !!watch('make')?.trim()
      return base
    }

    case 5: {
      const py = watch('purchaseYear')
      const uv = watch('usageDuration.value')
      const uu = watch('usageDuration.unit')
      const rs = (watch('reasonForSelling') || '').trim()
      return (
        py !== undefined &&
        py !== null &&
        py !== '' &&
        uv !== undefined &&
        uv !== null &&
        uv !== '' &&
        !Number.isNaN(Number(uv)) &&
        !!uu &&
        rs.length >= 5
      )
    }

    case 6:
      return !!watch('price') && Number(watch('price')) > 0 && !!watch('priceType')

    case 7:
      return !!watch('country') && !!watch('city') && !!watch('area')

    case 8: {
      const desc = watch('description') || ''
      return desc.length >= 30 && desc.length <= 2500
    }

    case 9:
      return !!watch('contactName') && !!watch('contactPhone')

    case 10:
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
      case 2: return ['category']
      case 3: return [] // Video upload - no form fields
      case 4: {
        const cat = (flatCategoriesForSteps.length ? flatCategoriesForSteps : categories).find((c) => c._id === watch('category'))
        if (!cat) return ['title', 'condition']
        const categoryName = cat.name || ''
        const resolvedKey = resolveCategoryKeyForFields(categoryName)
        const sub = levelOptions[1]?.find((s) => s._id === watch('subcategory'))
        const subName = sub?.name || ''
        const isVehicleCat = /vehicles?|motors?|cars?|auto/i.test(String(categoryName || ''))
        const isBicycle = isVehicleCat && isVehicleSubcategoryBicycle(subName)
        let dyn = getFieldsForCategory(resolvedKey, subName)
        if (isVehicleCat && isBicycle) {
          dyn = dyn.filter((f) => f !== 'transmission' && f !== 'fuelType')
        }
        const filterKeys = watch('__categoryFilterFieldKeys') || []
        const brands = getBrandOptionsForCategory(resolvedKey, subName)
        const fields = ['title', 'condition', ...dyn, ...filterKeys]
        if (isVehicleCat) fields.push('make')
        if (brands.length) {
          fields.push('brandChoice')
          if (String(watch('brandChoice') || '') === 'Other') fields.push('brand')
        }
        return [...new Set(fields)]
      }
      case 5:
        return ['purchaseYear', 'usageDuration.value', 'usageDuration.unit', 'reasonForSelling']
      case 6: return ['price', 'priceType']
      case 7: return ['country', 'city', 'area']
      case 8: return ['description']
      case 9: return ['contactName', 'contactPhone']
      case 10: return ['acceptRules']
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
      case 5:
        if (field === 'price') return value && !isNaN(value) && Number(value) > 0
        if (field === 'priceType') return !!value
        return true
      case 6:
        return !!value
      case 8:
        if (field === 'description') return value && value.length >= 30 && value.length <= 2500
        return true
      case 9:
        return !!value
      case 10:
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
      return 'Please complete all required fields'

    case 3:
      if (!videoFile) return 'Please upload a video'

      const nonScreenshotImages = imageFiles.filter(f => !f.isScreenshot)
      const screenshotImages = imageFiles.filter(f => f.isScreenshot)

      if (nonScreenshotImages.length === 0 && screenshotImages.length === 0) {
        return 'Please upload at least 1 image or capture a screenshot'
      }

      return 'Please complete all required fields'

    case 4:
      if (!watch('title')) return 'Please enter a title'
      if (watch('title').length < 10) return 'Title must be at least 10 characters'
      if (!watch('condition')) return 'Please select a condition'
      {
        const cat = (flatCategoriesForSteps.length ? flatCategoriesForSteps : categories).find((c) => c._id === watch('category'))
        const isVehicle = cat && /vehicles?|motors?|cars?|auto/i.test(String(cat.name || ''))
        if (isVehicle && !watch('make')?.trim()) return 'Please enter make (e.g. Toyota, Mercedes)'
        return 'Please complete all required fields'
      }

    case 5:
      if (!watch('purchaseYear')) return 'Please select purchase year'
      if (watch('usageDuration.value') === '' || watch('usageDuration.value') == null) return 'Please enter usage duration'
      if (!watch('usageDuration.unit')) return 'Please select usage unit'
      if (!(watch('reasonForSelling') || '').trim() || (watch('reasonForSelling') || '').trim().length < 5) {
        return 'Please enter reason for selling (at least 5 characters)'
      }
      return 'Please complete all required fields'

    case 6:
      if (!watch('price')) return 'Please enter a price'
      if (Number(watch('price')) <= 0) return 'Price must be greater than 0'
      if (!watch('priceType')) return 'Please select price type'
      return 'Please complete all required fields'

    case 7:
      if (!watch('country')) return 'Please enter your country'
      if (!watch('city')) return 'Please enter your city'
      if (!watch('area')) return 'Please enter your area'
      return 'Please complete all required fields'

    case 8: {
      const desc = watch('description') || ''
      if (!desc) return 'Please enter a description'
      if (desc.length < 30) return 'Description must be at least 30 characters'
      if (desc.length > 2500) return 'Description must not exceed 2500 characters'
      return 'Please complete all required fields'
    }

    case 9:
      if (!watch('contactName')) return 'Please enter contact name'
      if (!watch('contactPhone')) return 'Please enter phone number'
      return 'Please complete all required fields'

    case 10:
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
        setCurrentStep(8)
        setIsSubmitting(false)
        return
      }

      // Combine location fields
      const location = data.location || (data.area && data.city && data.country ? `${data.area}, ${data.city}, ${data.country}` : '')

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
        const userCondition = data.condition || baseDisplay.condition || null
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
          transmission: userTransmission,
          fuel_type: userFuelType,
          body_type: userBodyType,
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

        aiMergedCarListing = {
          display_data,
          filter_data,
          specifications: {
            ...baseSpecs,
            engine_cc: filter_data.engine_cc,
            horsepower: filter_data.horsepower,
            accident_free: filter_data.accident_free,
          },
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
      
      const newVideo = videoFile && !videoFile.isExisting && videoFile instanceof File ? videoFile : null
      const existingVideoUrl = videoFile?.isExisting ? (videoFile.originalUrl || videoFile.url) : null
      
      // Build the full category hierarchy path (IDs + names)
      const pathIds = selectedPath.filter(Boolean)
      const pathNames = selectedPath
        .map((id, i) => levelOptions[i]?.find((c) => String(c._id) === String(id))?.name)
        .filter(Boolean)

      // Prepare form data with proper structure
      const formData = {
        title: data.title,
        description: data.description,
        price: data.price,
        currency: MARKETPLACE_CURRENCY,
        category: data.category,
        // Two-level category flow: category + subcategory only.
        subcategory: data.subcategory || null,
        childCategory: null,
        categoryPath: JSON.stringify(pathIds),
        categoryPathNames: JSON.stringify(pathNames),
        location: location,
        country: data.country,
        city: data.city,
        area: data.area,
        brand: data.brand || null,
        condition: data.condition,
        material: data.material || null,
        color: data.color || null,
        make: data.make || null,
        model: data.model || null,
        year: data.year !== '' && data.year != null ? Number(data.year) : null,
        mileage: data.mileage !== '' && data.mileage != null ? Number(data.mileage) : null,
        transmission: data.transmission || null,
        fuelType: data.fuelType || null,
        seatingCapacity: data.seatingCapacity ? Number(data.seatingCapacity) : null,
        assemblyStatus: data.assemblyStatus || null,
        priceType: data.priceType || 'Fixed',
        contactName: data.contactName,
        contactPhone: data.contactPhone,
        images: newImages.length > 0 ? newImages : undefined,
        existingImages: existingImageUrls.length > 0 ? existingImageUrls : undefined,
        video: newVideo || undefined,
        existingVideo: existingVideoUrl || undefined,
        ...(aiMergedCarListing
          ? {
              display_data: aiMergedCarListing.display_data,
              filter_data: aiMergedCarListing.filter_data,
              specifications: aiMergedCarListing.specifications,
              missing_fields: aiMergedCarListing.missing_fields,
              ai_raw_response: aiMergedCarListing.ai_raw_response,
            }
          : {}),
      }

      // Attach category filter selections and any other filter_* fields.
      const filterEntries = {}
      Object.keys(data || {}).forEach((key) => {
        if (!key.startsWith('filter_')) return
        const v = data[key]
        if (v === undefined || v === null || v === '') return
        formData[key] = v
        filterEntries[key] = v
      })
      if (Object.keys(filterEntries).length) {
        console.log('[PostAd] Sending filter data:', filterEntries)
      }

      // Attach any other transcription/dynamic primitive fields so they persist.
      // (React Hook Form may hold values for fields we don't explicitly map above.)
      const allValues = getValues()
      const excludedExtraKeys = new Set([
        // Helpers / UI-only
        'brandChoice',
        'acceptRules',
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

        // Avoid sending nested objects/arrays unless explicitly mapped above.
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

      if (isEditMode) {
        const updatedProduct = await dispatch(updateProduct({ id: editProductId, productData: formData })).unwrap()
        toast.success('Product updated successfully!')
        if (user?._id) {
          dispatch(fetchProducts({ userId: user._id }))
        }
      } else {
        await dispatch(createProduct(formData)).unwrap()
        toast.success('Product submitted for review! It will be visible after admin approval.')
      }
      navigate('/dashboard')
    } catch (error) {
      console.error('Error submitting form:', error)
      const errorMessage = error?.response?.data?.message || error?.message || `Failed to ${isEditMode ? 'update' : 'post'} product`
      const angleChecklist = error?.response?.data?.angleChecklist
      toast.error(
        Array.isArray(angleChecklist) && angleChecklist.length
          ? `${errorMessage} (${angleChecklist.join(', ')})`
          : errorMessage,
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

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">
        {isEditMode ? 'Edit Product' : 'Post Your Ad'}
      </h1>

      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            Step {currentStep} of {TOTAL_STEPS}
          </span>
          <span className="text-sm text-gray-500">
            {Math.round((currentStep / TOTAL_STEPS) * 100)}% Complete
          </span>
              </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-primary-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(currentStep / TOTAL_STEPS) * 100}%` }}
          />
              </div>
        </div>

      {/* Step Content */}
      <form onSubmit={handleSubmit(onSubmit)}>
        {currentStep === 1 && <Step1Auth user={user} onNext={nextStep} />}
        {currentStep === 2 && (
          <Step2Category
            levelOptions={levelOptions}
            selectedPath={selectedPath}
            levelLabels={levelLabels}
            onLevelChange={handleLevelChange}
            loadingLevels={loadingLevels}
            register={register}
            setValue={setValue}
            errors={errors}
          />
        )}
        {currentStep === 3 && (
          <Step3VideoUpload
            videoFile={videoFile}
            setVideoFile={setVideoFile}
            setValue={setValue}
            register={register}
            watch={watch}
            selectedCategory={selectedCategoryForSteps || selectedCategory}
            subcategories={levelOptions[1] || []}
            categories={flatCategoriesForSteps.length ? flatCategoriesForSteps : categories}
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
          <Step4BasicDetails
            register={register}
            watch={watch}
            setValue={setValue}
            errors={errors}
            categories={flatCategoriesForSteps.length ? flatCategoriesForSteps : categories}
            selectedCategory={selectedCategoryForSteps || selectedCategory}
            subcategories={levelOptions[1] || []}
          />
        )}
        {currentStep === 5 && <Step5Usage register={register} errors={errors} />}
        {currentStep === 6 && (
          <Step6Price register={register} watch={watch} setValue={setValue} errors={errors} />
        )}
        {currentStep === 7 && <Step7Location register={register} errors={errors} />}
        {currentStep === 8 && (
          <Step8Description register={register} watch={watch} errors={errors} setValue={setValue} />
        )}
        {currentStep === 9 && (
          <Step9Contact register={register} errors={errors} user={user} />
        )}
        {currentStep === 10 && (
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
          />
        )}
        {currentStep === 12 && (
          <div className="card text-center py-12">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Submitting Your Ad...</h2>
            <p className="text-gray-600">Please wait while we process your submission</p>
          </div>
        )}

        {/* Navigation Buttons */}
        {currentStep < TOTAL_STEPS && currentStep !== 1 && currentStep !== 3 && (
          <div className="flex justify-between mt-8">
          <button
            type="button"
              onClick={prevStep}
              className="btn-secondary flex items-center gap-2"
          >
              <ChevronLeft className="w-4 h-4" />
              Previous
          </button>
            {currentStep === 10 ? (
          <button
            type="submit"
                disabled={isSubmitting || !validateStep(10)}
                onClick={(e) => {
                  // Ensure form validation passes before submitting
                  if (!validateStep(10)) {
                    e.preventDefault()
                    toast.error('Please accept the posting rules to continue')
                    return false
                  }
                }}
                className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Posting...
                  </>
                ) : (
                  <>
                    Post Ad
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
          </button>
            ) : (
              <button
                type="button"
                onClick={nextStep}
                className="btn-primary flex items-center gap-2"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
        </div>
        )}

        {currentStep === 1 && (
          <div className="flex justify-end mt-8">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn-secondary"
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
