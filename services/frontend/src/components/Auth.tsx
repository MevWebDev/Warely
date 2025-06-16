import { type FC, useEffect, useRef } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { darken } from "@mui/material";
import {
  Button,
  Box,
  Typography,
  CircularProgress,
  Stack,
} from "@mui/material";
import { Login, Logout } from "@mui/icons-material";
import axios from "axios";

export const LoadingSpinner: FC = () => (
  <Box
    display="flex"
    justifyContent="center"
    alignItems="center"
    minHeight="100vh"
  >
    <Stack spacing={2} alignItems="center">
      <CircularProgress size={60} color="primary" />
      <Typography variant="h6" color="text.secondary">
        Loading...
      </Typography>
    </Stack>
  </Box>
);

export const LoginButton: FC = () => {
  const { loginWithRedirect, isAuthenticated } = useAuth0();

  if (isAuthenticated) return null;

  return (
    <Button
      variant="contained"
      color="primary"
      size="large"
      startIcon={<Login />}
      onClick={() => loginWithRedirect()}
      sx={{
        px: 4,
        backgroundColor: "white",
        color: "black",
        borderRadius: "0.5rem",
        "&:hover": { backgroundColor: darken("#FFFFFF", 0.1) },
      }}
    >
      Log In
    </Button>
  );
};

export const LogoutButton: FC = () => {
  const { logout, isAuthenticated } = useAuth0();

  if (!isAuthenticated) return null;

  return (
    <Button
      color="secondary"
      size="large"
      startIcon={<Logout />}
      onClick={() =>
        logout({ logoutParams: { returnTo: window.location.origin } })
      }
      sx={{
        px: 4,
        backgroundColor: "white",
        color: "black",
        borderRadius: "0.5rem",
        "&:hover": { backgroundColor: darken("#FFFFFF", 0.1) },
      }}
    >
      Log Out
    </Button>
  );
};

// Simple component that just calls the API once after login
export const UserInitializer: FC = () => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (isAuthenticated && !hasInitialized.current) {
      hasInitialized.current = true;

      const callApi = async () => {
        try {
          const token = await getAccessTokenSilently();
          await axios.post(
            "http://localhost:5000/api/users/auth/login",
            {},
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          console.log("User created/updated");
        } catch (err) {
          console.error("API call failed:", err);
        }
      };

      callApi();
    }
  }, [isAuthenticated, getAccessTokenSilently]);

  return null;
};

// Simple Auth Guard
export const AuthGuard: FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth0();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
        sx={{
          backgroundColor: "black",
          color: "white",
        }}
      >
        <Stack spacing={3} alignItems="center">
          <Typography variant="h4" gutterBottom>
            Welcome to Warely
          </Typography>
          <Typography color="text.secondary" textAlign="center">
            Your complete warehouse management solution
          </Typography>
          <LoginButton />
        </Stack>
      </Box>
    );
  }

  return (
    <Box sx={{ backgroundColor: "black", color: "white", minHeight: "100vh" }}>
      <UserInitializer />
      {children}
    </Box>
  );
};
