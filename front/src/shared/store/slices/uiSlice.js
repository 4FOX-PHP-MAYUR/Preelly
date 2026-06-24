import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  isMuted: true, // Default to muted (Instagram behavior)
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleMute: (state) => {
      state.isMuted = !state.isMuted
    },
    setMuted: (state, action) => {
      state.isMuted = action.payload
    },
  },
})

export const { toggleMute, setMuted } = uiSlice.actions
export const selectIsMuted = (state) => state.ui.isMuted
export default uiSlice.reducer

