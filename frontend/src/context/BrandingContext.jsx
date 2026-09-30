import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api/client';

const fallback = { name: 'Loan Management', legalName: null, logoUrl: null };
const BrandingContext = createContext(fallback);

// One frontend build is shared by every NBFC instance; the name and logo come from that instance's API.
export function BrandingProvider({ children }) {
  const [branding, setBranding] = useState(fallback);

  useEffect(() => {
    api
      .get('/tenant/branding')
      .then((response) => {
        setBranding({ ...fallback, ...response.data });
        if (response.data?.name) {
          document.title = response.data.name;
        }
      })
      .catch(() => {});
  }, []);

  return <BrandingContext.Provider value={branding}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  return useContext(BrandingContext);
}
