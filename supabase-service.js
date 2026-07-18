(function () {
  "use strict";

  const config = window.APP_CONFIG || {};
  const nativeFetch = window.fetch.bind(window);
  const MAX_ATTEMPTS = 3;
  const RETRY_DELAY_MS = 2500;
  const REQUEST_TIMEOUT_MS = 15000;

  function isSupabaseRequest(input) {
    if (!config.SUPABASE_URL) {
      return false;
    }

    const url = typeof input === "string" ? input : input && input.url;
    return Boolean(url && url.startsWith(config.SUPABASE_URL));
  }

  function delay(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  async function fetchWithTimeout(input, init) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      return await nativeFetch(input, {
        ...init,
        signal: init && init.signal ? init.signal : controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  function createAvailabilityError(status) {
    const error = new Error(
      status === 540
        ? "O banco Supabase esta pausado. Entre em contato com o administrador para restaura-lo."
        : "O banco Supabase esta temporariamente indisponivel."
    );

    error.name = "SupabaseAvailabilityError";
    error.status = status;
    return error;
  }

  async function request(input, init) {
    let lastError;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await fetchWithTimeout(input, init);

        if (response.status === 540) {
          throw createAvailabilityError(540);
        }

        if (response.status < 500 || attempt === MAX_ATTEMPTS) {
          return response;
        }

        lastError = createAvailabilityError(response.status);
      } catch (error) {
        lastError = error;

        if (error && error.status === 540) {
          throw error;
        }

        if (attempt === MAX_ATTEMPTS) {
          throw error;
        }
      }

      await delay(RETRY_DELAY_MS * attempt);
    }

    throw lastError || createAvailabilityError(503);
  }

  async function healthCheck() {
    if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
      return { available: false, configured: false };
    }

    try {
      const response = await request(
        `${config.SUPABASE_URL}/rest/v1/churrasqueira_reservas?select=id&limit=1`,
        {
          headers: {
            apikey: config.SUPABASE_ANON_KEY,
            Authorization: `Bearer ${config.SUPABASE_ANON_KEY}`
          }
        }
      );

      return {
        available: response.ok,
        configured: true,
        status: response.status
      };
    } catch (error) {
      return {
        available: false,
        configured: true,
        paused: error && error.status === 540,
        error
      };
    }
  }

  window.SupabaseService = {
    request,
    healthCheck
  };

  window.fetch = function (input, init) {
    if (!isSupabaseRequest(input)) {
      return nativeFetch(input, init);
    }

    return request(input, init);
  };
})();
