import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import { ChatProvider } from '@shared/components/Chat/ChatContext'
import { CallProvider } from '@shared/components/Call/CallContext'
import { store } from './store/store'
import './index.css'

// Vite base is /admin/ (matches nginx). Strip trailing slash for React Router basename.
const basename = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') || '/'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter
        basename={basename === '/' ? undefined : basename}
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <ChatProvider>
          <CallProvider>
            <App />
            <Toaster position="top-right" />
          </CallProvider>
        </ChatProvider>
      </BrowserRouter>
    </Provider>
  </React.StrictMode>,
)
