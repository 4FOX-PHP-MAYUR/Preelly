import { configureStore } from '@reduxjs/toolkit'
import authReducer from './slices/authSlice'
import productReducer from './slices/productSlice'
import categoryReducer from './slices/categorySlice'
import uiReducer from './slices/uiSlice'
import feedReducer from './slices/feedSlice'
import dynamicFormReducer from './slices/dynamicFormSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    products: productReducer,
    categories: categoryReducer,
    ui: uiReducer,
    feed: feedReducer,
    dynamicForm: dynamicFormReducer,
  },
})

