import { supabase } from './supabase';

// In production, VITE_API_URL points to the Railway server.
// In development, it's empty and the Vite proxy handles /api → localhost:3001.
const API_BASE = import.meta.env.VITE_API_URL ?? '';

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
  };
}

async function request(method, path, body) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const contentType = res.headers.get('content-type') || '';
  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    if (contentType.includes('application/json')) {
      const json = await res.json().catch(() => ({}));
      message = json.error || message;
    }
    throw new Error(message);
  }

  // Binary responses (document downloads)
  if (contentType.includes('application/vnd') || contentType.includes('application/octet')) {
    return res.blob();
  }

  return res.json();
}

async function upload(path, formData) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${API_BASE}/api${path}`, {
    method: 'POST',
    headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
    body: formData,
  });

  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || `Upload failed: ${res.status}`);
  }

  return res.json();
}

export const api = {
  get:    (path)          => request('GET', path),
  post:   (path, body)    => request('POST', path, body),
  put:    (path, body)    => request('PUT', path, body),
  delete: (path)          => request('DELETE', path),
  upload: (path, formData) => upload(path, formData),

  // Convenience helpers
  profile: {
    get:             ()       => api.get('/profile'),
    update:          (body)   => api.put('/profile', body),
    setOnboardingStep: (step, complete) => api.put('/profile/onboarding-step', { step, complete }),
    markSeenJobs:    ()       => api.put('/profile/seen-jobs', {}),
  },
  resume: {
    get:    ()       => api.get('/resume'),
    upload: (fd)     => api.upload('/resume/upload', fd),
    text:   (text)   => api.post('/resume/text', { text }),
  },
  jobs: {
    feed:        ()               => api.get('/jobs/feed'),
    submitted:   ()               => api.get('/jobs/submitted'),
    refresh:     ()               => api.post('/jobs/refresh', {}),
    setStatus:   (id, status)     => api.put(`/jobs/${id}/status`, { status }),
    setJourney:  (id, body)       => api.put(`/jobs/${id}/journey`, body),
    remove:      (id)             => api.delete(`/jobs/${id}`),
    add:         (fd)             => api.upload('/jobs/add', fd),
    addText:     (body)           => api.post('/jobs/add', body),
  },
  ai: {
    fitScore:        (id)         => api.post(`/ai/fit-score/${id}`, {}),
    fitScores:       (ids)        => api.post('/ai/fit-scores', { userJobIds: ids }),
    scoreQuestions:  (id)         => api.post(`/ai/score-questions/${id}`, {}),
    rescore:         (id, body)   => api.post(`/ai/rescore/${id}`, body),
    tailorResume:    (id, body)   => api.post(`/ai/tailor-resume/${id}`, body),
    coverLetter:     (id, body)   => api.post(`/ai/cover-letter/${id}`, body),
    interviewPrep:   (id, body)   => api.post(`/ai/interview-prep/${id}`, body || {}),
    debrief:         (id, body)   => api.post(`/ai/debrief/${id}`, body),
    suggestRoles:    ()           => api.post('/ai/suggest-roles', {}),
    findListings:    (force)      => api.post('/ai/find-listings', { force: Boolean(force) }),
    chat:            (body)       => api.post('/ai/chat', body),
  },
  documents: {
    resume:      (id)  => request('POST', `/documents/resume/${id}`, {}),
    coverLetter: (id)  => request('POST', `/documents/cover-letter/${id}`, {}),
  },
  admin: {
    users: () => api.get('/admin/users'),
  },
};

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href    = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
