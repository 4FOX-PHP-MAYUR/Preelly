import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { Toaster } from 'react-hot-toast'
import App from './App'
import { ChatProvider } from '@shared/components/Chat/ChatContext'
import { CallProvider } from '@shared/components/Call/CallContext'
import { LoginPromptProvider } from '@shared/components/LoginPrompt/LoginPromptContext'
import { store } from '@shared/store/store'
import './index.css'
import 'flag-icons/css/flag-icons.min.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <Provider store={store}>
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <LoginPromptProvider>
            <ChatProvider>
              <CallProvider>
                <App />
                <Toaster position="top-right" />
              </CallProvider>
            </ChatProvider>
          </LoginPromptProvider>
        </BrowserRouter>
      </Provider>
    </HelmetProvider>
  </React.StrictMode>,
)
