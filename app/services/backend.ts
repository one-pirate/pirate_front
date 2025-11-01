const BASE_URL = import.meta.env.VITE_API_URL || null;

export const api = {
  async get(endpoint: string, options: any = {}) {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });

    if (!res.ok) {
      throw new Error(`GET ${endpoint} failed: ${res.status}`);
    }

    return res.json();
  },

  async post(endpoint: string, data: any, options: any = {}) {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      body: JSON.stringify(data),
      ...options,
    });

    if (!res.ok) {
      throw new Error(`POST ${endpoint} failed: ${res.status}`);
    }

    return res.json();
  },
};
