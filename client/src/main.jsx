import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx' // Your main App component
import './index.css'     // Your main CSS file (for global styles, if any)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)