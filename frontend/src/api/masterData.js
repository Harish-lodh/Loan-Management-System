import { api } from './client';

export function getMasterDataSummary() {
  return Promise.all([
    api.get('/api/v1/organizations'),
    api.get('/api/v1/products'),
    api.get('/api/v1/partners'),
    api.get('/api/v1/service-providers'),
  ]).then(([organizations, products, partners, providers]) => ({
    organizations: organizations.data,
    products: products.data,
    partners: partners.data,
    providers: providers.data,
  }));
}

export const organizationsApi = {
  list: () => api.get('/api/v1/organizations').then((response) => response.data),
  create: (payload) => api.post('/api/v1/organizations', payload).then((response) => response.data),
  update: (id, payload) => api.patch(`/api/v1/organizations/${id}`, payload).then((response) => response.data),
};

export const productsApi = {
  list: () => api.get('/api/v1/products').then((response) => response.data),
  create: (payload) => api.post('/api/v1/products', payload).then((response) => response.data),
  publish: (id) => api.post(`/api/v1/products/${id}/publish`).then((response) => response.data),
};

export const partnersApi = {
  list: () => api.get('/api/v1/partners').then((response) => response.data),
  create: (payload) => api.post('/api/v1/partners', payload).then((response) => response.data),
};

export const providersApi = {
  list: () => api.get('/api/v1/service-providers').then((response) => response.data),
  create: (payload) => api.post('/api/v1/service-providers', payload).then((response) => response.data),
  updateSecrets: (id, secrets) => api.patch(`/api/v1/service-providers/${id}/secrets`, { secrets }).then((response) => response.data),
};
