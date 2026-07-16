// export const API_URL = 'https://api.absence.xenoshms.com/api';
export const API_URL = 'http://localhost:3000/api'; // Pakai API local dulu

/**
 * Retrieves the authentication token from localStorage and returns it in a header object.
 * @returns {object} An object containing the 'x-access-token' header, or an empty object if no token is found.
 */
function getAuthHeader() {
    const token = localStorage.getItem('accessToken');
    return token ? { 'x-access-token': token } : {};
}

/**
 * Removes user session data from localStorage and redirects to the login page.
 */
export function logout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}

/**
 * A generic function to make authenticated API requests.
 * It automatically adds the auth token and handles 401 responses by logging out.
 * @param {string} endpoint - The API endpoint to call (e.g., '/users').
 * @param {object} [options={}] - Optional fetch options (method, body, etc.).
 * @returns {Promise<any>} The JSON response from the API.
 * @throws {Error} Throws an error if the API response is not ok.
 */
export async function fetchData(endpoint, options = {}) {
    try {
        const { headers: optionHeaders, responseType = 'json', ...restOfOptions } = options;
        const config = {
            headers: { ...getAuthHeader(), ...optionHeaders },
            ...restOfOptions
        };
        const response = await fetch(`${API_URL}${endpoint}`, config);
        if (!response.ok) {
            if (response.status === 401) { // Unauthorized, likely expired token
                logout();
            }
            const errorData = await response.json().catch(() => null);
            throw new Error(errorData?.message || `API Error: ${response.statusText}`);
        }
        if (response.status === 204) {
            return true;
        }
        if (responseType === 'blob') {
            return response.blob();
        }
        if (responseType === 'text') {
            return response.text();
        }
        return response.json();
    } catch (error) {
        console.error(`Failed to fetch from ${endpoint}:`, error);
        throw error; // Re-throw so the caller can handle it
    }
}

/**
 * Retrieves and parses the user object from localStorage.
 * @returns {object|null} The user object or null if not found.
 */
export function getUser() {
    const userString = localStorage.getItem('user');
    return userString ? JSON.parse(userString) : null;
}

/**
 * Retrieves the raw access token from localStorage.
 * @returns {string|null} The access token or null if not found.
 */
export function getToken() {
    return localStorage.getItem('accessToken');
}

/**
 * A shared state object that is initialized from localStorage.
 * This can be imported and used by other modules.
 */
export const state = {
    user: getUser(),
    token: getToken(),
    company: null, // Will be populated later
};