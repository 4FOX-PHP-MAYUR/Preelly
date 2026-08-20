import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import { ChatProvider } from '@shared/components/Chat/ChatContext'
import { CallProvider } from '@shared/components/Call/CallContext'
import { LoginPromptProvider } from '@shared/components/LoginPrompt/LoginPromptContext'
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
        {/*
          Shared marketplace pages rendered inside the admin app (the user detail
          view, product detail, chat) call useRequireAuth(), which throws outright
          when this provider is missing — that crash renders as a blank page. It is
          mounted for the same reason ChatProvider/CallProvider are: to satisfy
          shared components, never to make an admin auth decision.
        */}
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
  </React.StrictMode>,
)
