import React from 'react';
import { createRoot } from 'react-dom/client';
import './campus-card/app.css';
import App from './campus-card/CampusCard';
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
