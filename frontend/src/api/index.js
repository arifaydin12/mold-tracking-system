import { api } from './client.js'

const data = (res) => res.data

export const authApi = {
    login: (username, password) => api.post('/auth/login', { username, password }).then(data),
    logout: () => api.post('/auth/logout').then(data),
    me: () => api.get('/auth/me').then(data),
    updateProfile: (values) => api.patch('/auth/me', values).then(data),
    changePassword: (values) => api.post('/auth/change-password', values).then(data),
}

export const moldsApi = {
    list: (params) => api.get('/molds', { params }).then(data),
    get: (id) => api.get(`/molds/${id}`).then(data),
    create: (values) => api.post('/molds', values).then(data),
    update: (id, values) => api.patch(`/molds/${id}`, values).then(data),
    archive: (id) => api.delete(`/molds/${id}`).then(data),
    restore: (id) => api.post(`/molds/${id}/restore`).then(data),
}

/** kind: 'trials' | 'revisions' | 'maintenance' */
export const recordsApi = {
    create: (moldId, kind, values) => api.post(`/molds/${moldId}/${kind}`, values).then(data),
    update: (moldId, kind, id, values) => api.patch(`/molds/${moldId}/${kind}/${id}`, values).then(data),
    remove: (moldId, kind, id) => api.delete(`/molds/${moldId}/${kind}/${id}`).then(data),
}

export const suppliersApi = {
    list: () => api.get('/suppliers').then(data),
    create: (values) => api.post('/suppliers', values).then(data),
}

export const usersApi = {
    list: (params) => api.get('/users', { params }).then(data),
    create: (values) => api.post('/users', values).then(data),
    update: (id, values) => api.patch(`/users/${id}`, values).then(data),
    resetPassword: (id, newPassword) => api.post(`/users/${id}/reset-password`, { new_password: newPassword }).then(data),
}

export const statsApi = {
    dashboard: () => api.get('/stats/dashboard').then(data),
}

export const logsApi = {
    activity: (params) => api.get('/logs/activity', { params }).then(data),
    logins: (params) => api.get('/logs/logins', { params }).then(data),
}
