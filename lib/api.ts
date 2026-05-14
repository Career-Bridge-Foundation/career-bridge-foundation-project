type ApiResult<T> = {
  data: T | null;
  error: string | null;
};

async function request<T>(
  url: string,
  options: RequestInit = {}
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });

    const json = await res.json();

    if (!res.ok) {
      return { data: null, error: json.error || "Request failed" };
    }

    return { data: json, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

export const api = {
  get: <T>(url: string) => request<T>(url, { method: "GET" }),

  post: <T>(url: string, body: unknown) =>
    request<T>(url, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // For file uploads — don't stringify, don't set Content-Type
  postForm: <T>(url: string, formData: FormData) =>
    request<T>(url, {
      method: "POST",
      body: formData,
      headers: {}, // let browser set multipart boundary
    }),
};