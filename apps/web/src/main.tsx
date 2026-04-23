import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { OperatorSessionProvider } from './session/OperatorSessionContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <OperatorSessionProvider>
        <App />
      </OperatorSessionProvider>
    </BrowserRouter>
  </React.StrictMode>
);
