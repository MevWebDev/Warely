import { useAuth0 } from "@auth0/auth0-react";

export const useAuthenticatedApi = () => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  const apiCall = async (url: string, options: RequestInit = {}) => {
    if (!isAuthenticated) {
      throw new Error("User not authenticated");
    }

    try {
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
        },
      });

      return fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
    } catch (error) {
      console.error("Error getting access token:", error);
      throw error;
    }
  };

  return { apiCall, isAuthenticated };
};
