export async function api(path, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const csrfToken = ["GET", "HEAD", "OPTIONS"].includes(method) ? "" : await getCsrfToken();
  const headers = options.body instanceof FormData ? options.headers || {} : { "Content-Type": "application/json", ...(options.headers || {}) };
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: csrfToken ? { ...headers, "X-CSRF-Token": csrfToken } : headers
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok && response.status === 403 && data.error?.includes("security token")) csrfCache = "";
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

let csrfCache = "";

async function getCsrfToken() {
  if (csrfCache) return csrfCache;
  const response = await fetch("/api/auth/csrf", { credentials: "same-origin" });
  const data = await response.json();
  csrfCache = data.csrfToken;
  return csrfCache;
}

export function fileToDataUrl(file, maxSize = 900) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      image.onerror = reject;
      image.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
