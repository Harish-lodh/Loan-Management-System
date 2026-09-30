import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { BrandingProvider } from './context/BrandingContext.jsx';
import './styles.css';
import 'react-toastify/dist/ReactToastify.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <BrandingProvider>
        <AuthProvider>
          <App />
          <ToastContainer
            position="top-right"
            autoClose={3000}
            closeOnClick
            pauseOnHover
            draggable
          />
        </AuthProvider>
      </BrandingProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
