import { configureStore } from '@reduxjs/toolkit'
import authReducer from '@shared/store/slices/authSlice'
import productReducer from '@shared/store/slices/productSlice'
import categoryReducer from '@shared/store/slices/categorySlice'
import uiReducer from '@shared/store/slices/uiSlice'
import feedReducer from '@shared/store/slices/feedSlice'
import dynamicFormReducer from '@shared/store/slices/dynamicFormSlice'
import adminAuthReducer from './adminAuthSlice'

/**
 * The Admin Panel's own store — NOT the shared marketplace store.
 *
 * `adminAuth` is the real, independent admin authentication/permissions
 * source of truth (admin_users collection, its own token/session — see
 * adminAuthSlice.js). The marketplace `auth` slice is kept registered only
 * because a couple of shared pages rendered inside the admin app
 * (ProductDetailPage, ChatThreadPage) read `state.auth` for their own
 * customer-facing features; it is never used to make any admin auth/
 * permission decision here.
 */
export const store = configureStore({
  reducer: {
    adminAuth: adminAuthReducer,
    auth: authReducer,
    products: productReducer,
    categories: categoryReducer,
    ui: uiReducer,
    feed: feedReducer,
    dynamicForm: dynamicFormReducer,
  },
})
