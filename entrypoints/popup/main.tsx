import React from 'react';
import { createRoot } from 'react-dom/client';
import { PopupApp } from '../../src/PopupApp';
import '../../src/styles.css';

createRoot(document.getElementById('root')!).render(<React.StrictMode><PopupApp /></React.StrictMode>);
